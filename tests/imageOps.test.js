import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWarp, blend, bulgeInverse, decodeYuNet, faceMask, forwardPoint, labToRgb, makeImage, mapFaces, mapPoint, paletteTransfer, planChibiWarp, rgbToLab } from '../src/engines/imageOps.js';

const face = { x: 100, y: 100, w: 60, h: 70, landmarks: [[88, 90], [112, 90], [100, 102], [90, 115], [110, 115]] };

test('bulge enlarges the centre, keeps the boundary and is monotonic', () => {
  const b = { x: 0, y: 0, r: 100, amount: 0.4 };
  assert.deepEqual(bulgeInverse(150, 0, b), [150, 0]);
  assert.ok(Math.abs(bulgeInverse(100, 0, b)[0] - 100) < 1e-9);
  assert.ok(bulgeInverse(10, 0, b)[0] < 10);
  let prev = -1;
  for (let r = 0; r <= 100; r++) { const s = bulgeInverse(r, 0, b)[0]; assert.ok(s >= prev); prev = s; }
});

test('chibi plan shortens the body below the lowest chin and leaves the head row intact', () => {
  const plan = planChibiWarp([face], { head: 1, eyes: 1, chin: 0.5, body: 1 }, 200, 400);
  assert.ok(plan.height < 400);
  assert.ok(plan.squashFrom > face.y);
  assert.equal(plan.headBulges.length, 1);
  assert.equal(plan.featureBulges.length, 3);
  const [, sy] = mapPoint(plan, 100, plan.height - 1);
  assert.ok(sy > 380, 'bottom output row samples the original bottom');
});

test('zero parameters give an identity warp', () => {
  const src = makeImage(8, 6);
  for (let i = 0; i < src.data.length; i++) src.data[i] = (i * 37) % 256;
  for (let i = 3; i < src.data.length; i += 4) src.data[i] = 255;
  const plan = planChibiWarp([face], { head: 0, eyes: 0, chin: 0, body: 0 }, 8, 6);
  const out = applyWarp(src, plan);
  assert.deepEqual([...out.data], [...src.data]);
});

test('forwardPoint inverts mapPoint and mapped faces grow with head enlargement', () => {
  const plan = planChibiWarp([face], { head: 1, eyes: 0, chin: 0, body: 0.5 }, 200, 400);
  const [x, y] = forwardPoint(plan, 100, 120);
  const [mx, my] = mapPoint(plan, x, y);
  assert.ok(Math.abs(mx - 100) < 0.2 && Math.abs(my - 120) < 0.2);
  const [mapped] = mapFaces([face], plan);
  assert.ok(mapped.w > face.w * 1.2);
});

test('Lab conversion round-trips', () => {
  for (const rgb of [[0, 0, 0], [255, 255, 255], [200, 120, 40], [12, 200, 180]]) {
    const back = labToRgb(...rgbToLab(...rgb));
    back.forEach((v, i) => assert.ok(Math.abs(v - rgb[i]) <= 1, `${rgb} -> ${back}`));
  }
});

test('palette transfer moves colour toward the reference', () => {
  const img = makeImage(4, 4), ref = makeImage(4, 4);
  for (let i = 0; i < 64; i += 4) { img.data.set([120 + (i % 8), 120, 120, 255], i); ref.data.set([230, 150 + (i % 8), 190, 255], i); }
  const out = paletteTransfer(img, ref, 1);
  assert.ok(out.data[0] > 150 && out.data[0] > out.data[1], 'shifted toward pink');
});

test('face mask is 1 at the centre and 0 far away; blend uses it', () => {
  const m = faceMask(200, 200, [face]);
  assert.equal(m[100 * 200 + 100], 1);
  assert.equal(m[5 * 200 + 5], 0);
  const a = makeImage(200, 200), b = makeImage(200, 200);
  b.data.fill(200);
  const out = blend(a, b, 1, m);
  assert.equal(out.data[(100 * 200 + 100) * 4], 200);
  assert.equal(out.data[(5 * 200 + 5) * 4], 0);
});

test('YuNet decoding produces boxes, landmarks and NMS', () => {
  const outputs = {};
  for (const s of [8, 16, 32]) {
    const n = (640 / s) ** 2;
    outputs['cls_' + s] = new Float32Array(n); outputs['obj_' + s] = new Float32Array(n);
    outputs['bbox_' + s] = new Float32Array(n * 4); outputs['kps_' + s] = new Float32Array(n * 10);
  }
  const idx = 10 * 20 + 5; // stride 32, row 10, col 5
  for (const i of [idx, idx + 1]) { outputs.cls_32[i] = 0.9; outputs.obj_32[i] = 0.9; outputs.bbox_32.set([0.5, 0.5, Math.log(3), Math.log(3)], i * 4); }
  const faces = decodeYuNet(outputs, { scale: 2 });
  assert.equal(faces.length, 1);
  assert.ok(Math.abs(faces[0].x - 5.5 * 32 / 2) < 1e-6 && Math.abs(faces[0].w - 48) < 1e-6);
  assert.equal(faces[0].landmarks.length, 5);
});

test('group photos: head circles never overlap and edge heads stay in frame', () => {
  const mk = (x) => ({ x, y: 100, w: 60, h: 70, landmarks: [[x - 12, 90], [x + 12, 90], [x, 102], [x - 10, 115], [x + 10, 115]] });
  const faces = [mk(40), mk(120), mk(200), mk(280)]; // shoulder to shoulder, first one near the left edge
  const plan = planChibiWarp(faces, { head: 1, eyes: 0, chin: 0, body: 0 }, 320, 300);
  const hb = plan.headBulges;
  for (let i = 1; i < hb.length; i++) assert.ok(hb[i - 1].r + hb[i].r <= hb[i].x - hb[i - 1].x + 1e-6, 'circles ' + (i - 1) + '/' + i + ' overlap');
  const edgeHead = hb.find((b) => b.x === 40);
  assert.ok(!edgeHead || edgeHead.amount < hb.find((b) => b.x === 120).amount + 1e-9, 'edge head enlarged no more than inner ones');
  // a lone face keeps the full effect
  const solo = planChibiWarp([mk(160)], { head: 1, eyes: 0, chin: 0, body: 0 }, 320, 300).headBulges[0];
  assert.ok(Math.abs(solo.amount - 0.42) < 1e-9 && Math.abs(solo.r - 70 * 1.15) < 1e-9);
});

test('beauty: smoothing only touches skin, lips turn redder, nothing without faces', async () => {
  const { applyBeauty, beautyMasks } = await import('../src/engines/imageOps.js');
  const w = 200, h = 200, img = makeImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = ((x * 37 + y * 91) % 17) - 8; // fine "skin texture" noise
    img.data.set([200 + n, 150 + n, 130 + n, 255], (y * w + x) * 4);
  }
  for (let y = 115; y < 125; y++) for (let x = 85; x < 115; x++) img.data.set([170, 90, 90, 255], (y * w + x) * 4); // lips
  const face = { x: 100, y: 100, w: 80, h: 95, landmarks: [[85, 85], [115, 85], [100, 100], [88, 120], [112, 120]] };
  const { skin, lips } = beautyMasks(img, [face]);
  assert.ok(skin[100 * w + 70] > 0.5 && skin[5 * w + 5] === 0 && skin[120 * w + 100] < 0.2);
  assert.ok(lips[120 * w + 100] > 0.5);
  img.data.set([235, 230, 225, 255], (118 * w + 95) * 4); // a 'tooth' pixel inside the mouth
  assert.equal(beautyMasks(img, [face]).lips[118 * w + 95], 0, 'teeth are not tinted');
  const out = applyBeauty(img, [face], { smooth: 1, brighten: 0.5, lips: 1 });
  const variance = (im) => { let s = 0, s2 = 0, n = 0; for (let y = 95; y < 110; y++) for (let x = 65; x < 80; x++) { const v = im.data[(y * w + x) * 4]; s += v; s2 += v * v; n++; } return s2 / n - (s / n) ** 2; };
  assert.ok(variance(out) < variance(img) * 0.5, 'skin texture smoothed');
  assert.ok(out.data[(100 * w + 70) * 4 + 1] > img.data[(100 * w + 70) * 4 + 1], 'skin brightened');
  assert.ok(out.data[(120 * w + 100) * 4 + 1] < img.data[(120 * w + 100) * 4 + 1], 'lips redder (less green)');
  assert.deepEqual([...out.data.slice(0, 8)], [...img.data.slice(0, 8)], 'background untouched');
  assert.equal(applyBeauty(img, [], { smooth: 1 }), img);
});
