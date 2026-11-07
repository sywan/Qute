// Pure pixel operations on ImageData-like objects ({ width, height, data: Uint8ClampedArray }).
// Kept free of DOM APIs so they can be unit-tested in Node.

export function makeImage(width, height, data) {
  return { width, height, data: data || new Uint8ClampedArray(width * height * 4) };
}

function sample(src, x, y, out, o) {
  const { width: w, height: h, data } = src;
  x = Math.min(w - 1, Math.max(0, x));
  y = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * fx;
    const bottom = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * fx;
    out[o + c] = top + (bottom - top) * fy;
  }
}

// Radial bulge (amount > 0 enlarges, amount < 0 shrinks) expressed as an inverse map:
// output point p -> source point q. r_src = r * (1 - a + a t^2), t = r / R. Monotonic for a in (-0.5, 1).
export function bulgeInverse(px, py, b) {
  const dx = px - b.x, dy = py - b.y;
  const r2 = dx * dx + dy * dy;
  if (r2 >= b.r * b.r) return [px, py];
  const t2 = r2 / (b.r * b.r);
  const s = 1 - b.amount + b.amount * t2;
  return [b.x + dx * s, b.y + dy * s];
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Build the warp plan (bulges + body squash) from detected faces and user parameters.
// faces: [{ x, y, w, h, landmarks: [[rex,rey],[lex,ley],[nx,ny],[rmx,rmy],[lmx,lmy]] }] in image pixels.
// params: { head: 0..1, eyes: 0..1, chin: 0..1, body: 0..1 }
export function planChibiWarp(faces, params, width, height) {
  const head = clamp(params.head ?? 0, 0, 1);
  const eyes = clamp(params.eyes ?? 0, 0, 1);
  const chin = clamp(params.chin ?? 0, 0, 1);
  const body = clamp(params.body ?? 0, 0, 1);
  const headBulges = [], featureBulges = [];
  let squashFrom = null;
  for (const f of faces) {
    const size = Math.max(f.w, f.h);
    const [re, le, , rm, lm] = f.landmarks;
    const eyeDist = Math.hypot(le[0] - re[0], le[1] - re[1]) || size * 0.4;
    if (head > 0) headBulges.push({ x: f.x, y: f.y - f.h * 0.12, r: size * 1.15, amount: 0.42 * head });
    if (eyes > 0) for (const e of [re, le]) featureBulges.push({ x: e[0], y: e[1], r: eyeDist * 0.5, amount: 0.38 * eyes });
    if (chin > 0) {
      const mouthX = (rm[0] + lm[0]) / 2, mouthY = (rm[1] + lm[1]) / 2;
      featureBulges.push({ x: mouthX, y: mouthY + f.h * 0.18, r: f.w * 0.55, amount: -0.22 * chin });
    }
    const chinY = f.y + f.h * 0.5 + size * 0.25;
    squashFrom = squashFrom === null ? chinY : Math.max(squashFrom, chinY);
  }
  let outHeight = height;
  let k = 1;
  if (body > 0 && squashFrom !== null && squashFrom < height - 4) {
    k = 1 + 0.9 * body;
    outHeight = Math.max(1, Math.round(squashFrom + (height - squashFrom) / k));
  } else squashFrom = null;
  return { width, height: outHeight, headBulges, featureBulges, squashFrom, k };
}

export function mapPoint(plan, x, y) {
  if (plan.squashFrom !== null && y > plan.squashFrom) y = plan.squashFrom + (y - plan.squashFrom) * plan.k;
  let p = [x, y];
  for (const b of plan.headBulges) p = bulgeInverse(p[0], p[1], b);
  for (const b of plan.featureBulges) p = bulgeInverse(p[0], p[1], b);
  return p;
}

export function applyWarp(src, plan) {
  const out = makeImage(plan.width, plan.height);
  const px = new Float32Array(4);
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const [sx, sy] = mapPoint(plan, x + 0.5, y + 0.5);
      sample(src, sx - 0.5, sy - 0.5, px, 0);
      const o = (y * plan.width + x) * 4;
      out.data[o] = px[0]; out.data[o + 1] = px[1]; out.data[o + 2] = px[2]; out.data[o + 3] = 255;
    }
  }
  return out;
}

// Forward-map a source point into output space by fixed-point iteration on the inverse map.
export function forwardPoint(plan, sx, sy) {
  let x = sx, y = sy;
  for (let i = 0; i < 30; i++) {
    const [mx, my] = mapPoint(plan, x, y);
    const ex = sx - mx, ey = sy - my;
    x += ex; y += ey;
    if (Math.abs(ex) + Math.abs(ey) < 0.05) break;
  }
  return [x, y];
}

// Face boxes and landmarks expressed in the warped image's coordinates.
export function mapFaces(faces, plan) {
  return faces.map((f) => {
    const [x, y] = forwardPoint(plan, f.x, f.y);
    const [lx] = forwardPoint(plan, f.x - f.w / 2, f.y);
    const [rx] = forwardPoint(plan, f.x + f.w / 2, f.y);
    const [, ty] = forwardPoint(plan, f.x, f.y - f.h / 2);
    const [, by] = forwardPoint(plan, f.x, f.y + f.h / 2);
    return { ...f, x, y, w: rx - lx, h: by - ty, landmarks: f.landmarks.map(([px, py]) => forwardPoint(plan, px, py)) };
  });
}

// ---- colour: sRGB <-> CIELAB (D65) for Reinhard-style palette transfer ----
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);

export function rgbToLab(r, g, b) {
  r = srgbToLin(r / 255); g = srgbToLin(g / 255); b = srgbToLin(b / 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToRgb(L, A, B) {
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const x = fi(fx) * 0.95047, y = fi(fy), z = fi(fz) * 1.08883;
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const b = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [r, g, b].map((c) => clamp(Math.round(linToSrgb(clamp(c, 0, 1)) * 255), 0, 255));
}

function labStats(img, step = 1) {
  const sum = [0, 0, 0], sq = [0, 0, 0];
  let n = 0;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4 * step) {
    const lab = rgbToLab(d[i], d[i + 1], d[i + 2]);
    for (let c = 0; c < 3; c++) { sum[c] += lab[c]; sq[c] += lab[c] * lab[c]; }
    n++;
  }
  const mean = sum.map((s) => s / n);
  const std = sq.map((s, c) => Math.sqrt(Math.max(1e-6, s / n - mean[c] * mean[c])));
  return { mean, std };
}

// Transfer the reference's colour statistics onto img. amount 0..1. Luminance is moved less than
// chroma so faces keep their shading.
export function paletteTransfer(img, reference, amount = 1) {
  if (amount <= 0) return img;
  const a = labStats(img, 1), b = labStats(reference, Math.max(1, Math.floor(reference.data.length / 4 / 40000)));
  const weights = [0.5 * amount, amount, amount];
  const out = makeImage(img.width, img.height);
  const d = img.data, o = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const lab = rgbToLab(d[i], d[i + 1], d[i + 2]);
    for (let c = 0; c < 3; c++) {
      const ratio = clamp(b.std[c] / a.std[c], 0.4, 2.5);
      const moved = (lab[c] - a.mean[c]) * ratio + b.mean[c];
      lab[c] = lab[c] + (moved - lab[c]) * weights[c];
    }
    const rgb = labToRgb(lab[0], lab[1], lab[2]);
    o[i] = rgb[0]; o[i + 1] = rgb[1]; o[i + 2] = rgb[2]; o[i + 3] = 255;
  }
  return out;
}

// Soft elliptical mask (0..1) over faces, used for face protection.
export function faceMask(width, height, faces, scale = 1.35) {
  const mask = new Float32Array(width * height);
  for (const f of faces) {
    const rx = (f.w / 2) * scale, ry = (f.h / 2) * scale * 1.1;
    const x0 = Math.max(0, Math.floor(f.x - rx)), x1 = Math.min(width - 1, Math.ceil(f.x + rx));
    const y0 = Math.max(0, Math.floor(f.y - ry)), y1 = Math.min(height - 1, Math.ceil(f.y + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x - f.x) / rx, ny = (y - f.y) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      const v = d < 0.6 ? 1 : d < 1 ? 1 - (d - 0.6) / 0.4 : 0;
      const i = y * width + x;
      if (v > mask[i]) mask[i] = v * v * (3 - 2 * v);
    }
  }
  return mask;
}

// out = a*(1-w) + b*w, where w = amount (scalar) or amount * mask[i].
export function blend(a, b, amount, mask) {
  const out = makeImage(a.width, a.height);
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const w = mask ? amount * mask[i] : amount;
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = a.data[i * 4 + c] * (1 - w) + b.data[i * 4 + c] * w;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

// Gentle "cute" grade: lift saturation and brightness slightly, soften contrast.
export function cuteGrade(img, amount = 1) {
  if (amount <= 0) return img;
  const out = makeImage(img.width, img.height);
  const sat = 1 + 0.25 * amount, lift = 10 * amount, con = 1 - 0.08 * amount;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    for (let c = 0; c < 3; c++) {
      const v = img.data[i + c];
      out.data[i + c] = ((gray + (v - gray) * sat) - 128) * con + 128 + lift;
    }
    out.data[i + 3] = 255;
  }
  return out;
}

// ---- YuNet decoding (OpenCV FaceDetectorYN, 2023mar, 640x640 input) ----
export function decodeYuNet(outputs, { inputSize = 640, threshold = 0.6, nms = 0.3, scale = 1 } = {}) {
  const dets = [];
  for (const stride of [8, 16, 32]) {
    const cols = inputSize / stride;
    const cls = outputs['cls_' + stride], obj = outputs['obj_' + stride];
    const bbox = outputs['bbox_' + stride], kps = outputs['kps_' + stride];
    const n = cls.length;
    for (let i = 0; i < n; i++) {
      const score = Math.sqrt(clamp(cls[i], 0, 1) * clamp(obj[i], 0, 1));
      if (score < threshold) continue;
      const r = Math.floor(i / cols), c = i % cols;
      const cx = (c + bbox[i * 4]) * stride, cy = (r + bbox[i * 4 + 1]) * stride;
      const w = Math.exp(bbox[i * 4 + 2]) * stride, h = Math.exp(bbox[i * 4 + 3]) * stride;
      const landmarks = [];
      for (let k = 0; k < 5; k++) landmarks.push([((kps[i * 10 + 2 * k] + c) * stride) / scale, ((kps[i * 10 + 2 * k + 1] + r) * stride) / scale]);
      dets.push({ score, x: cx / scale, y: cy / scale, w: w / scale, h: h / scale, landmarks });
    }
  }
  dets.sort((p, q) => q.score - p.score);
  const keep = [];
  for (const d of dets) {
    if (keep.every((k) => iou(k, d) < nms)) keep.push(d);
  }
  return keep;
}

export function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2));
  const iy = Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter);
}
