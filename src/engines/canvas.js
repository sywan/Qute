// Browser-only helpers that move pixels between images, canvases and ImageData.

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = url;
  });
}

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Draw a source (image/canvas) into ImageData whose longest side is at most maxSide.
export function toImageData(source, maxSide, multiple = 1) {
  const w0 = source.naturalWidth || source.width, h0 = source.naturalHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  let w = Math.max(multiple, Math.round(w0 * scale)), h = Math.max(multiple, Math.round(h0 * scale));
  w -= w % multiple; h -= h % multiple;
  const canvas = createCanvas(w, h);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, w, h);
  return context.getImageData(0, 0, w, h);
}

export function imageDataToCanvas(data) {
  const canvas = createCanvas(data.width, data.height);
  const image = data instanceof ImageData ? data : new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas;
}

export function resizeImageData(data, width, height) {
  if (data.width === width && data.height === height) return data;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(imageDataToCanvas(data), 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

// Resize to the nearest smaller dimensions that are multiples of `multiple`.
export function fitMultiple(data, multiple) {
  const w = Math.max(multiple, data.width - (data.width % multiple));
  const h = Math.max(multiple, data.height - (data.height % multiple));
  return resizeImageData(data, w, h);
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type, quality));
}

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
