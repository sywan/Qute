// Turns a failure from runPipeline() into something a visitor can act on:
// { key: message i18n key, hint: i18n key or '', detail: technical text }.
const KNOWN = new Set(['cancelled', 'missingStyle', 'serverMissing', 'serverUnreachable', 'serverTimeout', 'failedImage', 'failedMemory', 'failedModel', 'failedBrowser', 'serverFailed', 'failed']);

export function classifyError(error, { engineKind = 'browser', step = '' } = {}) {
  const detail = [error?.name && error.name !== 'Error' ? error.name : '', error?.message || String(error || '')].filter(Boolean).join(': ');
  const text = detail.toLowerCase();
  let key = KNOWN.has(error?.code) ? error.code : '';
  if (!key) {
    if (error?.name === 'AbortError') key = 'cancelled';
    else if (error instanceof RangeError || /out of memory|memory access out of bounds|allocation|array buffer|\boom\b|cannot enlarge memory|invalid array length/.test(text)) key = 'failedMemory';
    else if (/webassembly|wasm|no available backend|backend not found|simd/.test(text) && !/fetch|network|404/.test(text)) key = 'failedBrowser';
    else if (/fetch|network|load model|failed to load|404|protobuf|onnx|session/.test(text) || step === 'stylizing') key = engineKind === 'server' ? 'serverFailed' : 'failedModel';
    else if (engineKind === 'server') key = 'serverFailed';
    else key = 'failed';
  }
  const hint = {
    failedMemory: 'hintMemory', failedModel: 'hintModel', failedBrowser: 'hintBrowser', failedImage: 'hintImage',
    serverUnreachable: 'hintServerUnreachable', serverTimeout: 'hintServerTimeout', serverFailed: 'hintServer', failed: 'hintGeneric'
  }[key] || '';
  return { key, hint, detail: key === 'cancelled' ? '' : detail };
}

// How long a step may run before the visitor is told it is slower than usual (ms).
export function slowAfter(step, engineKind) {
  if (engineKind === 'server' || step === 'serverWorking') return 120000;
  if (step === 'stylizing') return 60000; // includes the first model download
  return 30000;
}
