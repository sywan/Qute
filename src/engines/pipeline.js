// Qute stylisation pipeline:
//   photo -> (face detection) -> (chibi/cute geometric warp, fuller lips) -> (beauty: skin, lips) -> base engine
//         -> (reference texture via Magenta, with face protection) -> (reference palette)
//         -> (cute grade) -> (detail retention) -> PNG
import { getStyleModel } from '../styleTransfer';
import { canvasToBlob, imageDataToCanvas, loadImage, nextFrame, resizeImageData, toImageData } from './canvas';
import { applyBeautyROI, applyWarp, blend, guidedUpsample, scaleFaces, cuteGrade, faceMask, mapFaces, paletteTransfer, planChibiWarp } from './imageOps';
import { detectFaces, runCartoonModel } from './onnx';
import { engineById } from './registry';
import { serverStylize } from './server';

const hasWarp = (warp) => Object.values(warp || {}).some((v) => v > 0);
const hasBeauty = (beauty) => ['smooth', 'brighten', 'lips'].some((k) => (beauty?.[k] || 0) > 0);
const warpParams = (settings) => ({ ...settings.warp, lips: settings.beauty?.fuller || 0 });

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
  const needFaces = hasBeauty(settings.beauty) || (engine.kind === 'browser' && (hasWarp(warpParams(settings)) || ((wantsTexture || engine.id === 'magenta') && settings.faceProtect > 0)));
  let faces = [];
  if (needFaces) {
    onStep('detectingFaces');
    await nextFrame();
    try { faces = await detectFaces(photo); } catch (error) { console.warn('Face detection unavailable', error); }
  }

  // 2. Geometric warp (big head, big eyes, rounder chin, shorter body).
  let warped = photo;
  let warpedFaces = faces;
  if (engine.kind === 'browser' && faces.length && hasWarp(warpParams(settings))) {
    onStep('warping');
    await nextFrame();
    const plan = planChibiWarp(faces, warpParams(settings), photo.width, photo.height);
    const out = applyWarp(photo, plan);
    warped = new ImageData(out.data, out.width, out.height);
    warpedFaces = mapFaces(faces, plan);
  }

  // 2b. Beauty (美肌): smoother, brighter skin and lip colour on the (warped) photo.
  if (warpedFaces.length && hasBeauty(settings.beauty)) {
    onStep('beautifying');
    await nextFrame();
    warped = toImageData_(applyBeautyROI(warped, warpedFaces, settings.beauty));
  }

  // 3. Base engine.
  let base;
  if (engine.kind === 'server') {
    onStep('serverWorking');
    let upload = toImageData(photoImage, 1024);
    if (hasBeauty(settings.beauty)) {
      // Beautify before sending, so server engines also work from the retouched photo.
      try { upload = toImageData_(applyBeautyROI(upload, await detectFaces(upload), settings.beauty)); } catch (error) { console.warn('Beauty skipped', error); }
    }
    const photoBlob = await canvasToBlob(imageDataToCanvas(upload));
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
  // 7. High-resolution output (2K / 4K / 5K): the model runs at the processing size; the result is
  // then guided-upsampled with the full-resolution photo, so edges come out crisp. The output is
  // never larger than the original photo (no invented pixels).
  const target = Number(settings.outputSize) || 0;
  const sourceLong = Math.max(photoImage.naturalWidth || photoImage.width, photoImage.naturalHeight || photoImage.height);
  const resultLong = Math.max(result.width, result.height);
  const outLong = Math.min(target, sourceLong);
  let upscaled = false;
  if (outLong > resultLong * 1.05) {
    onStep('upscaling');
    await nextFrame();
    try {
      const full = toImageData(photoImage, outLong);
      if (engine.kind === 'browser') {
        // Rebuild the exact photo the model saw, at full resolution: same warp, same beauty.
        const s = full.width / photo.width;
        let guide = full, guideFaces = scaleFaces(faces, s);
        if (faces.length && hasWarp(warpParams(settings))) {
          const plan = planChibiWarp(guideFaces, warpParams(settings), full.width, full.height);
          const w = applyWarp(full, plan);
          guide = toImageData_(w);
          guideFaces = mapFaces(guideFaces, plan);
        }
        if (guideFaces.length && hasBeauty(settings.beauty)) guide = toImageData_(applyBeautyROI(guide, guideFaces, settings.beauty));
        const guideLow = resizeImageData(warped, result.width, result.height);
        const W = Math.round(guide.width), H = Math.round(guide.width * result.height / result.width);
        const guideSized = H === guide.height ? guide : resizeImageData(guide, W, H);
        result = toImageData_(guidedUpsample(result, guideLow, guideSized, { radius: 1, eps: 2e-3 }));
      } else {
        // Server results may be cropped or redrawn, so they are not aligned with the photo: plain resize.
        const scale = outLong / resultLong;
        result = resizeImageData(result, Math.round(result.width * scale), Math.round(result.height * scale));
      }
      upscaled = true;
    } catch (error) {
      console.warn('High-resolution output failed; keeping the processing size', error);
    }
  }
  const pixels = result.width * result.height;
  const type = pixels > 4.2e6 ? 'image/jpeg' : 'image/png'; // 4K/5K PNGs would be 20–60 MB
  const blob = await canvasToBlob(imageDataToCanvas(result), type, 0.95);
  return { blob, faces: faces.length, engine: engine.id, width: result.width, height: result.height, upscaled, limitedBySource: target > sourceLong && target > resultLong };
}

function toImageData_(img) {
  return img instanceof ImageData ? img : new ImageData(img.data, img.width, img.height);
}
