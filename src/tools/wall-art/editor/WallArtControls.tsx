/** Minimal core editor within the existing bottom disclosure. */
import { PARAMETER_NAMES, PARAMETER_RULES } from '../model/parameters.ts';
import type { WallArtEditor } from './useWallArt.ts';

export function WallArtControls({ editor }: { editor: WallArtEditor }) {
  const { snapshot, drafts, inputError } = editor;
  const error = inputError ?? snapshot.error;
  return <section className="settings-group wall-art-controls" aria-labelledby="wall-art-controls-title">
    <h2 id="wall-art-controls-title">Blade pattern</h2>
    <p>Equal-height blades on a rectangular panel. Enter or leave a field to update.</p>
    <div className="parameter-grid">
      {PARAMETER_NAMES.map(name => {
        const rule = PARAMETER_RULES[name]; const inactive = name === 'topRatio' && Number(drafts.reliefHeight) === 0;
        return <div className="parameter-field" key={name}>
          <label htmlFor={`wall-art-${name}`}>{rule.label}{rule.unit && <span> ({rule.unit})</span>}</label>
          <input id={`wall-art-${name}`} type="number" min={rule.min} max={rule.max} step="any" inputMode={name === 'seed' ? 'numeric' : 'decimal'}
            value={drafts[name]} disabled={inactive} aria-invalid={error?.field === name}
            aria-describedby={`wall-art-${name}-hint${error?.field === name ? ' wall-art-error' : ''}`}
            onChange={event => editor.change(name, event.target.value)} onBlur={editor.commit}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); editor.commit(); } }} />
          <small id={`wall-art-${name}-hint`}>{inactive ? 'Inactive when relief height is 0.' : name === 'seed' ? '1–9999 · No visible effect in this pattern.' : `${rule.min}–${rule.max}${name === 'topRatio' ? ' · X direction only' : ''}`}</small>
        </div>;
      })}
    </div>
    <div className="model-actions">
      <button type="button" onClick={editor.revert}>Revert to accepted design</button>
      <label className="design-file-label" htmlFor="wall-art-file">Load design JSON<input id="wall-art-file" type="file" accept=".json,application/json" disabled={snapshot.status === 'failed'} onChange={event => { void editor.load(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <button type="button" disabled={!editor.ready} onClick={() => editor.save()}>Save design JSON</button>
    </div>
    <h3>Export assembled model</h3>
    <p>Millimeters. Separate parts in assembly positions; no build-plate packing.</p>
    <div className="model-actions">
      {(['step', 'stl', '3mf'] as const).map(format => <button type="button" key={format} disabled={!editor.ready} onClick={() => editor.exportModel(format)}>Export {format.toUpperCase()}</button>)}
      {snapshot.exporting && <button type="button" onClick={editor.cancelExport}>Cancel export</button>}
    </div>
    {snapshot.status === 'failed' && <><button type="button" onClick={editor.retry}>Retry generation</button>
      <p>CAD is unavailable. You can save valid parameters without a generated model.</p>
      <button type="button" disabled={!editor.validDraft} onClick={() => editor.save(true)}>Save ungenerated parameters</button></>}
  </section>;
}

export function WallArtNotice({ editor, review }: { editor: WallArtEditor; review: (field?: string) => void }) {
  const { snapshot } = editor; const error = editor.inputError ?? snapshot.error;
  const status = snapshot.status === 'starting' ? 'Loading CAD engine…' : snapshot.status === 'recovering' ? 'Restoring the accepted CAD model…' : snapshot.status === 'generating' ? 'Generating model…' : snapshot.status === 'failed' ? 'CAD unavailable.' : 'Model ready.';
  return <section className={`notice${error ? ' field-error' : ''}`} aria-label="Model status">
    <p>{status}{snapshot.exporting ? ` Preparing ${snapshot.exporting.toUpperCase()} from the captured design.` : ''}{editor.loadingFile ? ' Reading design file…' : ''}</p>
    {error && <><p id="wall-art-error">{error.message}</p><button type="button" onClick={() => review(error.field)}>Review model settings</button></>}
    {!error && editor.dirty && snapshot.status === 'ready' && <p>Uncommitted changes. Enter a valid value or revert to enable export.</p>}
    {['starting', 'generating'].includes(snapshot.status) && <button type="button" onClick={editor.revert}>Cancel generation</button>}
    {snapshot.status === 'failed' && <button type="button" onClick={editor.retry}>Retry CAD engine</button>}
  </section>;
}
