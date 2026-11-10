/** Accepted contour geometry only. Plan labels and lookup selection are preview
 * annotations; they never modify printable meshes or native export sources. */
import type { LayoutSnapshot } from '../geometry/batch-protocol.ts';

export function WallArtPlan({layout,number,setNumber}:{layout:LayoutSnapshot;number:number;setNumber:(value:number)=>void}) {
  const index=Math.min(Math.max(number-1,0),layout.bases.length-1),base=layout.bases[index]!,part=layout.parts[index]!;
  const {min,max}=layout.result.bounds,width=max[0]-min[0],height=max[1]-min[1],pad=Math.max(width,height)*.04;
  const status=part.identification.status==='engraved'?`Engraved · ${part.identification.height.toFixed(2)} mm numeral${part.identification.orientationMark?' · +Y arrow':''}`:part.identification.status==='map-only'?'Map-only ID':'Engraving disabled';
  const box=part.assemblyBounds,detailWidth=box.max[0]-box.min[0],detailHeight=box.max[1]-box.min[1],detailPad=Math.max(detailWidth,detailHeight)*.15;
  return <section className="numbered-plan" aria-label="Numbered plan">
    <svg className="plan-drawing" viewBox={`${min[0]-pad} ${-max[1]-pad} ${width+pad*2} ${height+pad*2}`} role="img" aria-label={`Assembly front view, ${layout.bases.length} numbered parts; ${layout.excluded.length} excluded fragments; selected part ${index+1}. +Y points up.`}>
      {layout.bases.map((item,i)=><g key={item.id} className={i===index?'plan-part selected':'plan-part'}>{item.paths.flat().map((path,j)=><path key={j} d={path}/>)}<text x={item.centroid[0]} y={-item.centroid[1]} fontSize={Math.min(layout.parameters.pitch*.2,10)} textAnchor="middle" dominantBaseline="central">{item.mapNumber}</text></g>)}
      {layout.excluded.map(item=><g className="plan-excluded" key={item.id}>{item.paths.flat().map((path,j)=><path key={j} d={path}/>)}<text x={item.centroid[0]} y={-item.centroid[1]} fontSize={Math.min(layout.parameters.pitch*.22,12)} textAnchor="middle">×</text></g>)}
    </svg>
    <div className="part-lookup">
      <p>Assembly front view · +Y up. Turn a part over about its local X axis to read its underside number. Excluded fragments use dashed outlines and × marks.</p>
      <div className="model-actions"><button type="button" disabled={index===0} onClick={()=>setNumber(index)}>Previous part</button><label htmlFor="lookup-number">Part number<input id="lookup-number" type="number" min={1} max={layout.bases.length} step={1} value={index+1} onChange={event=>{const value=Number(event.target.value);if(Number.isInteger(value)&&value>=1&&value<=layout.bases.length)setNumber(value);}}/></label><button type="button" disabled={index===layout.bases.length-1} onClick={()=>setNumber(index+2)}>Next part</button></div>
      <p aria-live="polite">Part {index+1} of {layout.bases.length} · {status}</p><p className="part-identity">{base.id}</p>
      {part.identification.status==='map-only'&&<p>{part.identification.reason==='residual-floor'?'This valid part is too thin for the requested underside cuts. Number and arrow were omitted.':'The underside number and arrow could not fit within the required clearances. Both marks were omitted.'}</p>}
      <svg className="part-detail" viewBox={`${box.min[0]-detailPad} ${-box.max[1]-detailPad} ${detailWidth+2*detailPad} ${detailHeight+2*detailPad}`} role="img" aria-label={`Part ${index+1} enlarged front-view contour. Assembly +Y points up.`}>
        <g className="plan-part selected">{base.paths.flat().map((path,i)=><path key={i} d={path}/>)}</g>
      </svg>
      <p>Selected contour · front view · +Y up. Match this shape and orientation when the part has a map-only ID.</p>
    </div>
  </section>;
}
