// Engine catalogue. "browser" engines run in the visitor's browser; "server" engines run on a
// Python/PyTorch server that the owner deploys (see server/README.md) and are used only when a
// server URL is configured.

export const engines = [
  {
    id: 'whitebox', kind: 'browser', model: 'whitebox-cartoon.onnx', multiple: 8, sizeMB: 5.9,
    family: 'cartoon', geometry: false,
    citation: 'Wang & Yu, CVPR 2020', repo: 'SystemErrorWang/White-box-Cartoonization', license: 'CC BY-NC-SA 4.0'
  },
  {
    id: 'animeganv3-hayao', kind: 'browser', model: 'animeganv3-hayao.onnx', multiple: 32, sizeMB: 4.2,
    family: 'anime', geometry: false,
    citation: 'Chen et al., AnimeGAN (ISICA 2019, Springer CCIS 1205, 2020); AnimeGANv3', repo: 'TachibanaYoshino/AnimeGANv3', license: 'Non-commercial (author licence)'
  },
  {
    id: 'animeganv3-shinkai', kind: 'browser', model: 'animeganv3-shinkai.onnx', multiple: 32, sizeMB: 4.2,
    family: 'anime', geometry: false,
    citation: 'Chen et al., AnimeGAN (ISICA 2019, Springer CCIS 1205, 2020); AnimeGANv3', repo: 'TachibanaYoshino/AnimeGANv3', license: 'Non-commercial (author licence)'
  },
  {
    id: 'animeganv2-shinkai', kind: 'browser', model: 'animeganv2-shinkai.onnx', multiple: 32, sizeMB: 8.6,
    family: 'anime', geometry: false,
    citation: 'Chen et al., AnimeGAN (ISICA 2019, Springer CCIS 1205, 2020); AnimeGANv2', repo: 'TachibanaYoshino/AnimeGANv2', license: 'Non-commercial (author licence)'
  },
  {
    id: 'magenta', kind: 'browser', needsReference: true, family: 'reference', geometry: false,
    citation: 'Ghiasi et al., BMVC 2017 (arbitrary style transfer)', repo: 'magenta/magenta-js', license: 'Apache-2.0'
  },
  {
    id: 'photo', kind: 'browser', family: 'none', geometry: false,
    citation: '—', repo: '', license: ''
  },
  // ---- server engines (Python / PyTorch) ----
  {
    id: 'dctnet', kind: 'server', family: 'portrait', geometry: true,
    variants: ['anime', '3d', 'handdrawn', 'sketch', 'artstyle'],
    citation: 'Men et al., ACM TOG 41(4), SIGGRAPH 2022', repo: 'menyifang/DCT-Net', license: 'Apache-2.0 (ModelScope weights: see model card)'
  },
  {
    id: 'vtoonify', kind: 'server', family: 'portrait', geometry: true, params: ['styleDegree'],
    variants: ['cartoon', 'comic', 'arcane', 'pixar'],
    citation: 'Yang et al., ACM TOG 41(6), SIGGRAPH Asia 2022', repo: 'williamyang1991/VToonify', license: 'S-Lab License 1.0 (non-commercial)'
  },
  {
    id: 'instantid-chibi', kind: 'server', family: 'chibi', geometry: true, params: ['identity', 'prompt'],
    citation: 'Wang et al., InstantID, arXiv:2401.07519 (2024); Ye et al., IP-Adapter, arXiv:2308.06721', repo: 'InstantID/InstantID', license: 'Apache-2.0 (code); check base model and LoRA licences'
  },
  {
    id: 'warpgan', kind: 'server', family: 'caricature', geometry: true, params: ['exaggeration'],
    citation: 'Shi, Deb & Jain, CVPR 2019', repo: 'seasonSH/WarpGAN', license: 'MIT'
  },
  {
    id: 'server-whitebox', kind: 'server', family: 'cartoon', geometry: false,
    citation: 'Wang & Yu, CVPR 2020', repo: 'SystemErrorWang/White-box-Cartoonization', license: 'CC BY-NC-SA 4.0'
  }
];

// Engines a connected server advertises that this app does not know (plugins, other models).
// They are described by the server itself (label, description, params), see docs/SERVER_API.md.
const customEngines = new Map();
const PARAM_TYPES = ['number', 'select', 'boolean', 'text'];

export function setServerEngineInfo(list = []) {
  customEngines.clear();
  for (const info of list) {
    if (!info || typeof info.id !== 'string' || engines.some((e) => e.id === info.id)) continue;
    customEngines.set(info.id, {
      id: info.id, kind: 'server', family: 'custom', custom: true, geometry: false,
      label: info.label || info.id, description: info.description || '',
      citation: typeof info.citation === 'string' ? info.citation : '—', repo: typeof info.repo === 'string' ? info.repo : '',
      license: typeof info.license === 'string' ? info.license : '',
      variants: Array.isArray(info.variants) && info.variants.length ? info.variants.map(String) : undefined,
      paramSchema: (Array.isArray(info.params) ? info.params : []).filter((p) => p && typeof p.name === 'string' && PARAM_TYPES.includes(p.type))
    });
  }
}

export const engineById = (id) => engines.find((engine) => engine.id === id) || customEngines.get(id);
export const allEngines = () => [...engines, ...customEngines.values()];

// Text from the server may be a string or {"en": ..., "zh-TW": ...}.
export function localized(value, language) {
  if (!value || typeof value === 'string') return value || '';
  return value[language] || value.en || Object.values(value)[0] || '';
}
export function engineLabel(t, id, language) {
  const engine = engineById(id);
  return engine?.custom ? localized(engine.label, language) : t('engine_' + id) || id;
}
export function engineDescription(t, id, language) {
  const engine = engineById(id);
  return engine?.custom ? localized(engine.description, language) : t('engine_' + id + '_desc') || '';
}
export function defaultCustomParams(engine) {
  return Object.fromEntries((engine?.paramSchema || []).filter((p) => p.default !== undefined).map((p) => [p.name, p.default]));
}

export const defaultWarp = { head: 0, eyes: 0, chin: 0, body: 0, hair: 0, cheeks: 0 };
export const defaultBeauty = { smooth: 0, brighten: 0, lips: 0, fuller: 0 };

// Goal presets: what the visitor wants, mapped to an engine and tuned parameters.
// `reference` describes how an optional reference image is used.
export const goals = {
  close: {
    engine: 'whitebox', warp: { ...defaultWarp }, detail: 0.3, cute: 0,
    reference: { palette: 0.35, texture: 0, faceProtect: 0.8 }
  },
  cute: {
    engine: 'animeganv3-hayao', warp: { head: 0.35, eyes: 0.6, chin: 0.5, body: 0 }, detail: 0.1, cute: 0.6,
    reference: { palette: 0.5, texture: 0, faceProtect: 0.8 }
  },
  chibi: {
    engine: 'animeganv3-hayao', serverEngine: 'instantid-chibi', warp: { head: 1, eyes: 0.8, chin: 0.6, body: 0.8 }, detail: 0, cute: 0.4,
    reference: { palette: 0.5, texture: 0, faceProtect: 0.8 }
  },
  bold: {
    engine: 'animeganv3-shinkai', warp: { ...defaultWarp }, detail: 0, cute: 0,
    reference: { palette: 0.6, texture: 0.7, faceProtect: 0.7 }
  },
  // Beauty (美肌): retouch the photo itself (smoother, brighter skin, lip colour), no restyling.
  beauty: {
    engine: 'photo', warp: { ...defaultWarp }, detail: 0, cute: 0,
    beauty: { smooth: 0.55, brighten: 0.3, lips: 0.3, fuller: 0.15 },
    reference: { palette: 0, texture: 0, faceProtect: 0.8 }
  },
  // Everything off: the result equals the photo until the visitor turns something on in Advanced.
  custom: {
    engine: 'photo', warp: { ...defaultWarp }, detail: 0, cute: 0,
    reference: { palette: 0, texture: 0, faceProtect: 0.8 }
  }
};

export function settingsForGoal(goalId, { hasReference = false, serverEngines = [] } = {}) {
  const goal = goals[goalId];
  const useServer = goal.serverEngine && serverEngines.includes(goal.serverEngine);
  return {
    goal: goalId,
    engine: useServer ? goal.serverEngine : goal.engine,
    variant: '',
    warp: useServer ? { ...defaultWarp } : { ...defaultWarp, ...goal.warp },
    detail: goal.detail,
    cute: goal.cute,
    palette: hasReference ? goal.reference.palette : 0,
    texture: hasReference ? goal.reference.texture : 0,
    faceProtect: goal.reference.faceProtect,
    styleDegree: 0.5,
    exaggeration: 1,
    identity: 0.8,
    maxSide: 768,
    customParams: {},
    beauty: { ...(goal.beauty || defaultBeauty) }
  };
}

// Turning a reference on/off only changes the reference sliders; other Advanced edits are kept.
export function withReference(settings, goalId, hasReference) {
  const ref = goals[goalId].reference;
  const next = { ...settings, palette: hasReference ? ref.palette : 0, texture: hasReference ? ref.texture : 0 };
  if (!hasReference && engineById(next.engine)?.needsReference) next.engine = goals[goalId].engine === 'magenta' ? 'photo' : goals[goalId].engine;
  return next;
}

// After (re)connecting a server: switch to the goal's server engine only if the visitor has not
// picked another algorithm; switch back if that server engine is no longer available.
export function withServerEngines(settings, goalId, serverEngines) {
  const goal = goals[goalId];
  // A custom engine from a server that is no longer connected: fall back to the goal's engine.
  if (!engineById(settings.engine)) settings = { ...settings, engine: goal.engine, warp: { ...defaultWarp, ...goal.warp } };
  if (!goal.serverEngine) return settings;
  const available = serverEngines.includes(goal.serverEngine);
  if (available && settings.engine === goal.engine) return { ...settings, engine: goal.serverEngine, warp: { ...defaultWarp } };
  if (!available && settings.engine === goal.serverEngine) return { ...settings, engine: goal.engine, warp: { ...defaultWarp, ...goal.warp } };
  return settings;
}
