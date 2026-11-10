/** Generator-3 drafts use displayed percentages; all inactive values stay editable. */
import { NUMERIC_RULES_V3, SURFACE_FAMILIES } from '../model/parameters-v3.ts';
import type { WallArtEditor } from './useWallArt.ts';

const descriptions:Record<string,string>={wave:'Regular smooth parallel rises and falls.',dunes:'Unequal smooth undulations.',ring:'Circular bands around a low center.',
  dome:'One central circular mound, cropped by the outline.',spiral:'Winding arms around the center.',ridges:'Bent bands with sharper peaks than Wave.',random:'Reproducible smooth scattered hills.'};
const labels:Partial<Record<keyof typeof NUMERIC_RULES_V3,string>>={depth:'Surface amplitude',density:'Pattern density',rotation:'Surface rotation',phase:'Surface phase',topRatio:'Top size',stepBlend:'Top blend',baseThickness:'Plinth thickness'};
export function SurfaceShapeControls({editor}:{editor:WallArtEditor}) {
  const {drafts}=editor,error=editor.inputError??editor.snapshot.error,family=drafts.family;
  const still=Number(drafts.depth)===0,plinthOnly=still&&Number(drafts.minimumRelief)===0&&drafts.plinthEnabled==='true';
  const help:Partial<Record<keyof typeof NUMERIC_RULES_V3,string>>={
    depth:'Height variation above the minimum relief.',density:family==='dome'?'No effect for Dome.':family==='wave'?'Cycles per shorter nominal panel side. Higher values make tighter features.':'Higher values make tighter features.',
    rotation:['ring','dome'].includes(family??'')?'No effect for Ring or Dome.':'Counterclockwise, viewed from the front. Rotates the surface, not the layout.',
    phase:['ring','dome'].includes(family??'')?'No effect for Ring or Dome.':'Moves the pattern through its cycle.',
    spiralArms:family==='spiral'?'Number of winding arms.':'No effect: used only by Spiral.',
    surfaceSeed:['dunes','ridges','random'].includes(family??'')?'Repeats Dunes, Ridges and Random. Does not rearrange cells.':'No effect for this family. Repeats Dunes, Ridges and Random.',
    minimumRelief:drafts.plinthEnabled==='true'?'Height above each plinth before surface variation.':'Height from the wall-facing base plane before surface variation.',
    topRatio:'Width and height of the top relative to its base.',concavity:'Straight 1 — strongly inward-curved 4.',
    stepBlend:'Continuous 0 — stepped 100. Stepped gives one horizontal top per piece. Continuous follows the surface across each top.',
    baseThickness:drafts.plinthEnabled==='true'?'Thickness of each separate plinth.':'No effect while the plinth is off. Your value is retained.',
  };
  const numeric=(name:keyof typeof NUMERIC_RULES_V3,range=false)=>{
    const rule=NUMERIC_RULES_V3[name],percentage=name==='topRatio'||name==='stepBlend',min=percentage?rule.min*100:rule.min,max=percentage?rule.max*100:rule.max;
    const unit=percentage?'%':rule.unit,label=labels[name]??rule.label,step=percentage?1:rule.step;
    const value=drafts[name]??'',valid=value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
    const hint=`wall-art-${name}-hint`,invalid=error?.field===name;
    return <div className="parameter-field" key={name}>
      <label htmlFor={`wall-art-${name}`}>{label}{unit&&` (${unit})`}</label>
      <input id={`wall-art-${name}`} type="number" min={min} max={max} step={step} inputMode={['surfaceSeed','spiralArms'].includes(name)?'numeric':'decimal'}
        value={value} aria-invalid={invalid} aria-describedby={`${hint}${invalid?' wall-art-error':''}`}
        onChange={event=>editor.change(name,event.target.value)} onBlur={editor.commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();editor.commit();}}}/>
      {range&&<input type="range" aria-label={`${label} range`} min={min} max={max} step={step} value={valid?Number(value):min} disabled={!valid}
        aria-valuetext={valid?`${value}${unit?' '+unit:''}; exact value in numeric entry`:'Enter a valid number first'} aria-describedby={hint}
        onChange={event=>editor.change(name,event.target.value)} onPointerUp={editor.commit} onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))editor.commit();}} onBlur={editor.commit}/>}
      <small id={hint}>{min}–{max}{unit?` ${unit}`:''} · {help[name]}{range&&!valid?' Enter a valid number to use the range.':''}</small>
    </div>;
  };
  const checkbox=(name:'plinthEnabled'|'planarTops',label:string,help:string)=><div className="layout-policies">
    <label htmlFor={`wall-art-${name}`}><input id={`wall-art-${name}`} type="checkbox" checked={drafts[name]==='true'} aria-describedby={`wall-art-${name}-hint`}
      aria-invalid={error?.field===name} onChange={event=>{editor.change(name,String(event.target.checked));editor.commit();}}/>{label}</label>
    <p id={`wall-art-${name}-hint`}>{help}</p></div>;
  return <div className="surface-shape-controls">
    <section aria-labelledby="surface-title"><h3 id="surface-title" tabIndex={-1}>Surface</h3>
      <div className="parameter-field"><label htmlFor="wall-art-family">Surface family</label><select id="wall-art-family" value={family} aria-describedby="surface-character"
        onChange={event=>{editor.change('family',event.target.value);editor.commit();}}>{SURFACE_FAMILIES.map(value=><option key={value} value={value}>{value[0]!.toUpperCase()+value.slice(1)}</option>)}</select>
        <small id="surface-character">{descriptions[family??'']}</small></div>
      <div className="parameter-grid">{numeric('depth')}{numeric('density',true)}</div>
      {still&&<p>Surface settings are retained; they do not change height while amplitude is 0.</p>}
      <details className="layout-advanced"><summary>Advanced surface</summary><div className="parameter-grid">{numeric('rotation')}{numeric('phase')}{numeric('spiralArms')}{numeric('surfaceSeed')}</div></details>
      <p>The pattern grows when both panel dimensions grow; heights and cell pitch do not. Scale uses the shorter nominal panel side.</p>
    </section>
    <section aria-labelledby="shape-title"><h3 id="shape-title" tabIndex={-1}>Shape</h3>
      <div className="parameter-grid">{numeric('minimumRelief')}{numeric('topRatio',true)}{numeric('concavity',true)}{numeric('stepBlend',true)}</div>
      {plinthOnly&&<p>Plinths only. Relief shape settings have no effect.</p>}
      {Number(drafts.topRatio)<40&&<p>Narrow tops can make blend and Planar tops differences subtle.</p>}
      {checkbox('plinthEnabled','Include per-part plinth','A separate base under each piece, not a shared backing.')}
      <div className="parameter-grid">{numeric('baseThickness')}</div>
      <details className="layout-advanced"><summary>Advanced shape</summary>{checkbox('planarTops','Planar tops',Number(drafts.stepBlend)===100?'No effect: stepped tops are already horizontal. Your choice is retained.':'One flat face per top; it may slope.')}</details>
    </section>
  </div>;
}
