import assert from 'node:assert/strict';
import test from 'node:test';
import { goals, settingsForGoal, withReference, withServerEngines } from '../src/engines/registry.js';
import { describePipeline, formatStep } from '../src/engines/summary.js';
import { messages } from '../src/i18n.js';

const t = (k) => messages.en[k];
const text = (settings, opts) => describePipeline(settings, opts).map((s) => formatStep(s, t, (id) => t('engine_' + id)));

test('custom goal starts with everything off', () => {
  const s = settingsForGoal('custom', { hasReference: true });
  assert.equal(s.engine, 'photo');
  assert.deepEqual(text(s, { hasReference: true }), ['Nothing is turned on: the result will equal the photo']);
});

test('the user example: chibi + own reference + White-box, no server', () => {
  const s = { ...settingsForGoal('chibi', { hasReference: true }), engine: 'whitebox' };
  assert.deepEqual(text(s, { hasReference: true }), [
    'Face changes: bigger head 100%, bigger eyes 80%, smaller chin 60%, shorter body 80%',
    'White-box Cartoonization',
    'Reference colours 50%',
    'Soft bright grade 40%'
  ]);
});

test('bold with a reference lists brushwork with face protection', () => {
  const steps = text(settingsForGoal('bold', { hasReference: true }), { hasReference: true });
  assert.deepEqual(steps, ['AnimeGANv3 · Shinkai', 'Reference brushwork 70%, face protection 70%', 'Reference colours 60%']);
});

test('server engines: warnings when not connected, extras when connected', () => {
  const s = { ...settingsForGoal('custom'), engine: 'vtoonify', variant: 'pixar', styleDegree: 0.3, warp: { head: 1, eyes: 0, chin: 0, body: 0 } };
  const off = text(s, {});
  assert.match(off[0], /needs your server/);
  assert.ok(off.includes('(face-change sliders are not used by server algorithms)'));
  assert.ok(text(s, { serverEngines: ['vtoonify'] }).includes('VToonify on your server (Pixar-like, Style degree 30%)'));
});

test('toggling a reference keeps other Advanced edits', () => {
  const edited = { ...settingsForGoal('cute'), engine: 'whitebox', cute: 0.1 };
  const on = withReference(edited, 'cute', true);
  assert.equal(on.engine, 'whitebox'); assert.equal(on.cute, 0.1); assert.equal(on.palette, goals.cute.reference.palette);
  const off = withReference({ ...on, engine: 'magenta' }, 'cute', false);
  assert.equal(off.palette, 0); assert.equal(off.engine, 'animeganv3-hayao', 'magenta needs a reference');
});

test('server connect switches chibi to InstantID only if the algorithm was untouched', () => {
  const chibi = settingsForGoal('chibi');
  assert.equal(withServerEngines(chibi, 'chibi', ['instantid-chibi']).engine, 'instantid-chibi');
  const picked = { ...chibi, engine: 'whitebox' };
  assert.equal(withServerEngines(picked, 'chibi', ['instantid-chibi']).engine, 'whitebox');
  const back = withServerEngines({ ...chibi, engine: 'instantid-chibi' }, 'chibi', []);
  assert.equal(back.engine, 'animeganv3-hayao'); assert.equal(back.warp.head, 1);
});
