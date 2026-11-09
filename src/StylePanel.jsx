import React, { useEffect, useState } from 'react';
import { engines, engineById, goals } from './engines/registry';
import { describePipeline, formatStep } from './engines/summary';

const goalIcons = { close: '◐', cute: '♡', chibi: '☻', bold: '✸', custom: '⚙' };
const warpKeys = ['head', 'eyes', 'chin', 'body'];
export const WIDE_QUERY = '(min-width: 1500px)';

function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05, disabled, help, percent = true }) {
  return <label className="detail-control">
    <span>{label}{help && <i className="info" aria-hidden="true">i</i>} <strong>{percent ? Math.round(value * 100) + '%' : value}</strong></span>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    {help && <small className="help" role="note">{help}</small>}
  </label>;
}

export default function StylePanel(props) {
  const {
    t, busy, goal, chooseGoal, settings, updateSettings, styles, styleId, chooseReference,
    reference, referenceInput, referenceDragging, setReferenceDragging, acceptFile,
    serverURL, setServerURL, connectServer, serverEngines, serverState, generate, photo, result, workspace
  } = props;
  const engine = engineById(settings.engine);
  const hasReference = styleId !== 'none';
  const set = (key) => (value) => updateSettings({ [key]: value });
  const setWarp = (key) => (value) => updateSettings({ warp: { ...settings.warp, [key]: value } });
  const serverAvailable = (id) => serverEngines.includes(id);
  const wide = useMediaQuery(WIDE_QUERY);
  const medium = useMediaQuery('(min-width: 1000px)');
  const steps = describePipeline(settings, { hasReference: styleId !== 'none' && (styleId !== 'custom' || !!reference), serverEngines });

  const advancedBody = <div className="advanced-body">
      <label className="field"><span>{t('engine')}</span>
        <select value={settings.engine} disabled={busy} onChange={(event) => updateSettings({ engine: event.target.value, variant: engineById(event.target.value).variants?.[0] || '' })}>
          <optgroup label={t('browserEngines')}>{engines.filter((e) => e.kind === 'browser').map((e) => <option key={e.id} value={e.id} disabled={e.needsReference && !hasReference}>{t('engine_' + e.id)}</option>)}</optgroup>
          <optgroup label={t('serverEngines')}>{engines.filter((e) => e.kind === 'server').map((e) => <option key={e.id} value={e.id} disabled={!serverAvailable(e.id)}>{t('engine_' + e.id)}{serverAvailable(e.id) ? '' : ' — ' + t('needsServer')}</option>)}</optgroup>
        </select>
      </label>
      {engine && <p className="engine-credit span-2">{t('engine_' + engine.id + '_desc')}{engine.citation !== '—' && <><br /><em>{engine.citation}</em>{engine.repo && <> · <a href={'https://github.com/' + engine.repo} target="_blank" rel="noreferrer">{engine.repo}</a></>}{engine.license && <> · {engine.license}</>}</>}</p>}
      {engine?.variants && <label className="field"><span>{t('variant')}</span>
        <select value={settings.variant || engine.variants[0]} disabled={busy} onChange={(event) => updateSettings({ variant: event.target.value })}>{engine.variants.map((v) => <option key={v} value={v}>{t('variant_' + v)}</option>)}</select>
      </label>}
      {engine?.id === 'vtoonify' && <Slider label={t('styleDegree')} value={settings.styleDegree} onChange={set('styleDegree')} disabled={busy} help={t('styleDegreeHelp')} />}
      {engine?.id === 'warpgan' && <Slider label={t('exaggeration')} value={settings.exaggeration} min={0.2} max={2} step={0.1} onChange={set('exaggeration')} disabled={busy} percent={false} />}
      {engine?.id === 'instantid-chibi' && <Slider label={t('identity')} value={settings.identity} min={0.3} max={1.2} onChange={set('identity')} disabled={busy} help={t('identityHelp')} />}
      {engine?.kind === 'browser' && <fieldset className="warp-controls span-2"><legend>{t('warpTitle')}</legend>
        {warpKeys.map((key) => <Slider key={key} label={t('warp_' + key)} value={settings.warp[key]} onChange={setWarp(key)} disabled={busy} />)}
        <small>{t('warpHelp')}</small>
      </fieldset>}
      <Slider label={t('cuteGrade')} value={settings.cute} onChange={set('cute')} disabled={busy} />
      {engine?.kind === 'browser' && <Slider label={t('detailRetention')} value={settings.detail} max={0.6} onChange={set('detail')} disabled={busy} help={t('detailRetentionHelp')} />}
      <label className="field"><span>{t('outputSize')}</span>
        <select value={settings.maxSide} disabled={busy} onChange={(event) => updateSettings({ maxSide: Number(event.target.value) })}>{[512, 768, 1024].map((s) => <option key={s} value={s}>{s}px{s === 1024 ? ' · ' + t('slower') : ''}</option>)}</select>
      </label>
      <div className="server-box span-2">
        <label className="field"><span>{t('serverURL')}</span>
          <input type="url" inputMode="url" placeholder="http://localhost:8765" value={serverURL} disabled={busy} onChange={(event) => setServerURL(event.target.value)} />
        </label>
        <button type="button" className="button button-light" onClick={connectServer} disabled={busy || serverState === 'checking'}>{serverState === 'checking' ? t('serverChecking') : t('serverConnect')}</button>
        <small>{serverState === 'ok' ? t('serverOk') + ' ' + (serverEngines.length ? serverEngines.map((id) => t('engine_' + id)).join('、') : t('serverNone')) : serverState === 'error' ? t('serverError') : t('serverHelp')}</small>
      </div>
  </div>;
  const advancedPanel = wide
    ? <section className="advanced-panel open"><div className="panel-title"><span className="step-badge">03</span><div><h2>{t('advanced')}</h2><p>{t('advancedIntro')}</p></div></div>{advancedBody}</section>
    : <details className="advanced-panel advanced" open={medium || goal === 'custom' || undefined}><summary><span className="step-badge small">03</span>{t('advanced')}</summary>{advancedBody}</details>;

  const goalsSection = <section className="panel goals-panel" aria-label={t('chooseGoal')}>
    <div className="panel-title"><span className="step-badge">02</span><div><h2>{t('chooseGoal')}</h2><p>{t('goalIntro')}</p></div></div>
    <div className="goal-grid" role="radiogroup" aria-label={t('chooseGoal')}>
      {Object.keys(goals).map((id) => <button type="button" key={id} role="radio" aria-checked={goal === id} className={'goal-option goal-' + id + (goal === id ? ' selected' : '')} disabled={busy} onClick={() => chooseGoal(id)}>
        <span className="goal-icon" aria-hidden="true">{goalIcons[id]}</span>
        <strong>{t('goal_' + id)}</strong>
        <small>{t('goal_' + id + '_desc')}</small>
      </button>)}
    </div>
    {goal === 'chibi' && <p className="reference-note">{serverAvailable('instantid-chibi') ? t('chibiServerOn') : t('chibiBrowserNote')}</p>}

  </section>;
  const referenceSection = <section className="panel reference-panel">
    <h3 className="panel-subtitle">{t('referenceOptional')}</h3>
    <div className="style-list compact" role="radiogroup" aria-label={t('referenceOptional')}>
      {styles.map((item) => <button type="button" key={item.id} role="radio" aria-checked={styleId === item.id} className={'style-option ' + (styleId === item.id ? 'selected' : '')} disabled={busy} onClick={() => chooseReference(item.id)}>
        {item.image ? <img className="style-swatch" src={item.image} alt="" /> : <span className="style-swatch swatch-custom">{item.id === 'none' ? '∅' : '✧'}</span>}
        <span><strong>{t(item.label)}</strong><small>{t(item.description)}</small></span><span className="check">✓</span>
      </button>)}
    </div>
    {styleId === 'custom' && <div className="reference-picker">
      <div className={'reference-dropzone' + (referenceDragging ? ' dragging' : '')} onDragEnter={(event) => { event.preventDefault(); setReferenceDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setReferenceDragging(false); }} onDrop={(event) => { event.preventDefault(); setReferenceDragging(false); if (!busy) acceptFile(event.dataTransfer.files?.[0], 'reference'); }}>
        {reference && <img className="reference-preview" src={reference.url} alt={t('customSelected')} />}
        <div><strong>{reference ? t('customSelected') : t('chooseReference')}</strong><p>{t('referenceDropHint')}</p>{reference && <small>{reference.name}</small>}</div>
        <button className="button button-light" type="button" onClick={() => referenceInput.current?.click()} disabled={busy}>{t('browseReference')}</button>
      </div>
    </div>}
    {hasReference && <div className="reference-controls">
      <Slider label={t('refPalette')} value={settings.palette} onChange={set('palette')} disabled={busy} help={t('refPaletteHelp')} />
      <Slider label={t('refTexture')} value={settings.texture} max={1} onChange={set('texture')} disabled={busy} help={t('refTextureHelp')} />
      {settings.texture > 0 && <Slider label={t('faceProtect')} value={settings.faceProtect} onChange={set('faceProtect')} disabled={busy} help={t('faceProtectHelp')} />}
    </div>}


  </section>;
  const actionSection = <section className="panel action-panel">
    <div className="pipeline-summary" aria-live="polite">
      <strong>{t('summaryTitle')}</strong>
      <div className="steps">{steps.map((step, i) => <React.Fragment key={i}>{i > 0 && <span className="arrow" aria-hidden="true">→</span>}<span className={'step' + (step.warn ? ' warn' : '')}>{formatStep(step, t, (id) => t('engine_' + id))}</span></React.Fragment>)}</div>
    </div>
    <button className="button button-primary generate-button" onClick={generate} disabled={busy || !photo}>{busy ? t('working') : result ? t('regenerate') : t('generate')} <span>✦</span></button>
    <div className="style-hint">{engine?.kind === 'server' ? t('serverNotice') : t('aiNotice')}</div>
  </section>;

  // Wide: photo + transform | goal + reference | advanced.  Medium: photo + transform | goal +
  // reference, then advanced across the full width.  Narrow: one column in working order.
  if (wide) return <div className="studio-grid layout-wide">
    <div className="col">{workspace}{actionSection}</div>
    <div className="col">{goalsSection}{referenceSection}</div>
    <div className="col">{advancedPanel}</div>
  </div>;
  if (medium) return <div className="studio-grid layout-medium">
    <div className="col">{workspace}{actionSection}</div>
    <div className="col">{goalsSection}{referenceSection}</div>
    <div className="col span-all">{advancedPanel}</div>
  </div>;
  return <div className="studio-grid layout-narrow">
    <div className="col">{workspace}{goalsSection}{referenceSection}{actionSection}{advancedPanel}</div>
  </div>;
}
