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
  const lips = clamp(params.lips ?? 0, 0, 1); // beauty: fuller lips
  const hair = clamp(params.hair ?? 0, 0, 1);
  const cheeks = clamp(params.cheeks ?? 0, 0, 1);
  const headBulges = [], featureBulges = [], fields = [];
  let squashFrom = null;
  const centers = faces.map((f) => [f.x, f.y - f.h * 0.12]);
  faces.forEach((f, i) => {
    const size = Math.max(f.w, f.h);
    const [re, le, , rm, lm] = f.landmarks;
    const eyeDist = Math.hypot(le[0] - re[0], le[1] - re[1]) || size * 0.4;
    if (head > 0) {
      const [cx, cy] = centers[i];
      // Group photos: keep each head's enlargement circle away from its neighbours, so one
      // enlarged head never swallows the next person, and keep heads near an edge inside the frame.
      let r = size * 1.15;
      for (let j = 0; j < centers.length; j++) {
        if (j !== i) r = Math.min(r, 0.5 * Math.hypot(centers[j][0] - cx, centers[j][1] - cy));
      }
      r = Math.max(r, size * 0.55);
      const headRadius = 0.6 * size;
      const edge = Math.min(cx, width - cx, cy);
      const maxMag = Math.max(1, Math.min((edge + 0.15 * size) / headRadius, (0.95 * r) / headRadius));
      const amount = Math.min(0.42 * head, 1 - 1 / maxMag);
      if (amount > 0.005) headBulges.push({ x: cx, y: cy, r, amount });
    }
    if (eyes > 0) for (const e of [re, le]) featureBulges.push({ x: e[0], y: e[1], r: eyeDist * 0.5, amount: 0.38 * eyes });
    if (lips > 0) {
      const mouthW = Math.hypot(lm[0] - rm[0], lm[1] - rm[1]) || size * 0.35;
      featureBulges.push({ x: (rm[0] + lm[0]) / 2, y: (rm[1] + lm[1]) / 2 + mouthW * 0.08, r: mouthW * 0.75, amount: 0.25 * lips });
    }
    // Distance to the nearest other face, so group members' changes never collide.
    let nearest = Infinity;
    for (let j = 0; j < centers.length; j++) if (j !== i) nearest = Math.min(nearest, Math.hypot(centers[j][0] - centers[i][0], centers[j][1] - centers[i][1]));
    // Hair and cheeks use smooth outline-expansion fields (not bulges): the hair outline or the
    // cheek line moves outward while the face's interior (eyes, nose, mouth) is left untouched.
    const reach = Number.isFinite(nearest) ? nearest : Infinity;
    if (hair > 0) {
      const rx = f.w * 0.72, ry = f.h * 0.82;
      const eyeY = (re[1] + le[1]) / 2;
      // Outer falloff stops halfway to the nearest neighbour; amplitude shrinks if that is tight.
      const outer = clamp((0.5 * reach) / rx, 1.3, 2.2);
      const room = clamp((outer - 1.3) / (2.2 - 1.3), 0.35, 1);
      // Only above the eyebrows, so the sides of the face are never stretched.
      fields.push({ type: 'hair', cx: f.x, cy: f.y - f.h * 0.12, rx, ry, inner: 0.5, peak: 1.15, outer,
        amount: 0.24 * hair * room, fadeTop: eyeY - f.h * 0.3, fadeBottom: eyeY - f.h * 0.08 });
    }
    if (cheeks > 0) {
      const half = f.w * 0.5;
      const outer = clamp((0.5 * reach) / half, 1.35, 1.9);
      const room = clamp((outer - 1.35) / (1.9 - 1.35), 0.35, 1);
      fields.push({ type: 'cheeks', cx: f.x, half, inner: 0.42, peak: 0.98, outer, amount: 0.21 * cheeks * room,
        yTop: f.y - f.h * 0.1, yPeak: f.y + f.h * 0.22, yBottom: f.y + f.h * 0.62 });
    }
    if (chin > 0) {
      const mouthX = (rm[0] + lm[0]) / 2, mouthY = (rm[1] + lm[1]) / 2;
      featureBulges.push({ x: mouthX, y: mouthY + f.h * 0.18, r: f.w * 0.55, amount: -0.22 * chin });
    }
    const chinY = f.y + f.h * 0.5 + size * 0.25;
    squashFrom = squashFrom === null ? chinY : Math.max(squashFrom, chinY);
  });
  let outHeight = height;
  let k = 1;
  if (body > 0 && squashFrom !== null && squashFrom < height - 4) {
    k = 1 + 0.9 * body;
    outHeight = Math.max(1, Math.round(squashFrom + (height - squashFrom) / k));
  } else squashFrom = null;
  return { width, height: outHeight, headBulges, featureBulges, fields, squashFrom, k };
}

export function mapPoint(plan, x, y) {
  if (plan.squashFrom !== null && y > plan.squashFrom) y = plan.squashFrom + (y - plan.squashFrom) * plan.k;
  let p = [x, y];
  for (const b of plan.headBulges) p = bulgeInverse(p[0], p[1], b);
  for (const fld of plan.fields || []) p = fieldInverse(p[0], p[1], fld);
  for (const b of plan.featureBulges) p = bulgeInverse(p[0], p[1], b);
  return p;
}

// Weight that rises smoothly from 0 at `inner` to 1 at `peak`, then falls back to 0 at `outer`.
function band(rho, inner, peak, outer) {
  if (rho <= inner || rho >= outer) return 0;
  return rho < peak ? smoothstep((rho - inner) / (peak - inner)) : 1 - smoothstep((rho - peak) / (outer - peak));
}
const smoothstep = (t) => t * t * (3 - 2 * t);

// Outline expansion as an inverse map. Each output point samples the source a smooth distance
// D closer to the centre (D in units of the face ellipse), which moves the outline outward and
// gently thickens the band inside it. D's slope is kept below ~0.55, so texture is never
// stretched more than about 2x (no smearing); points well inside (`< inner`, the face) and far
// outside (`> outer`, beyond half the distance to a neighbour) do not move.
export function fieldInverse(px, py, f) {
  if (f.type === 'hair') {
    const dx = (px - f.cx) / f.rx, dy = (py - f.cy) / f.ry;
    const rho = Math.hypot(dx, dy);
    if (rho <= f.inner || rho >= f.outer || py >= f.fadeBottom) return [px, py];
    const up = py <= f.fadeTop ? 1 : 1 - smoothstep((py - f.fadeTop) / (f.fadeBottom - f.fadeTop));
    const s = (rho - f.amount * band(rho, f.inner, f.peak, f.outer) * up) / rho;
    return [f.cx + (px - f.cx) * s, f.cy + (py - f.cy) * s];
  }
  if (f.type === 'cheeks') {
    const u = Math.abs(px - f.cx) / f.half;
    if (u <= f.inner || u >= f.outer || py <= f.yTop || py >= f.yBottom) return [px, py];
    const v = py < f.yPeak ? smoothstep((py - f.yTop) / (f.yPeak - f.yTop)) : 1 - smoothstep((py - f.yPeak) / (f.yBottom - f.yPeak));
    const s = (u - f.amount * band(u, f.inner, f.peak, f.outer) * v) / u;
    return [f.cx + (px - f.cx) * s, py];
  }
  return [px, py];
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
export function decodeYuNet(outputs, { inputSize = 640, threshold = 0.5, nms = 0.3, scale = 1 } = {}) {
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

// ---- Beauty (美肌): skin smoothing, brighter skin, lip colour ----

// Mean over a (2r+1)^2 window with an integral image; edges use the available pixels.
function boxMean(src, w, h, r) {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

// Edge-preserving smoothing (self-guided filter, He et al., TPAMI 2013) of one channel.
function guidedSelf(channel, w, h, r, eps) {
  const sq = new Float32Array(channel.length);
  for (let i = 0; i < channel.length; i++) sq[i] = channel[i] * channel[i];
  const mean = boxMean(channel, w, h, r), meanSq = boxMean(sq, w, h, r);
  const a = new Float32Array(channel.length), b = new Float32Array(channel.length);
  for (let i = 0; i < channel.length; i++) {
    const v = meanSq[i] - mean[i] * mean[i];
    a[i] = v / (v + eps);
    b[i] = mean[i] - a[i] * mean[i];
  }
  const ma = boxMean(a, w, h, r), mb = boxMean(b, w, h, r);
  const out = new Float32Array(channel.length);
  for (let i = 0; i < channel.length; i++) out[i] = ma[i] * channel[i] + mb[i];
  return out;
}

const smooth01 = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

function ellipseWeight(x, y, cx, cy, rx, ry, feather = 0.35) {
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  return d >= 1 ? 0 : d <= 1 - feather ? 1 : 1 - smooth01(1 - feather, 1, d);
}

/** Skin and lip masks (0..1) for the detected faces. Skin excludes eyes and mouth and is
 *  weighted by a YCrCb skin-colour test so hair and background are left alone. */
export function beautyMasks(img, faces) {
  const { width: w, height: h, data } = img;
  const skin = new Float32Array(w * h), lips = new Float32Array(w * h);
  for (const f of faces) {
    const [re, le, , rm, lm] = f.landmarks;
    const eyeDist = Math.hypot(le[0] - re[0], le[1] - re[1]) || f.w * 0.4;
    const mouthW = Math.hypot(lm[0] - rm[0], lm[1] - rm[1]) || f.w * 0.35;
    const mx = (rm[0] + lm[0]) / 2, my = (rm[1] + lm[1]) / 2 + mouthW * 0.05;
    const rx = f.w * 0.56, ry = f.h * 0.66, cx = f.x, cy = f.y + f.h * 0.04;
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let face = ellipseWeight(x, y, cx, cy, rx, ry);
      if (!face) continue;
      const i = y * w + x, r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b, cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const skinTone = smooth01(128, 136, cr) * (1 - smooth01(175, 185, cr)) * smooth01(72, 80, cb) * (1 - smooth01(130, 138, cb));
      const eyes = Math.max(ellipseWeight(x, y, re[0], re[1], eyeDist * 0.32, eyeDist * 0.2, 0.5), ellipseWeight(x, y, le[0], le[1], eyeDist * 0.32, eyeDist * 0.2, 0.5));
      const lip = ellipseWeight(x, y, mx, my, mouthW * 0.68, mouthW * 0.36, 0.45);
      face *= skinTone * (1 - eyes) * (1 - lip);
      if (face > skin[i]) skin[i] = face;
      if (lip) {
        // Only reddish, saturated pixels (lips), never teeth or the inside of the mouth.
        const mx3 = Math.max(r, g, b), sat = mx3 ? (mx3 - Math.min(r, g, b)) / mx3 : 0;
        const v = lip * smooth01(1.12, 1.4, r / (g + 8)) * smooth01(0.18, 0.32, sat) * smooth01(40, 70, mx3);
        if (v > lips[i]) lips[i] = v;
      }
    }
  }
  return { skin, lips };
}

/** params: { smooth, brighten, lips } each 0..1. Returns a new image. */
export function applyBeauty(img, faces, params) {
  const smoothAmt = clamp(params.smooth ?? 0, 0, 1), bright = clamp(params.brighten ?? 0, 0, 1), lipAmt = clamp(params.lips ?? 0, 0, 1);
  if (!faces.length || (smoothAmt <= 0 && bright <= 0 && lipAmt <= 0)) return img;
  const { width: w, height: h, data } = img;
  const { skin, lips } = beautyMasks(img, faces);
  const out = makeImage(w, h, new Uint8ClampedArray(data));
  const o = out.data;
  if (smoothAmt > 0) {
    const faceSize = faces.reduce((m, f) => Math.max(m, f.w), 0);
    const r = Math.max(2, Math.round(faceSize * (0.025 + 0.03 * smoothAmt)));
    const eps = (12 + 30 * smoothAmt) ** 2;
    for (let c = 0; c < 3; c++) {
      const ch = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) ch[i] = data[i * 4 + c];
      const sm = guidedSelf(ch, w, h, r, eps);
      for (let i = 0; i < w * h; i++) {
        const m = skin[i] * smoothAmt * 0.9;
        if (m > 0) o[i * 4 + c] = ch[i] + (sm[i] - ch[i]) * m;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (bright > 0 && skin[i] > 0) {
      const m = skin[i] * bright;
      o[p] = o[p] + (255 - o[p]) * 0.22 * m;
      o[p + 1] = o[p + 1] + (255 - o[p + 1]) * 0.2 * m;
      o[p + 2] = o[p + 2] + (255 - o[p + 2]) * 0.2 * m;
    }
    if (lipAmt > 0 && lips[i] > 0) {
      const r = o[p], g = o[p + 1], b = o[p + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const scale = (y * 1.05) / (0.299 * 205 + 0.587 * 45 + 0.114 * 75);
      const m = lips[i] * lipAmt * 0.65;
      o[p] = r + (205 * scale - r) * m;
      o[p + 1] = g + (45 * scale - g) * m;
      o[p + 2] = b + (75 * scale - b) * m;
    }
  }
  return out;
}

/** Beauty on the face regions only (much faster on large images): same result as applyBeauty. */
export function applyBeautyROI(img, faces, params) {
  if (!faces.length) return img;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of faces) {
    x0 = Math.min(x0, f.x - f.w * 0.8); x1 = Math.max(x1, f.x + f.w * 0.8);
    y0 = Math.min(y0, f.y - f.h * 0.9); y1 = Math.max(y1, f.y + f.h * 0.9);
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(img.width, Math.ceil(x1)); y1 = Math.min(img.height, Math.ceil(y1));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return img;
  const crop = makeImage(w, h);
  for (let y = 0; y < h; y++) crop.data.set(img.data.subarray(((y + y0) * img.width + x0) * 4, ((y + y0) * img.width + x0 + w) * 4), y * w * 4);
  const shifted = faces.map((f) => ({ ...f, x: f.x - x0, y: f.y - y0, landmarks: f.landmarks.map(([px, py]) => [px - x0, py - y0]) }));
  const done = applyBeauty(crop, shifted, params);
  if (done === crop) return img;
  const out = makeImage(img.width, img.height, new Uint8ClampedArray(img.data));
  for (let y = 0; y < h; y++) out.data.set(done.data.subarray(y * w * 4, (y + 1) * w * 4), ((y + y0) * img.width + x0) * 4);
  return out;
}

/** Scale face boxes and landmarks by s (to reuse detections at another resolution). */
export function scaleFaces(faces, s) {
  return faces.map((f) => ({ ...f, x: f.x * s, y: f.y * s, w: f.w * s, h: f.h * s, landmarks: f.landmarks.map(([x, y]) => [x * s, y * s]) }));
}

function luminance(img) {
  const out = new Float32Array(img.width * img.height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = (0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2]) / 255;
  return out;
}

/**
 * Guided upsampling (Fast Guided Filter: He & Sun 2015; Wu et al., CVPR 2018 — the same idea as
 * White-box Cartoonization's fast_guided_filter). The stylised low-resolution result `low` is
 * explained locally as a linear function of the low-resolution guide (the photo the model saw);
 * those coefficients are upsampled and applied to the full-resolution photo `guideHigh`, so the
 * output keeps the style's colours and shading while edges come out sharp at full resolution.
 * eps (0..1 scale) controls how much fine photo detail returns: larger = smoother, more painterly.
 */
export function guidedUpsample(low, guideLow, guideHigh, { radius = 2, eps = 4e-3 } = {}) {
  const wl = low.width, hl = low.height;
  const gl = guideLow.width === wl && guideLow.height === hl ? luminance(guideLow) : null;
  if (!gl) throw new Error('guideLow must match low');
  const W = guideHigh.width, H = guideHigh.height;
  const gh = guideHigh.data;
  const out = makeImage(W, H);
  const meanI = boxMean(gl, wl, hl, radius);
  const ii = new Float32Array(gl.length);
  for (let i = 0; i < gl.length; i++) ii[i] = gl[i] * gl[i];
  const varI = boxMean(ii, wl, hl, radius);
  for (let i = 0; i < gl.length; i++) varI[i] -= meanI[i] * meanI[i];
  const coeffs = [];
  for (let c = 0; c < 3; c++) {
    const S = new Float32Array(gl.length), IS = new Float32Array(gl.length);
    for (let i = 0; i < gl.length; i++) { S[i] = low.data[i * 4 + c] / 255; IS[i] = S[i] * gl[i]; }
    const meanS = boxMean(S, wl, hl, radius), meanIS = boxMean(IS, wl, hl, radius);
    const a = new Float32Array(gl.length), b = new Float32Array(gl.length);
    for (let i = 0; i < gl.length; i++) {
      a[i] = (meanIS[i] - meanI[i] * meanS[i]) / (varI[i] + eps);
      b[i] = meanS[i] - a[i] * meanI[i];
    }
    coeffs.push([boxMean(a, wl, hl, radius), boxMean(b, wl, hl, radius)]);
  }
  const sx = wl / W, sy = hl / H;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(hl - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(hl - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(wl - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(wl - 1, x0 + 1), tx = fx - x0;
      const i00 = y0 * wl + x0, i10 = y0 * wl + x1, i01 = y1 * wl + x0, i11 = y1 * wl + x1;
      const p = (y * W + x) * 4;
      const I = (0.299 * gh[p] + 0.587 * gh[p + 1] + 0.114 * gh[p + 2]) / 255;
      for (let c = 0; c < 3; c++) {
        const [A, B] = coeffs[c];
        const a = (A[i00] * (1 - tx) + A[i10] * tx) * (1 - ty) + (A[i01] * (1 - tx) + A[i11] * tx) * ty;
        const b = (B[i00] * (1 - tx) + B[i10] * tx) * (1 - ty) + (B[i01] * (1 - tx) + B[i11] * tx) * ty;
        out.data[p + c] = (a * I + b) * 255;
      }
      out.data[p + 3] = 255;
    }
  }
  return out;
}
