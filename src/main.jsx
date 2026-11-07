import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initialLanguage, messages } from './i18n';
import { getStyleModel, stylizePhoto } from './styleTransfer';
import './styles.css';

const base = import.meta.env.BASE_URL;
const styles = [
  { id: 'van-gogh', label: 'vanGogh', description: 'vanGoghDesc', image: base + 'styles/van-gogh.jpg' },
  { id: 'monet', label: 'monet', description: 'monetDesc', image: base + 'styles/monet.jpg' },
  { id: 'da-vinci', label: 'daVinci', description: 'daVinciDesc', image: base + 'styles/da-vinci.jpg' },
  { id: 'custom', label: 'custom', description: 'customDesc', image: null }
];

function App() {
  const [language, setLanguage] = useState(initialLanguage);
  const t = (key) => messages[language][key];
  const [photo, setPhoto] = useState(null);
  const [reference, setReference] = useState(null);
  const [styleId, setStyleId] = useState('van-gogh');
  const [strength, setStrength] = useState(0.85);
  const [illustrationBoost, setIllustrationBoost] = useState(false);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [statusKey, setStatusKey] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraRequesting, setCameraRequesting] = useState(false);
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
    document.title = language === 'zh-TW' ? 'Qute · 把今天畫下來' : 'Qute · Make today a work of art';
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
  };
  const acceptFile = (file, kind) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setStatusKey('badFormat');
    if (file.size > 20 * 1024 * 1024) return setStatusKey('tooLarge');
    const url = URL.createObjectURL(file);
    const testImage = new Image();
    testImage.onload = () => {
      if (kind === 'photo') {
        replaceURL(photoRef, url);
        setPhoto({ url, name: file.name });
        clearResult();
        setStatusKey('ready');
        stopCamera();
      } else {
        replaceURL(referenceRef, url);
        setReference({ url, name: file.name });
        setStyleId('custom');
        clearResult();
        setStatusKey('');
      }
    };
    testImage.onerror = () => { URL.revokeObjectURL(url); setStatusKey('badFormat'); };
    testImage.src = url;
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
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext('2d').drawImage(video.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) acceptFile(new File([blob], 'qute-camera.jpg', { type: 'image/jpeg' }), 'photo');
    }, 'image/jpeg', 0.94);
  };
  const generate = async () => {
    if (!photo) return setStatusKey('missingPhoto');
    const selected = styles.find((item) => item.id === styleId);
    const styleURL = styleId === 'custom' ? reference?.url : selected?.image;
    if (!styleURL) return setStatusKey('missingStyle');
    setPhase('loading');
    setStatusKey('loadingModel');
    try {
      const model = await getStyleModel();
      setPhase('generating');
      setStatusKey('generating');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const blob = await stylizePhoto(model, photo.url, styleURL, strength, styleId === 'custom' && illustrationBoost);
      const url = URL.createObjectURL(blob);
      replaceURL(resultRef, url);
      setResult({ url, blob });
      setStatusKey('done');
    } catch (error) {
      console.error('Qute style transfer failed', error);
      setStatusKey('failed');
    } finally { setPhase('idle'); }
  };
  const download = () => {
    if (!result) return setStatusKey('noResult');
    const anchor = document.createElement('a');
    anchor.href = result.url;
    anchor.download = 'qute-' + styleId + '-' + Date.now() + '.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setStatusKey('downloadReady');
  };
  const share = async () => {
    if (!result) return setStatusKey('noResult');
    const file = new File([result.blob], 'qute-' + styleId + '.png', { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) return setStatusKey('shareUnavailable');
    try { await navigator.share({ files: [file], title: 'Qute' }); }
    catch (error) { if (error.name !== 'AbortError') setStatusKey('shareFailed'); }
  };

  const busy = phase !== 'idle';
  return <>
    <header className="topbar">
      <a className="brand" href="./"><span className="brand-mark">Q</span><span>qute<span className="brand-dot">.</span></span></a>
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
          <p className="eyebrow">YOUR MOMENT, REIMAGINED</p>
          <h1>{t('hero1')}<br /><em>{t('hero2')}</em></h1>
          <p className="lead">{t('lead')}</p>
          <div className="intro-pills"><span>✦ {t('noLogin')}</span><span>✦ {t('neural')}</span><span>✦ {t('local')}</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card art-card-back"><span>✳</span></div><div className="art-card art-card-front"><div className="sun" /><div className="hill hill-a" /><div className="hill hill-b" /><div className="art-sparkle">✦</div></div><span className="art-label">a little more magical ✨</span></div>
      </section>
      <section className="studio" aria-labelledby="studio-title">
        <div className="section-heading"><span className="step-badge">01</span><div><p className="eyebrow">THE STUDIO</p><h2 id="studio-title">{t('studio')}</h2></div></div>
        <div className="studio-grid">
          <div className="workspace" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0], 'photo'); }}>
            <div className="workspace-bar"><span>{t('yourPhoto')}</span><span className="muted">{photo?.name || t('noPhoto')}</span></div>
            {cameraOpen ? <div className="camera-state"><video ref={video} autoPlay playsInline muted aria-label={t('openCamera')} /><div className="camera-actions"><button className="button button-light" onClick={stopCamera}>{t('cancel')}</button><button className="button button-primary" onClick={snap}>{t('snap')} ◎</button></div></div>
              : photo ? <div className="preview-state"><div className="preview-panels"><figure><figcaption>{t('original')}</figcaption><img src={photo.url} alt={t('original')} /></figure><figure><figcaption>{t('result')}</figcaption>{result ? <img src={result.url} alt={t('result')} /> : <div className="result-placeholder">✦</div>}</figure></div><div className="preview-actions"><button className="button button-light" onClick={() => fileInput.current?.click()} disabled={busy}>{t('changePhoto')}</button><button className="button button-light" onClick={openCamera} disabled={busy || cameraRequesting}>{t('retakePhoto')} ◎</button><button className="button button-primary" onClick={download} disabled={!result || busy}>{t('download')} ↓</button><button className="button button-light" onClick={share} disabled={!result || busy}>{t('share')} ↗</button></div></div>
              : <div className="empty-state"><div className="upload-icon">↥</div><h3>{t('uploadTitle')}</h3><p>{t('uploadHelp')}</p><div className="upload-actions"><button className="button button-primary" onClick={() => fileInput.current?.click()}>{t('choosePhoto')} ↗</button><button className="button button-light" onClick={openCamera} disabled={cameraRequesting}>{t('openCamera')} ◎</button></div><p className="drop-hint">{t('dropHint')}</p></div>}
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => { acceptFile(event.target.files?.[0], 'photo'); event.target.value = ''; }} />
          </div>
          <aside className="style-panel">
            <div className="panel-title"><span className="step-badge">02</span><div><h2>{t('chooseStyle')}</h2><p>{t('styleIntro')}</p></div></div>
            <div className="style-list" role="radiogroup" aria-label={t('chooseStyle')}>
              {styles.map((item) => <button type="button" key={item.id} role="radio" aria-checked={styleId === item.id} className={'style-option ' + (styleId === item.id ? 'selected' : '')} disabled={busy} onClick={() => { setStyleId(item.id); clearResult(); }}>
                {item.image ? <img className="style-swatch" src={item.image} alt="" /> : <span className="style-swatch swatch-custom">✧</span>}
                <span><strong>{t(item.label)}</strong><small>{t(item.description)}</small></span><span className="check">✓</span>
              </button>)}
            </div>
            {styleId === 'custom' && <div className="reference-picker">
              <div className={'reference-dropzone' + (referenceDragging ? ' dragging' : '')} onDragEnter={(event) => { event.preventDefault(); setReferenceDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setReferenceDragging(false); }} onDrop={(event) => { event.preventDefault(); setReferenceDragging(false); if (!busy) acceptFile(event.dataTransfer.files?.[0], 'reference'); }}>
                {reference && <img className="reference-preview" src={reference.url} alt={t('customSelected')} />}
                <div><strong>{reference ? t('customSelected') : t('chooseReference')}</strong><p>{t('referenceDropHint')}</p>{reference && <small>{reference.name}</small>}</div>
                <button className="button button-light" type="button" onClick={() => referenceInput.current?.click()} disabled={busy}>{t('browseReference')}</button>
              </div>
              <p className="reference-note">{t('referenceTip')}</p>
              <label className="boost-toggle"><input type="checkbox" checked={illustrationBoost} onChange={(event) => { setIllustrationBoost(event.target.checked); clearResult(); }} disabled={busy} /><span><strong>{t('boostLabel')}</strong><small>{t('boostHelp')}</small></span></label>
            </div>}
            <input ref={referenceInput} type="file" accept="image/*" hidden onChange={(event) => { acceptFile(event.target.files?.[0], 'reference'); event.target.value = ''; }} />
            <div className="strength-row"><label htmlFor="strength">{t('strength')}</label><strong>{Math.round(strength * 100)}%</strong></div>
            <input id="strength" className="strength-slider" type="range" min="0.2" max="1" step="0.05" value={strength} disabled={busy} onChange={(event) => { setStrength(Number(event.target.value)); clearResult(); }} />
            <div className="strength-labels"><span>{t('gentle')}</span><span>{t('bold')}</span></div>
            <button className="button button-primary generate-button" onClick={generate} disabled={busy || !photo}>{busy ? t(phase === 'loading' ? 'loadingModel' : 'generating') : result ? t('regenerate') : t('generate')} <span>✦</span></button>
            <div className="style-hint">{t('aiNotice')}</div>
          </aside>
        </div>
        <p className="status" role="status" aria-live="polite">{statusKey ? t(statusKey) : ''}</p>
      </section>
      <section className="explain"><p>{t('artistNotice')}</p><p>{t('modelSource')}</p></section>
      <section className="how"><div><p className="eyebrow">HOW IT WORKS</p><h2>{t('how1')}<br />{t('how2')}</h2></div><div className="how-steps"><p><b>01</b><span>{t('step1')}</span></p><p><b>02</b><span>{t('step2')}</span></p><p><b>03</b><span>{t('step3')}</span></p></div></section>
    </main>
    <footer><span className="footer-brand">qute<span>.</span></span><span>{t('footer')}</span><span>v0.2.1 · React + AI</span></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
