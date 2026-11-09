import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initialLanguage, messages } from './i18n';
import { runPipeline } from './engines/pipeline';
import { engineById, engineLabel, setServerEngineInfo, settingsForGoal, withReference, withServerEngines } from './engines/registry';
import { fetchServerEngines, normalizeServerURL } from './engines/server';
import StylePanel from './StylePanel';
import { ACCEPT, normalizeImageFile } from './imageDecode';
import { artworkImage, artworkThumb, artworks } from './artworks';
import { cameraFilter, cameraPresets, defaultCameraSettings, renderCameraFrame } from './cameraEffects';
import './styles.css';

const base = import.meta.env.BASE_URL;
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'; // from package.json (vite.config.js)
const styles = [
  { id: 'none', label: 'noReference', description: 'noReferenceDesc', image: null },
  ...artworks.map((art) => ({ ...art, image: artworkImage(base, art.id), thumb: artworkThumb(base, art.id) })),
  { id: 'custom', label: 'custom', description: 'customDesc', image: null }
];

function App() {
  const [language, setLanguage] = useState(initialLanguage);
  const t = (key) => messages[language][key];
  const [photo, setPhoto] = useState(null);
  const [reference, setReference] = useState(null);
  const [styleId, setStyleId] = useState('none');
  const [goal, setGoal] = useState('cute');
  const [serverURL, setServerURLState] = useState(() => { try { return localStorage.getItem('qute-server-url') || ''; } catch { return ''; } });
  const [serverEngines, setServerEngines] = useState([]);
  const [serverState, setServerState] = useState('idle');
  const [settings, setSettings] = useState(() => settingsForGoal('cute'));
  const [result, setResult] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [statusKey, setStatusKey] = useState('');
  const [formatHint, setFormatHint] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraRequesting, setCameraRequesting] = useState(false);
  const [cameraSettings, setCameraSettings] = useState(defaultCameraSettings);
  const [cameraPreset, setCameraPreset] = useState('natural');
  const [referenceDragging, setReferenceDragging] = useState(false);
  const fileInput = useRef(null);
  const referenceInput = useRef(null);
  const video = useRef(null);
  const cameraStream = useRef(null);
  const photoRef = useRef(null);
  const referenceRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = language === 'zh-TW' ? 'zh-Hant' : 'en';
    document.title = language === 'zh-TW' ? 'Qute · 在你的裝置上為照片換畫風' : 'Qute · Restyle photos on your device';
    localStorage.setItem('qute-language', language);
  }, [language]);
  useEffect(() => {
    if (cameraOpen && video.current && cameraStream.current) video.current.srcObject = cameraStream.current;
  }, [cameraOpen]);
  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    [photoRef, referenceRef, resultRef].forEach((ref) => { if (ref.current) URL.revokeObjectURL(ref.current); });
  }, []);

  const replaceURL = (ref, url) => {
    if (ref.current) URL.revokeObjectURL(ref.current);
    ref.current = url;
  };
  const stopCamera = () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    if (video.current) video.current.srcObject = null;
    setCameraOpen(false);
  };
  const clearResult = () => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    resultRef.current = null;
    setResult(null);
    setResultMeta(null);
  };
  const acceptFile = async (file, kind) => {
    if (!file) return;
    let normalized;
    try {
      setStatusKey('readingImage');
      normalized = await normalizeImageFile(file);
    } catch (error) {
      setFormatHint(error.format || '');
      return setStatusKey(error.code || 'badFormat');
    }
    const url = URL.createObjectURL(normalized.file);
    const name = file.name + (normalized.converted ? ' → ' + normalized.file.name.split('.').pop().toUpperCase() : '');
    if (kind === 'photo') {
      replaceURL(photoRef, url);
      setPhoto({ url, name });
      clearResult();
      setStatusKey(normalized.converted ? 'convertedReady' : 'ready');
      stopCamera();
    } else {
      replaceURL(referenceRef, url);
      setReference({ url, name });
      if (styleId === 'none') setSettings((current) => withReference(current, goal, true));
      setStyleId('custom');
      clearResult();
      setStatusKey(normalized.converted ? 'convertedReference' : '');
    }
  };
  const openCamera = async () => {
    if (cameraRequesting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusKey('cameraUnsupported');
      return;
    }
    setCameraRequesting(true);
    setStatusKey('cameraOpening');
    try {
      stopCamera();
      cameraStream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setCameraOpen(true);
      setStatusKey('cameraReady');
    } catch (error) {
      setStatusKey(error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' ? 'cameraDenied' : error.name === 'NotFoundError' ? 'cameraMissing' : 'cameraFailed');
    } finally { setCameraRequesting(false); }
  };
  const snap = () => {
    if (!video.current?.videoWidth) return setStatusKey('waitCamera');
    const canvas = document.createElement('canvas');
    if (!renderCameraFrame(video.current, canvas, cameraSettings)) return setStatusKey('waitCamera');
    canvas.toBlob((blob) => {
      if (blob) acceptFile(new File([blob], 'qute-camera.jpg', { type: 'image/jpeg' }), 'photo');
    }, 'image/jpeg', 0.94);
  };
  const setCameraAdjustment = (key, value) => {
    setCameraSettings((current) => ({ ...current, [key]: value }));
    setCameraPreset('custom');
  };
  const chooseCameraPreset = (id) => {
    setCameraSettings((current) => ({ ...current, ...cameraPresets[id] }));
    setCameraPreset(id);
  };
  const chooseGoal = (id) => {
    setGoal(id);
    setSettings(settingsForGoal(id, { hasReference: styleId !== 'none', serverEngines }));
    clearResult();
  };
  const chooseReference = (id) => {
    const hadReference = styleId !== 'none';
    setStyleId(id);
    if ((id !== 'none') !== hadReference) setSettings((current) => withReference(current, goal, id !== 'none'));
    clearResult();
  };
  const updateSettings = (patch) => { setSettings((current) => ({ ...current, ...patch })); clearResult(); };
  const setServerURL = (value) => {
    setServerURLState(value);
    setServerState('idle');
    setServerEngineInfo([]);
    setServerEngines([]);
    setSettings((current) => withServerEngines(current, goal, []));
    try { localStorage.setItem('qute-server-url', value); } catch { /* storage unavailable */ }
  };
  const connectServer = async () => {
    if (!normalizeServerURL(serverURL)) { setServerState('idle'); setServerEngines([]); return; }
    setServerState('checking');
    try {
      const list = await fetchServerEngines(serverURL);
      setServerEngineInfo(list);
      const available = list.filter((e) => e.available && engineById(e.id)?.kind === 'server').map((e) => e.id);
      setServerEngines(available);
      setServerState('ok');
      setSettings((current) => withServerEngines(current, goal, available));
    } catch (error) {
      console.error('Qute server check failed', error);
      setServerEngineInfo([]);
      setServerEngines([]);
      setServerState('error');
      setSettings((current) => withServerEngines(current, goal, []));
    }
  };
  useEffect(() => { if (normalizeServerURL(serverURL)) connectServer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const generate = async () => {
    if (!photo) return setStatusKey('missingPhoto');
    const selected = styles.find((item) => item.id === styleId);
    const referenceURL = styleId === 'custom' ? reference?.url : selected?.image || null;
    if (styleId === 'custom' && !referenceURL) return setStatusKey('missingStyle');
    setPhase('generating');
    setStatusKey('working');
    try {
      const output = await runPipeline({ photoURL: photo.url, referenceURL, settings, serverURL: normalizeServerURL(serverURL), onStep: setStatusKey });
      const url = URL.createObjectURL(output.blob);
      replaceURL(resultRef, url);
      setResult({ url, blob: output.blob });
      setResultMeta({ engine: output.engine, faces: output.faces });
      const engine = engineById(output.engine);
      setStatusKey(engine.kind === 'server' ? 'doneServer' : Object.values(settings.warp).some((v) => v > 0) && !output.faces ? 'doneNoFaces' : 'done');
    } catch (error) {
      console.error('Qute style transfer failed', error);
      setStatusKey(error.code || (engineById(settings.engine)?.kind === 'server' ? 'serverFailed' : 'failed'));
    } finally { setPhase('idle'); }
  };
  const download = () => {
    if (!result) return setStatusKey('noResult');
    const anchor = document.createElement('a');
    anchor.href = result.url;
    anchor.download = 'qute-' + goal + '-' + Date.now() + '.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setStatusKey('downloadReady');
  };
  const share = async () => {
    if (!result) return setStatusKey('noResult');
    const file = new File([result.blob], 'qute-' + goal + '.png', { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) return setStatusKey('shareUnavailable');
    try { await navigator.share({ files: [file], title: 'Qute' }); }
    catch (error) { if (error.name !== 'AbortError') setStatusKey('shareFailed'); }
  };

  const busy = phase !== 'idle';
  return <>
    <header className="topbar">
      <div className="brand-wrap"><a className="brand" href="./"><span className="brand-mark">Q</span><span>qute<span className="brand-dot">.</span></span></a><a className="version-badge" href="https://github.com/sywan/Qute/commits/main" target="_blank" rel="noreferrer" title={t('versionTitle')}>v{APP_VERSION}</a></div>
      <div className="header-right">
        <span className="top-note"><span className="privacy-dot" />{t('privacy')}</span>
        <div className="language-switch" role="group" aria-label="Language">
          <button type="button" className={language === 'zh-TW' ? 'active' : ''} onClick={() => setLanguage('zh-TW')} aria-pressed={language === 'zh-TW'}>繁中</button>
          <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
        </div>
      </div>
    </header>
    <main>
      <section className="intro">
        <div className="intro-copy">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t('hero1')} <em>{t('hero2')}</em></h1>
          <p className="lead">{t('lead')}</p>
        </div>
        <div className="intro-facts">
          <ul>{['factPrivate', 'factFree', 'factFaithful', 'factOpen'].map((key) => <li key={key}><span aria-hidden="true">✦</span>{t(key)}</li>)}</ul>
          <a className="why-link" href="#why">{t('whyLink')} ↓</a>
        </div>
      </section>
      <section className="studio" aria-labelledby="studio-title">
        <div className="section-heading"><span className="step-badge">01</span><div><p className="eyebrow">THE STUDIO</p><h2 id="studio-title">{t('studio')}</h2></div></div>
          <StylePanel {...{ t, language, busy, goal, chooseGoal, settings, updateSettings, styles, styleId, chooseReference, reference, referenceInput, referenceDragging, setReferenceDragging, acceptFile, serverURL, setServerURL, connectServer, serverEngines, serverState, generate, photo, result }} workspace={
          <div className="workspace" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0], 'photo'); }}>
            <div className="workspace-bar"><span>{t('yourPhoto')}</span><span className="muted">{photo?.name || t('noPhoto')}</span></div>
            {cameraOpen ? <div className="camera-state">
              <div className="camera-frame"><video ref={video} autoPlay playsInline muted aria-label={t('cameraPreview')} style={{ filter: cameraFilter(cameraSettings), transform: cameraSettings.mirror ? 'scaleX(-1)' : 'none' }} /><button type="button" className={'camera-mirror' + (cameraSettings.mirror ? ' active' : '')} aria-pressed={cameraSettings.mirror} onClick={() => setCameraSettings((current) => ({ ...current, mirror: !current.mirror }))}>⇄ {t('mirror')}</button></div>
              <div className="camera-editor"><div className="camera-editor-heading"><strong>{t('cameraAdjustments')}</strong><button type="button" onClick={() => { setCameraSettings(defaultCameraSettings); setCameraPreset('natural'); }}>{t('cameraReset')}</button></div>
                <div className="camera-presets" role="group" aria-label={t('cameraPresets')}>{Object.keys(cameraPresets).map((id) => <button type="button" key={id} className={cameraPreset === id ? 'active' : ''} aria-pressed={cameraPreset === id} onClick={() => chooseCameraPreset(id)}>{t('preset' + id[0].toUpperCase() + id.slice(1))}</button>)}</div>
                <div className="camera-sliders">{[['brightness', 60, 150], ['contrast', 60, 150], ['saturation', 0, 180]].map(([key, min, max]) => <label key={key}><span>{t(key)} <strong>{cameraSettings[key]}%</strong></span><input type="range" min={min} max={max} step="1" value={cameraSettings[key]} onChange={(event) => setCameraAdjustment(key, Number(event.target.value))} /></label>)}</div>
                <p>{t('cameraAdjustmentsHelp')}</p>
              </div>
              <div className="camera-actions"><button className="button button-light" onClick={stopCamera}>{t('cancel')}</button><button className="button button-primary" onClick={snap}>{t('snap')} ◎</button></div>
            </div>
              : photo ? <div className="preview-state"><div className="preview-panels"><figure><figcaption>{t('original')}</figcaption><img src={photo.url} alt={t('original')} /></figure><figure><figcaption>{t('result')}{resultMeta && <span className="result-meta"> · {engineLabel(t, resultMeta.engine, language)}{resultMeta.faces ? ' · ' + t('facesFound').replace('{n}', resultMeta.faces) : ''}</span>}</figcaption>{result ? <img src={result.url} alt={t('result')} /> : <div className="result-placeholder">✦</div>}</figure></div><div className="preview-actions"><button className="button button-light" onClick={() => fileInput.current?.click()} disabled={busy}>{t('changePhoto')}</button><button className="button button-light" onClick={openCamera} disabled={busy || cameraRequesting}>{t('retakePhoto')} ◎</button><button className="button button-primary" onClick={download} disabled={!result || busy}>{t('download')} ↓</button><button className="button button-light" onClick={share} disabled={!result || busy}>{t('share')} ↗</button></div></div>
              : <div className="empty-state"><div className="upload-icon">↥</div><h3>{t('uploadTitle')}</h3><p>{t('uploadHelp')}</p><div className="upload-actions"><button className="button button-primary" onClick={() => fileInput.current?.click()}>{t('choosePhoto')} ↗</button><button className="button button-light" onClick={openCamera} disabled={cameraRequesting}>{t('openCamera')} ◎</button></div><p className="drop-hint">{t('dropHint')}</p></div>}
            <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(event) => { acceptFile(event.target.files?.[0], 'photo'); event.target.value = ''; }} />
          </div>
          } />
          <input ref={referenceInput} type="file" accept={ACCEPT} hidden onChange={(event) => { acceptFile(event.target.files?.[0], 'reference'); event.target.value = ''; }} />
        <p className="status" role="status" aria-live="polite">{statusKey ? t(statusKey).replace('{format}', (formatHint || '?').toUpperCase()) : ''}</p>
      </section>
      <section className="explain"><p>{t('artistNotice')}</p><p>{t('modelSource')}</p></section>
      <section className="why" id="why" aria-labelledby="why-title">
        <div className="why-head"><p className="eyebrow">{t('whyEyebrow')}</p><h2 id="why-title">{t('whyTitle')}</h2><p>{t('whyIntro')}</p></div>
        <div className="why-cards">{['Private', 'Free', 'Faithful', 'Open', 'Grow'].map((key) => <article key={key}><h3>{t('why' + key + 'Title')}</h3><p>{t('why' + key)}</p></article>)}</div>
        <div className="why-compare">
          <table>
            <caption>{t('cmpCaption')}</caption>
            <thead><tr><th scope="col"></th><th scope="col">Qute</th><th scope="col">{t('cmpCloud')}</th></tr></thead>
            <tbody>{['Where', 'Cost', 'Internet', 'Change', 'Control', 'Polish', 'Upgrade'].map((row) => <tr key={row}><th scope="row">{t('cmp' + row)}</th><td>{t('cmp' + row + 'Qute')}</td><td>{t('cmp' + row + 'Cloud')}</td></tr>)}</tbody>
          </table>
          <p className="why-note"><strong>{t('whyWhenCloudTitle')}</strong> {t('whyWhenCloud')}</p>
        </div>
      </section>
    </main>
    <footer><span className="footer-brand">qute<span>.</span></span><span>{t('footer')}</span><a className="footer-qr" href={base + 'brand/qute-qr-code.png'} target="_blank" rel="noreferrer">▦ {t('shareQR')}</a><span>v{APP_VERSION} · React + AI</span></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
