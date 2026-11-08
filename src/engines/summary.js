// Plain description of what the pipeline will do with the current settings.
// Mirrors runPipeline() in pipeline.js step by step; each step is { key, values } for i18n.
import { engineById } from './registry.js';

const pct = (v) => Math.round(v * 100) + '%';
const warpOrder = ['head', 'eyes', 'chin', 'body'];

export function describePipeline(settings, { hasReference = false, serverEngines = [] } = {}) {
  const engine = engineById(settings.engine);
  const steps = [];
  if (!engine) return steps;
  const browser = engine.kind === 'browser';

  if (engine.kind === 'server' && !serverEngines.includes(engine.id)) steps.push({ key: 'sum_needsServer', values: { engine: engine.id }, warn: true });
  if (engine.needsReference && !hasReference) steps.push({ key: 'sum_needsReference', values: {}, warn: true });

  const warps = warpOrder.filter((k) => (settings.warp?.[k] || 0) > 0);
  if (browser && warps.length) steps.push({ key: 'sum_warp', values: { parts: warps.map((k) => ({ part: k, amount: pct(settings.warp[k]) })) } });
  if (!browser && warps.length) steps.push({ key: 'sum_warpIgnored', values: {}, warn: true });

  if (engine.id === 'magenta') {
    steps.push({ key: 'sum_magenta', values: { amount: pct(settings.texture > 0 ? settings.texture : 0.7) } });
    if (settings.faceProtect > 0) steps.push({ key: 'sum_faceProtect', values: { amount: pct(settings.faceProtect * 0.6) } });
  } else if (engine.kind === 'server') {
    const variant = settings.variant || engine.variants?.[0] || '';
    const extra = engine.id === 'vtoonify' ? { degree: pct(settings.styleDegree) } : engine.id === 'instantid-chibi' ? { identity: pct(settings.identity) } : engine.id === 'warpgan' ? { exaggeration: settings.exaggeration } : {};
    steps.push({ key: 'sum_server', values: { engine: engine.id, variant, ...extra } });
  } else if (engine.id !== 'photo') {
    steps.push({ key: 'sum_engine', values: { engine: engine.id } });
  }

  if (hasReference && settings.texture > 0 && engine.id !== 'magenta') {
    steps.push({ key: browser && settings.faceProtect > 0 ? 'sum_textureProtected' : 'sum_texture', values: { amount: pct(settings.texture), protect: pct(settings.faceProtect) } });
  }
  if (hasReference && settings.palette > 0) steps.push({ key: 'sum_palette', values: { amount: pct(settings.palette) } });
  if (settings.cute > 0) steps.push({ key: 'sum_cute', values: { amount: pct(settings.cute) } });
  if (browser && settings.detail > 0) steps.push({ key: 'sum_detail', values: { amount: pct(Math.min(0.6, settings.detail)) } });
  if (!steps.some((s) => !s.warn)) steps.push({ key: 'sum_nothing', values: {} });
  return steps;
}

// Fill "{name}" placeholders; `t` translates keys, `engineName(id)` gives display names.
export function formatStep(step, t, engineName) {
  const v = step.values;
  if (step.key === 'sum_warp') {
    return t('sum_warp').replace('{parts}', v.parts.map((p) => t('sw_' + p.part) + ' ' + p.amount).join(t('listSep')));
  }
  let text = t(step.key);
  const values = { ...v };
  if (values.engine) values.engine = engineName(values.engine);
  if (values.variant) values.variant = t('variant_' + values.variant);
  for (const [k, val] of Object.entries(values)) text = text.replace('{' + k + '}', val);
  if (step.key === 'sum_server') {
    const extras = [values.variant, values.degree && t('styleDegree') + ' ' + values.degree, values.identity && t('identity') + ' ' + values.identity, values.exaggeration && t('exaggeration') + ' ×' + values.exaggeration].filter(Boolean);
    text = text.replace('{extras}', extras.length ? ' (' + extras.join(t('listSep')) + ')' : '');
  }
  return text;
}
