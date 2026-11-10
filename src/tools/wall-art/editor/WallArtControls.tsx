/** Versioned model controls within the existing bottom disclosure. */
import { PARAMETER_NAMES, PARAMETER_RULES } from '../model/parameters.ts';
import { NUMERIC_NAMES_V2, NUMERIC_RULES_V2, OUTLINES, LAYOUTS, SIZE_SHORTCUTS } from '../model/parameters-v2.ts';
import type { WallArtEditor } from './useWallArt.ts';
import { SurfaceShapeControls } from './SurfaceShapeControls.tsx';

export function WallArtControls({ editor }: { editor: WallArtEditor }) {
  const { snapshot, drafts, inputError } = editor;
  const error = inputError ?? snapshot.error;
  const advanced = ['pitch','gap','seed','engravingDepth','numeralRatio'];
  const numericFields = (names: readonly string[]) => <div className="parameter-grid">{names.map(name => {
    const rule = editor.version===1?PARAMETER_RULES[name as keyof typeof PARAMETER_RULES]:NUMERIC_RULES_V2[name as keyof typeof NUMERIC_RULES_V2];
    const inactive = editor.version!==3&&(name==='topRatio'&&Number(drafts.reliefHeight)===0||name==='numeralRatio'&&Number(drafts.engravingDepth)===0);
    return <div className="parameter-field" key={name}>
      <label htmlFor={`wall-art-${name}`}>{name==='seed'&&editor.version===3?'Layout seed':rule.label}{rule.unit&&<span> ({rule.unit})</span>}</label>
      <input id={`wall-art-${name}`} type="number" min={rule.min} max={rule.max} step="any" inputMode={name==='seed'?'numeric':'decimal'}
        value={drafts[name]} disabled={inactive} aria-invalid={error?.field===name}
        aria-describedby={`wall-art-${name}-hint${error?.field===name?' wall-art-error':''}`}
        onChange={event=>editor.change(name,event.target.value)} onBlur={editor.commit}
        onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();editor.commit();}}}/>
      <small id={`wall-art-${name}-hint`}>{inactive?name==='numeralRatio'?'Inactive when engraving depth is 0.':'Inactive when relief height is 0.':name==='seed'?editor.version!==1&&drafts.layout==='irregular'?'1–9999 · Repeats irregular cell placement. Does not change the surface field at a fixed location; different cells can sample different heights.':'1–9999 · No visible effect in this layout.':`${rule.min}–${rule.max}${name==='topRatio'?' · X direction only':''}`}</small>
    </div>;
  })}</div>;
  return <section className="settings-group wall-art-controls" aria-labelledby="wall-art-controls-title">
    <h2 id="wall-art-controls-title" tabIndex={-1}>{editor.version===3?'Shape and surface':'Blade pattern'}</h2>
    <p>{editor.version===1?'Generator 1 · Original blade geometry.':editor.version===2?'Generator 2 · Clipped layouts with underside identification.':'Generator 3 · Native shape and surface relief.'} Enter or leave a field to update.</p>
    {editor.version!==3&&<div className="model-actions"><button type="button" disabled={!editor.ready} onClick={editor.upgrade}>Preview upgrade to generator 3</button><p>Your original design stays accepted until you confirm. The upgrade keeps layout, heights, top ratio and layout seed, with zero surface amplitude and straight sides. Top taper now changes both axes.{editor.version===1?' This direct upgrade adds no underside marks.':''}</p></div>}
    {editor.version===3&&<SurfaceShapeControls editor={editor}/>}
    {editor.version===3&&<h3>Layout and identification</h3>}
    {editor.version!==1&&<><div className="model-actions" aria-label="Panel size shortcuts">{SIZE_SHORTCUTS.map(([width,height])=><button type="button" key={`${width}-${height}`} onClick={()=>editor.shortcut(width,height)}>{width} × {height} mm</button>)}</div>
      <div className="parameter-grid">{(['outline','layout'] as const).map(name=><div className="parameter-field" key={name}><label htmlFor={`wall-art-${name}`}>{name==='outline'?'Outline':'Cell layout'}</label><select id={`wall-art-${name}`} value={drafts[name]} onChange={event=>{editor.change(name,event.target.value);editor.commit();}}>{(name==='outline'?OUTLINES:LAYOUTS).map(value=><option key={value} value={value}>{value[0]!.toUpperCase()+value.slice(1)}</option>)}</select></div>)}</div></>}
    {numericFields(editor.version===1?PARAMETER_NAMES:editor.version===3?['width','height']:NUMERIC_NAMES_V2.filter(name=>!advanced.includes(name)))}
    {editor.version!==1&&<details className="layout-advanced"><summary>Advanced layout and identification</summary>
      {numericFields(NUMERIC_NAMES_V2.filter(name=>advanced.includes(name)))}<div className="layout-policies">
      <label><input type="checkbox" checked={drafts.straightBoundary==='true'} disabled={editor.version!==3&&(drafts.outline!=='rectangle'||!['hexagonal','triangular'].includes(drafts.layout??''))} onChange={event=>{editor.change('straightBoundary',String(event.target.checked));editor.commit();}}/> Straight boundary</label>
      <p>{drafts.outline!=='rectangle'?'Inactive: this outline always clips every cell.':!['hexagonal','triangular'].includes(drafts.layout??'')?'Inactive for this layout; cells always clip to the outline.':'Off keeps whole edge cells and can exceed the nominal panel dimensions.'}</p>
      <label><input type="checkbox" checked={drafts.orientationMark==='true'} disabled={editor.version!==3&&Number(drafts.engravingDepth)===0} onChange={event=>{editor.change('orientationMark',String(event.target.checked));editor.commit();}}/> Underside orientation mark</label>
      <p>{Number(drafts.engravingDepth)===0?'Inactive: engraving depth is 0.':'Recessed arrow points to assembly +Y. Parts that cannot fit both cuts retain a map-only ID.'}</p>
      <p>4,000-part hard ceiling; 120 seconds per generation or export; 2 GB memory budget. Complex designs can exceed work, mesh or memory limits. These limits do not promise throughput.</p>
    </div></details>}
    <h3>Files and export</h3><div className="model-actions">
      <button type="button" onClick={editor.revert}>Revert to accepted design</button>
      <label className="design-file-label" htmlFor="wall-art-file">Load design JSON<input id="wall-art-file" type="file" accept=".json,application/json" disabled={snapshot.status === 'failed'} onChange={event => { void editor.load(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <button type="button" disabled={!editor.ready} onClick={() => editor.save()}>Save design JSON</button>
    </div>
    <h3>Export assembled model</h3>
    <p>Millimeters. Separate parts in assembly positions; no build-plate packing.</p>
    <div className="model-actions">
      {(['step', 'stl', '3mf'] as const).map(format => <button type="button" key={format} disabled={!editor.exportReady} onClick={() => editor.exportModel(format)}>Export {format.toUpperCase()}</button>)}
      {snapshot.exporting && <button type="button" onClick={editor.cancelExport}>Cancel export</button>}
    </div>
    {editor.downloadHeld&&<><p>The download uses a temporary browser file. After it finishes, release the file before another export.</p><button type="button" onClick={()=>void editor.releaseDownload()}>Release downloaded file</button></>}
    {snapshot.status === 'failed' && <><button type="button" onClick={editor.retry}>Retry generation</button>
      <p>CAD is unavailable. You can save valid parameters without a generated model.</p>
      <button type="button" disabled={!editor.validDraft} onClick={() => editor.save(true)}>Save ungenerated parameters</button></>}
  </section>;
}

export function WallArtNotice({ editor, review }: { editor: WallArtEditor; review: (field?: string) => void }) {
  const { snapshot } = editor; const error = editor.inputError ?? snapshot.error;
  const layout=snapshot.accepted?.layout;
  const mapOnly=layout?.parts.filter(part=>part.identification.status==='map-only')??[];
  const overflow=layout&&layout.parameters.outline==='rectangle'&&!layout.parameters.straightBoundary&&
    (layout.result.bounds.min[0]<-layout.parameters.width/2-.001||layout.result.bounds.max[0]>layout.parameters.width/2+.001||
      layout.result.bounds.min[1]<-layout.parameters.height/2-.001||layout.result.bounds.max[1]>layout.parameters.height/2+.001);
  const status = snapshot.status === 'starting' ? 'Preparing the stepped-wave design…' : snapshot.status === 'recovering' ? 'Restoring the accepted CAD model…' : snapshot.status === 'generating' ? snapshot.accepted?'Generating model — previous valid design shown.':'Preparing the stepped-wave design…' : snapshot.status === 'failed' ? 'CAD unavailable.' : error?'Previous valid design shown.':snapshot.upgrade?'Upgrade preview — not accepted.':'Model ready.';
  return <section className={`notice${error ? ' field-error' : ''}`} aria-label="Model status">
    <p>{status}{snapshot.exporting ? ` Preparing ${snapshot.exporting.toUpperCase()} from the captured design.` : ''}{editor.loadingFile ? ' Reading design file…' : ''}</p>
    {snapshot.progress&&<p aria-live="off">{snapshot.progress.stage}: {snapshot.progress.completed} of {snapshot.progress.total} items.</p>}
    {snapshot.accepted&&<p>Accepted generator {snapshot.accepted.definition.generatorVersion}{snapshot.accepted.definition.generatorVersion===3?` · ${snapshot.accepted.definition.parameters.family}`:''} · {snapshot.accepted.result.parts.length} parts · {snapshot.accepted.result.bounds.max.map((v,i)=>(v-snapshot.accepted!.result.bounds.min[i]!).toFixed(2)).join(' × ')} mm</p>}
    {overflow&&<p>Whole-cell edge exceeds nominal size. The dimensions shown describe the actual assembly.</p>}
    {mapOnly.length>0&&!snapshot.upgrade&&<><p>Map-only ID · {mapOnly.length} valid parts have no underside number or arrow. The numbered plan explains each reason.</p><button type="button" onClick={editor.reviewMapOnly}>Review map-only parts</button></>}
    {snapshot.upgrade&&<><p>The original generator-{snapshot.accepted?.definition.generatorVersion} design is still accepted. Candidate: {snapshot.upgrade.result.parts.length} parts · {snapshot.upgrade.result.bounds.max.map((v,i)=>(v-snapshot.upgrade!.result.bounds.min[i]!).toFixed(2)).join(' × ')} mm. {snapshot.upgrade.correspondence.length} part identities matched.</p><button type="button" onClick={editor.confirmUpgrade}>Confirm upgrade</button><button type="button" onClick={editor.revert}>Cancel upgrade</button></>}
    {snapshot.accepted?.layout&&snapshot.accepted.layout.excluded.length>0&&<><p>{snapshot.accepted.layout.excluded.length} small fragments excluded. Review their locations in the numbered plan.</p>{snapshot.acknowledgedKey!==snapshot.accepted.layout.exclusionKey&&<button type="button" onClick={editor.acknowledge}>Acknowledge excluded fragments</button>}</>}
    {error && <><p id="wall-art-error">{error.message}</p><button type="button" onClick={() => review(error.field)}>Review model settings</button></>}
    {!error && editor.dirty && snapshot.status === 'ready' && <p>Uncommitted changes. Enter a valid value or revert to enable export.</p>}
    {['starting', 'generating'].includes(snapshot.status) && <button type="button" onClick={editor.revert}>Cancel generation</button>}
    {snapshot.status === 'failed' && <button type="button" onClick={editor.retry}>Retry CAD engine</button>}
  </section>;
}
