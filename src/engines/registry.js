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

export const engineById = (id) => engines.find((engine) => engine.id === id);

export const defaultWarp = { head: 0, eyes: 0, chin: 0, body: 0 };

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
  }
};

export function settingsForGoal(goalId, { hasReference = false, serverEngines = [] } = {}) {
  const goal = goals[goalId];
  const useServer = goal.serverEngine && serverEngines.includes(goal.serverEngine);
  return {
    goal: goalId,
    engine: useServer ? goal.serverEngine : goal.engine,
    variant: '',
    warp: useServer ? { ...defaultWarp } : { ...goal.warp },
    detail: goal.detail,
    cute: goal.cute,
    palette: hasReference ? goal.reference.palette : 0,
    texture: hasReference ? goal.reference.texture : 0,
    faceProtect: goal.reference.faceProtect,
    styleDegree: 0.5,
    exaggeration: 1,
    identity: 0.8,
    maxSide: 768
  };
}
