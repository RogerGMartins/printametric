import wasmURL from 'replicad-opencascadejs/wasm?url';
import { DEFAULT_PARAMETERS_V2 } from '../../../src/tools/wall-art/model/parameters-v2.ts';
import { enumerateCells } from '../../../src/tools/wall-art/geometry/layouts/cells.ts';
import { clearancePairs } from '../../../src/tools/wall-art/geometry/clearance.ts';
import { LIMITS_V2 } from '../../../src/tools/wall-art/model/validation-v2.ts';

const renderLayout=new URLSearchParams(location.search).has('render')?(await import('./preview.jsx')).renderLayout:null;
if(new URLSearchParams(location.search).has('exports'))await import('./exports.js');

// Fixed approved initial/replacement policy, not a concurrency sweep.
window.profileRealLayout=async(parameters={...DEFAULT_PARAMETERS_V2,width:1600,height:800})=>{
  const started=performance.now(), active=new Set(), reports=[];
  const accepted=window.retainedRealLayout, workers=accepted?2:3;
  const acceptedBytes=accepted?.retainedBytes??0;
  const footprintKeys=['width','height','outline','layout','pitch','gap','seed','straightBoundary'];
  const reusedPartition=Boolean(accepted&&footprintKeys.every(key=>accepted.parameters[key]===parameters[key]));
  // Allocate half the approved total to three native heaps; retain the other half
  // for accepted/candidate data, preview copies and browser/controller overhead.
  const memoryLimit=LIMITS_V2.memoryBytes, reservation=Math.floor(memoryLimit/6);
  let retainedBytes=0,operations=0,triangles=0,completed=0,stage='initialize';
  const progress=()=>window.layoutProbeProgress?.({stage,completed,retainedBytes,acceptedBytes,workers,reusedPartition,operations,elapsedMs:performance.now()-started});
  const module=await WebAssembly.compile(await(await fetch(wasmURL)).arrayBuffer());
  async function batch(items) {
    const remaining=120_000-(performance.now()-started);
    if(remaining<=0)throw Error('120-second real geometry watchdog');
    if(workers*reservation+acceptedBytes+retainedBytes*2>memoryLimit)throw Error('Real geometry aggregate memory reservation exceeded');
    const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});active.add(worker);
    try {
      const result=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('120-second real geometry watchdog')),remaining);
        worker.onmessage=({data})=>{clearTimeout(timer);data.error?reject(Error(data.error)):resolve(data);};
        worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};
        worker.postMessage({stage,parameters,module,items,batchReservation:reservation});
      });
      operations+=result.operations;triangles+=result.triangles;
      if(operations>200_000||triangles>2_000_000)throw Error('Real geometry aggregate operation/triangle budget');
      reports.push({stage,items:items.length,elapsedMs:result.elapsedMs,initializationMs:result.initializationMs,wasmBytes:result.wasmBytes});
      return result;
    } finally {worker.terminate();active.delete(worker);}
  }
  async function run(items,accept) {
    let next=0,failure;
    const lane=async()=>{
      try{while(!failure&&next<items.length){const start=next;next+=32;accept(await batch(items.slice(start,start+32)));await progress();}}
      catch(error){failure??=error;}
    };
    await Promise.all(Array.from({length:workers},lane));
    if(failure)throw failure;
  }
  try {
    stage='partition';const bases=reusedPartition?accepted.bases:[],excluded=reusedPartition?accepted.excluded:[];
    if(reusedPartition)retainedBytes=accepted.partitionBytes;
    else await run(enumerateCells(parameters),result=>{
        bases.push(...result.results);excluded.push(...result.excluded);
        retainedBytes+=JSON.stringify([result.results,result.excluded]).length*2;
      });
    const partitionBytes=retainedBytes;
    if(!bases.length||bases.length>4000)throw Error('Real layout retained part count');
    if(!reusedPartition){
      bases.sort((a,b)=>b.centroid[1]-a.centroid[1]||a.centroid[0]-b.centroid[0]||(a.id<b.id?-1:a.id>b.id?1:0));
      bases.forEach((base,index)=>base.mapNumber=index+1);
    }
    stage='parts';const parts=[];
    await run(bases,result=>{parts.push(...result.results);retainedBytes+=result.retainedBytes;completed=parts.length;});
    parts.sort((a,b)=>a.part.mapNumber-b.part.mapNumber);
    stage='clearance';const pairs=clearancePairs(parts.map(p=>({id:p.part.id,bounds:p.assemblyBounds,clearanceHull:p.clearanceHull})));
    await run(pairs.map(([a,b])=>[parts[a],parts[b]]),()=>{});
    const candidate={parts,bases,excluded,parameters:{...parameters},retainedBytes,partitionBytes};
    let rendering;
    if(renderLayout){
      stage='render';await progress();
      rendering=await renderLayout(candidate,LIMITS_V2.timeoutMs-(performance.now()-started));
    }
    // Keep the actual result alive through the sampler's final observation.
    window.retainedRealLayout=candidate;
    stage='complete';await progress();
    return {completed,excluded:excluded.length,engraved:parts.filter(p=>p.identification.status==='engraved').length,
      workers,acceptedBytes,reusedPartition,operations,triangles,retainedBytes,clearancePairs:pairs.length,rendering,elapsedMs:performance.now()-started,reports,
      limitation:renderLayout?'Actual renderer and native buffers; no application shell, exports or repeated p95 qualification':'Real native buffers retained; no renderer, exports or repeated p95 qualification'};
  } catch(error){await progress();return {failure:String(error),stage,completed,workers,acceptedBytes,reusedPartition,acceptedPreserved:window.retainedRealLayout===accepted,operations,triangles,retainedBytes,elapsedMs:performance.now()-started,reports};}
  finally{active.forEach(worker=>worker.terminate());}
};
