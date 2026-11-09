// Qute stylisation pipeline:
//   photo -> (face detection) -> (chibi/cute geometric warp) -> base engine
//         -> (reference texture via Magenta, with face protection) -> (reference palette)
//         -> (cute grade) -> (detail retention) -> PNG
import { getStyleModel } from '../styleTransfer';
import { canvasToBlob, imageDataToCanvas, loadImage, nextFrame, resizeImageData, toImageData } from './canvas';
import { applyWarp, blend, cuteGrade, faceMask, mapFaces, paletteTransfer, planChibiWarp } from './imageOps';
import { detectFaces, runCartoonModel } from './onnx';
import { engineById } from './registry';
import { serverStylize } from './server';

const hasWarp = (warp) => Object.values(warp || {}).some((v) => v > 0);

async function magentaStylize(content, styleImage, strength) {
  const model = await getStyleModel();
  const small = content.width > 640 || content.height > 640
    ? resizeImageData(content, ...fitWithin(content.width, content.height, 640)) : content;
  const output = await model.stylize(imageDataToCanvas(small), styleImage, strength);
  return resizeImageData(output, content.width, content.height);
}

function fitWithin(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

/**
 * @param {object} input  { photoURL, referenceURL?, settings, serverURL?, onStep?(key) }
 * @returns {Promise<{ blob: Blob, faces: number, engine: string }>}
 */
export async function runPipeline({ photoURL, referenceURL, settings, serverURL, onStep = () => {} }) {
  const engine = engineById(settings.engine);
  if (!engine) throw new Error('Unknown engine ' + settings.engine);
  if (engine.needsReference && !referenceURL) throw Object.assign(new Error('Reference required'), { code: 'missingStyle' });
  if (engine.kind === 'server' && !serverURL) throw Object.assign(new Error('Server URL required'), { code: 'serverMissing' });

  const [photoImage, referenceImage] = await Promise.all([loadImage(photoURL), referenceURL ? loadImage(referenceURL) : null]);
  const photo = toImageData(photoImage, settings.maxSide || 768);
  const reference = referenceImage ? toImageData(referenceImage, 512) : null;

  // 1. Faces are needed for geometric warps and for face protection under reference texture.
  const wantsTexture = referenceImage && settings.texture > 0 && engine.id !== 'magenta';
  const needFaces = engine.kind === 'browser' && (hasWarp(settings.warp) || ((wantsTexture || engine.id === 'magenta') && settings.faceProtect > 0));
  let faces = [];
  if (needFaces) {
    onStep('detectingFaces');
    await nextFrame();
    try { faces = await detectFaces(photo); } catch (error) { console.warn('Face detection unavailable', error); }
  }

  // 2. Geometric warp (big head, big eyes, rounder chin, shorter body).
  let warped = photo;
  let warpedFaces = faces;
  if (engine.kind === 'browser' && faces.length && hasWarp(settings.warp)) {
    onStep('warping');
    await nextFrame();
    const plan = planChibiWarp(faces, settings.warp, photo.width, photo.height);
    const out = applyWarp(photo, plan);
    warped = new ImageData(out.data, out.width, out.height);
    warpedFaces = mapFaces(faces, plan);
  }

  // 3. Base engine.
  let base;
  if (engine.kind === 'server') {
    onStep('serverWorking');
    const photoBlob = await canvasToBlob(imageDataToCanvas(toImageData(photoImage, 1024)));
    const refBlob = referenceImage ? await canvasToBlob(imageDataToCanvas(toImageData(referenceImage, 768))) : null;
    const resultBlob = await serverStylize(serverURL, engine.id, photoBlob, refBlob, {
      variant: settings.variant, style_degree: settings.styleDegree, exaggeration: settings.exaggeration,
      identity: settings.identity, prompt: settings.prompt || '',
      ...(engine.custom ? settings.customParams?.[engine.id] || {} : {})
    });
    const resultImage = await loadImage(URL.createObjectURL(resultBlob));
    base = toImageData(resultImage, Math.max(1024, settings.maxSide || 768));
    URL.revokeObjectURL(resultImage.src);
  } else if (engine.model) {
    onStep('loadingModel');
    await nextFrame();
    base = await runCartoonModel(engine.model, warped, engine.multiple);
  } else if (engine.id === 'magenta') {
    onStep('loadingModel');
    base = await magentaStylize(warped, referenceImage, settings.texture > 0 ? settings.texture : 0.7);
    if (warpedFaces.length && settings.faceProtect > 0) base = toImageData_(blend(base, warped, settings.faceProtect * 0.6, faceMask(base.width, base.height, warpedFaces)));
  } else {
    base = warped;
  }

  let result = base;
  // 4. Reference texture on top of the cartoon base, keeping faces from the base.
  if (wantsTexture) {
    onStep('applyingReference');
    await nextFrame();
    const textured = await magentaStylize(result, referenceImage, settings.texture);
    const mask = warpedFaces.length && settings.faceProtect > 0 && engine.kind === 'browser' ? faceMask(result.width, result.height, warpedFaces) : null;
    result = toImageData_(mask ? blend(textured, result, settings.faceProtect, mask) : textured);
  }
  // 5. Reference palette (robust: colour statistics only).
  if (reference && settings.palette > 0) {
    onStep('applyingReference');
    await nextFrame();
    result = toImageData_(paletteTransfer(result, reference, settings.palette));
  }
  // 6. Cute grade and detail retention.
  onStep('finishing');
  await nextFrame();
  if (settings.cute > 0) result = toImageData_(cuteGrade(result, settings.cute));
  if (settings.detail > 0 && engine.kind === 'browser') {
    const original = resizeImageData(warped, result.width, result.height);
    result = toImageData_(blend(result, original, Math.min(0.6, settings.detail)));
  }
  const blob = await canvasToBlob(imageDataToCanvas(result));
  return { blob, faces: faces.length, engine: engine.id };
}

function toImageData_(img) {
  return img instanceof ImageData ? img : new ImageData(img.data, img.width, img.height);
}
