export const defaultCameraSettings = { mirror: false, brightness: 100, contrast: 100, saturation: 100 };

export const cameraPresets = {
  natural: { brightness: 100, contrast: 100, saturation: 100 },
  bright: { brightness: 118, contrast: 105, saturation: 105 },
  vivid: { brightness: 105, contrast: 112, saturation: 130 },
  soft: { brightness: 108, contrast: 88, saturation: 90 }
};

export function cameraFilter(settings) {
  return `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`;
}

export function renderCameraFrame(video, canvas, settings) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return false;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.save();
  if (settings.mirror) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  if ('filter' in context) context.filter = cameraFilter(settings);
  context.drawImage(video, 0, 0, width, height);
  context.restore();
  if (!('filter' in context)) {
    const image = context.getImageData(0, 0, width, height);
    const { data } = image;
    const brightness = settings.brightness / 100;
    const contrast = settings.contrast / 100;
    const saturation = settings.saturation / 100;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] * brightness;
      const g = data[i + 1] * brightness;
      const b = data[i + 2] * brightness;
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = Math.max(0, Math.min(255, ((gray + (r - gray) * saturation) - 128) * contrast + 128));
      data[i + 1] = Math.max(0, Math.min(255, ((gray + (g - gray) * saturation) - 128) * contrast + 128));
      data[i + 2] = Math.max(0, Math.min(255, ((gray + (b - gray) * saturation) - 128) * contrast + 128));
    }
    context.putImageData(image, 0, 0);
  }
  return true;
}
