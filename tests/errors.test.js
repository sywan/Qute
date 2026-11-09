import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, slowAfter } from '../src/engines/errors.js';

test('errors become actionable messages', () => {
  assert.equal(classifyError(Object.assign(new Error('x'), { code: 'serverMissing' })).key, 'serverMissing');
  assert.equal(classifyError(Object.assign(new Error('Cancelled'), { name: 'AbortError' })).key, 'cancelled');
  const mem = classifyError(new RangeError('Array buffer allocation failed'));
  assert.deepEqual([mem.key, mem.hint], ['failedMemory', 'hintMemory']);
  assert.equal(classifyError(new Error('failed to load model: 404')).key, 'failedModel');
  assert.equal(classifyError(new Error('no available backend found')).key, 'failedBrowser');
  assert.equal(classifyError(new Error('boom'), { engineKind: 'server' }).key, 'serverFailed');
  assert.equal(classifyError(new Error('boom')).key, 'failed');
  assert.match(classifyError(new TypeError('Failed to fetch'), { step: 'stylizing' }).detail, /TypeError: Failed to fetch/);
  assert.ok(slowAfter('serverWorking', 'server') > slowAfter('warping', 'browser'));
});
