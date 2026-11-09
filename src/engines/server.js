// Client for the optional self-hosted Qute inference server (server/ in this repository).
// API: GET  {url}/api/engines            -> { engines: [{ id, available, reason?, variants? }] }
//      POST {url}/api/stylize (multipart) -> image/png
//           fields: engine, params (JSON), image (file), reference (file, optional)

export function normalizeServerURL(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

export async function fetchServerEngines(url, timeoutMs = 6000) {
  const base = normalizeServerURL(url);
  if (!base) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(base + '/api/engines', { signal: controller.signal });
    if (!response.ok) throw new Error('Server responded ' + response.status);
    const body = await response.json();
    return Array.isArray(body.engines) ? body.engines : [];
  } finally { clearTimeout(timer); }
}

export async function serverStylize(url, engine, imageBlob, referenceBlob, params, timeoutMs = 900000, signal) {
  const form = new FormData();
  form.append('engine', engine);
  form.append('params', JSON.stringify(params || {}));
  form.append('image', imageBlob, 'photo.png');
  if (referenceBlob) form.append('reference', referenceBlob, 'reference.png');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  try {
    const response = await fetch(normalizeServerURL(url) + '/api/stylize', { method: 'POST', body: form, signal: controller.signal });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).detail || ''; } catch { /* not JSON */ }
      throw new Error('Server error ' + response.status + (detail ? ': ' + detail : ''));
    }
    return await response.blob();
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError', code: 'cancelled' });
    if (error.name === 'AbortError') throw Object.assign(new Error('The server did not answer within ' + Math.round(timeoutMs / 60000) + ' min'), { code: 'serverTimeout' });
    if (error instanceof TypeError) throw Object.assign(error, { code: 'serverUnreachable' });
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
