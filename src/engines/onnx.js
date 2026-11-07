// ONNX Runtime Web engines: AnimeGANv2/v3, White-box Cartoonization, YuNet face detection.
// Models are served from this site (public/models), so no third-party inference service is used.
import { createCanvas, fitMultiple, resizeImageData } from './canvas';
import { decodeYuNet } from './imageOps';

let ortPromise;
const sessions = new Map();

function loadOrt() {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web/wasm').then((ort) => {
      ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      return ort;
    }).catch((error) => { ortPromise = undefined; throw error; });
  }
  return ortPromise;
}

export function modelURL(file) {
  return import.meta.env.BASE_URL + 'models/' + file;
}

export async function getSession(file) {
  if (!sessions.has(file)) {
    const promise = loadOrt().then((ort) => ort.InferenceSession.create(modelURL(file), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }));
    promise.catch(() => sessions.delete(file));
    sessions.set(file, promise);
  }
  return sessions.get(file);
}

// Image-to-image GAN with NHWC float input in [-1, 1] (AnimeGAN, White-box).
export async function runCartoonModel(file, imageData, multiple = 32) {
  const ort = await loadOrt();
  const session = await getSession(file);
  const input = fitMultiple(imageData, multiple);
  const { width: w, height: h, data } = input;
  const tensorData = new Float32Array(w * h * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    tensorData[j] = data[i] / 127.5 - 1;
    tensorData[j + 1] = data[i + 1] / 127.5 - 1;
    tensorData[j + 2] = data[i + 2] / 127.5 - 1;
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', tensorData, [1, h, w, 3]) };
  const results = await session.run(feeds);
  const out = results[session.outputNames[0]].data;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
    pixels[i] = (out[j] + 1) * 127.5;
    pixels[i + 1] = (out[j + 1] + 1) * 127.5;
    pixels[i + 2] = (out[j + 2] + 1) * 127.5;
    pixels[i + 3] = 255;
  }
  return resizeImageData(new ImageData(pixels, w, h), imageData.width, imageData.height);
}

// YuNet: letterbox to 640x640, BGR float 0..255, NCHW.
export async function detectFaces(imageData, threshold = 0.6) {
  const ort = await loadOrt();
  const session = await getSession('yunet-2023mar.onnx');
  const size = 640;
  const scale = size / Math.max(imageData.width, imageData.height);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#000';
  context.fillRect(0, 0, size, size);
  const temp = createCanvas(imageData.width, imageData.height);
  temp.getContext('2d').putImageData(imageData, 0, 0);
  context.drawImage(temp, 0, 0, Math.round(imageData.width * scale), Math.round(imageData.height * scale));
  const { data } = context.getImageData(0, 0, size, size);
  const plane = size * size;
  const tensorData = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    tensorData[i] = data[i * 4 + 2];
    tensorData[plane + i] = data[i * 4 + 1];
    tensorData[2 * plane + i] = data[i * 4];
  }
  const results = await session.run({ input: new ort.Tensor('float32', tensorData, [1, 3, size, size]) });
  const outputs = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.data]));
  return decodeYuNet(outputs, { inputSize: size, threshold, scale });
}
