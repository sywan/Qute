// Accept more photo formats than the browser can show by itself.
// 1. Try the browser's own decoder (covers JPEG, PNG, WebP, GIF, BMP, ICO, SVG, AVIF, and on
//    Safari also HEIC/HEIF, TIFF and JPEG XL).
// 2. If that fails, convert in the browser: TIFF via UTIF.js, HEIC/HEIF via libheif (WebAssembly).
//    Both decoders are loaded only when such a file is opened. Nothing is uploaded.

export const MAX_FILE_MB = 60;
export const MAX_PIXELS = 40e6; // larger images are scaled down while converting
export const ACCEPT = [
  'image/*', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.png', '.apng', '.webp', '.gif', '.bmp', '.dib', '.ico', '.svg',
  '.avif', '.heic', '.heif', '.hif', '.heics', '.tif', '.tiff', '.jxl'
].join(',');

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'mif2'];
const AVIF_BRANDS = ['avif', 'avis'];
const EXTENSIONS = {
  jpeg: ['jpg', 'jpeg', 'jfif', 'pjpeg'], png: ['png', 'apng'], webp: ['webp'], gif: ['gif'], bmp: ['bmp', 'dib'],
  ico: ['ico'], svg: ['svg'], avif: ['avif'], heic: ['heic', 'heif', 'hif', 'heics'], tiff: ['tif', 'tiff'], jxl: ['jxl']
};

const ascii = (bytes, start, end) => String.fromCharCode(...bytes.slice(start, end));

/** Identify a file from its first bytes, falling back to MIME type and extension. */
export function sniffFormat(bytes, name = '', type = '') {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'GIF8') return 'gif';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return 'tiff';
  if (b[0] === 0xff && b[1] === 0x0a) return 'jxl';
  if (ascii(b, 4, 12) === 'JXL \r\n\x87\n') return 'jxl';
  if (ascii(b, 4, 8) === 'ftyp') {
    const size = Math.min(b.length, ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0 || 32);
    const brands = [ascii(b, 8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(b, i, i + 4));
    const generic = ['mif1', 'msf1', 'mif2'];
    if (AVIF_BRANDS.includes(brands[0])) return 'avif';
    if (HEIF_BRANDS.includes(brands[0]) && !generic.includes(brands[0])) return 'heic';
    if (brands.some((x) => AVIF_BRANDS.includes(x))) return 'avif';
    if (brands.some((x) => HEIF_BRANDS.includes(x))) return 'heic';
  }
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  const head = ascii(b, 0, Math.min(b.length, 256)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const [format, exts] of Object.entries(EXTENSIONS)) if (exts.includes(ext)) return format;
  if (type.includes('heic') || type.includes('heif')) return 'heic';
  if (type.includes('tiff')) return 'tiff';
  return 'unknown';
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => (image.naturalWidth ? resolve(image) : reject(new Error('empty image')));
    image.onerror = () => reject(new Error('browser cannot decode'));
    image.src = url;
  });
}

function rgbaToFile(rgba, width, height, name) {
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4), width, height), 0, 0);
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)));
  if (scale < 1) {
    const small = document.createElement('canvas');
    small.width = Math.round(width * scale);
    small.height = Math.round(height * scale);
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    canvas = small;
  }
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4 * 97) if (rgba[i] < 255) { opaque = false; break; }
  const type = opaque ? 'image/jpeg' : 'image/png';
  const outName = name.replace(/\.[^.]+$/, '') + (opaque ? '.jpg' : '.png');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(new File([blob], outName, { type })) : reject(new Error('export failed'))), type, 0.95));
}

async function decodeTiff(buffer, name) {
  const UTIF = (await import('utif')).default;
  const ifds = UTIF.decode(buffer).filter((ifd) => ifd.t256 && ifd.t257); // pages with width/height
  if (!ifds.length) throw new Error('no image in TIFF');
  // First full-size page (skip reduced-resolution thumbnails, NewSubfileType bit 0).
  const page = ifds.find((ifd) => !((ifd.t254?.[0] || 0) & 1)) || ifds[0];
  UTIF.decodeImage(buffer, page);
  const rgba = UTIF.toRGBA8(page);
  return rgbaToFile(rgba, page.width, page.height, name);
}

let heifPromise;
async function decodeHeic(buffer, name) {
  heifPromise ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then((m) => m.default());
  const libheif = await heifPromise;
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(buffer));
  if (!images?.length) throw new Error('no image in HEIF');
  const image = images[0]; // primary image (rotation/mirroring from the file are applied)
  const width = image.get_width(), height = image.get_height();
  const rgba = await new Promise((resolve, reject) => {
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (out) => (out ? resolve(out.data) : reject(new Error('HEIF decode failed'))));
  });
  images.forEach((img) => img.free?.());
  return rgbaToFile(rgba, width, height, name);
}

/**
 * Turn any supported image file into something every browser can display.
 * @returns {Promise<{ file: File, format: string, converted: boolean }>}
 * @throws Error with .code = 'tooLarge' | 'badFormat' | 'unsupportedFormat' (and .format)
 */
export async function normalizeImageFile(file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw Object.assign(new Error('too large'), { code: 'tooLarge' });
  const buffer = await file.arrayBuffer();
  const format = sniffFormat(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 512)), file.name, file.type);
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url); // native decoder first
    return { file, format, converted: false };
  } catch {
    /* fall through to converters */
  } finally {
    URL.revokeObjectURL(url);
  }
  try {
    if (format === 'tiff') return { file: await decodeTiff(buffer, file.name), format, converted: true };
    if (format === 'heic') return { file: await decodeHeic(buffer, file.name), format, converted: true };
  } catch (error) {
    console.error('Qute image conversion failed', error);
    throw Object.assign(new Error('decode failed'), { code: 'badFormat', format });
  }
  const unsupported = ['jxl', 'avif'].includes(format);
  throw Object.assign(new Error('unsupported'), { code: unsupported ? 'unsupportedFormat' : 'badFormat', format });
}
