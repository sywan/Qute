import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraFilter, defaultCameraSettings, renderCameraFrame } from '../src/cameraEffects.js';

test('camera capture mirrors and applies the same adjustments as preview', () => {
  const calls = [];
  const context = {
    filter: 'none',
    save: () => calls.push('save'),
    translate: (...args) => calls.push(['translate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    drawImage: (...args) => calls.push(['drawImage', context.filter, ...args]),
    restore: () => calls.push('restore')
  };
  const canvas = { getContext: () => context };
  const video = { videoWidth: 640, videoHeight: 480 };
  const settings = { mirror: true, brightness: 120, contrast: 110, saturation: 90 };

  assert.equal(renderCameraFrame(video, canvas, settings), true);
  assert.deepEqual([canvas.width, canvas.height], [640, 480]);
  assert.deepEqual(calls, ['save', ['translate', 640, 0], ['scale', -1, 1], ['drawImage', cameraFilter(settings), video, 0, 0, 640, 480], 'restore']);
});

test('camera capture waits for a real frame', () => {
  const canvas = { getContext: () => { throw new Error('must not draw'); } };
  assert.equal(renderCameraFrame({ videoWidth: 0, videoHeight: 0 }, canvas, defaultCameraSettings), false);
});
