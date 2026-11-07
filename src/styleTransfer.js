let modelPromise;
export async function getStyleModel() {
  if (!modelPromise) {
    modelPromise = import('@magenta/image').then(async ({ ArbitraryStyleTransferNetwork }) => {
      const model = new ArbitraryStyleTransferNetwork();
      await model.initialize();
      return model;
    }).catch((error) => { modelPromise = undefined; throw error; });
  }
  return modelPromise;
}
export function imageFromURL(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
export async function stylizePhoto(model, photoURL, styleURL, strength) {
  const [photo, style] = await Promise.all([imageFromURL(photoURL), imageFromURL(styleURL)]);
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(photo.naturalWidth, photo.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
  canvas.getContext('2d').drawImage(photo, 0, 0, canvas.width, canvas.height);
  const output = await model.stylize(canvas, style, strength);
  const result = document.createElement('canvas');
  result.width = output.width;
  result.height = output.height;
  result.getContext('2d').putImageData(output, 0, 0);
  return new Promise((resolve, reject) => result.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/png'));
}
