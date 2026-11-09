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

test('custom engines advertised by a server are listed, labelled and cleared', async () => {
  const { setServerEngineInfo, engineById, engineLabel, defaultCustomParams, allEngines } = await import('../src/engines/registry.js');
  setServerEngineInfo([
    { id: 'dctnet', available: true },
    { id: 'example-sepia', available: true, label: { en: 'Sepia', 'zh-TW': '懷舊' }, params: [{ name: 'strength', type: 'number', min: 0, max: 1, default: 0.8 }, { name: 'bad', type: 'weird' }] }
  ]);
  const e = engineById('example-sepia');
  assert.equal(e.kind, 'server'); assert.equal(e.custom, true);
  assert.deepEqual(e.paramSchema.map((p) => p.name), ['strength'], 'unknown param types are dropped');
  assert.equal(engineLabel(t, 'example-sepia', 'zh-TW'), '懷舊');
  assert.equal(engineLabel(t, 'dctnet', 'en'), 'DCT-Net', 'built-in engines keep their translations');
  assert.deepEqual(defaultCustomParams(e), { strength: 0.8 });
  const s = { ...settingsForGoal('custom'), engine: 'example-sepia' };
  assert.deepEqual(describePipeline(s, { serverEngines: ['example-sepia'] }).map((st) => formatStep(st, t, (id) => engineLabel(t, id, 'en'))), ['Sepia on your server']);
  setServerEngineInfo([]);
  assert.equal(engineById('example-sepia'), undefined);
  assert.ok(!allEngines().some((x) => x.custom));
  assert.equal(withServerEngines(s, 'custom', []).engine, 'photo', 'falls back when the server is gone');
});
