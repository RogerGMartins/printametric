/** Atomic v2 generation. Accepted archives are read-only inputs; a failed or
 * cancelled job returns no candidate and never releases the previous design. */
import { DesignError } from '../model/budget.ts';
import { LIMITS_V2, validateParametersV2, checkLayoutBudget } from '../model/validation-v2.ts';
import { definitionDigest } from '../model/definition.ts';
import { enumerateCells } from './layouts/cells.ts';
import { clearancePairs } from './clearance.ts';
import { abortable, requestBatch } from './batch-client.ts';
import type { ParametersV2 } from '../model/parameters-v2.ts';
import type { BaseContour, ExcludedContour } from './layout-metadata.ts';
import type { ArchivedPart, BatchPort, BatchRequest, BatchResult, LayoutSnapshot } from './batch-protocol.ts';

export type LayoutProgress={stage:'initialize'|'partition'|'parts'|'clearance';completed:number;total:number};
export const NATIVE_BATCH_RESERVATION=Math.floor(LIMITS_V2.memoryBytes/6);
const footprintKeys=['width','height','outline','layout','pitch','gap','seed','straightBoundary'] as const;
export const sameFootprint=(a:ParametersV2,b:ParametersV2)=>footprintKeys.every(key=>a[key]===b[key]);

export interface LayoutHost {
  createPort: ()=>BatchPort;
  loadModule: (signal: AbortSignal)=>Promise<WebAssembly.Module>;
  progress?: (value: LayoutProgress)=>void;
  /** Other accepted-version native/renderer allocations retained by the caller. */
  reservedBytes?:number;
}

export async function generateLayout(value: unknown, revision: number, accepted: LayoutSnapshot | null,
  host: LayoutHost, signal: AbortSignal): Promise<LayoutSnapshot> {
  const parameters=validateParametersV2(value);
  if(!Number.isSafeInteger(revision)||revision<1)throw new DesignError('PROTOCOL','Invalid model revision.');
  // Pure enumeration rejects excessive cell/contour work before any native heap.
  const reuse=Boolean(accepted&&sameFootprint(accepted.parameters,parameters));
  const cells=reuse?[]:enumerateCells(parameters);
  const started=performance.now(),job=new AbortController();
  const cancel=()=>job.abort(signal.reason??new DesignError('CANCELLED','Generation cancelled.'));
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  const timer=setTimeout(()=>job.abort(new DesignError('TIMEOUT','Generation exceeded 120 seconds. The previous design is retained. Increase pitch or reduce dimensions.','pitch')),LIMITS_V2.timeoutMs);
  const workers=accepted||host.reservedBytes?2:3;
  const bases: BaseContour[]=reuse?[...accepted!.bases]:[],excluded: ExcludedContour[]=reuse?[...accepted!.excluded]:[],parts: ArchivedPart[]=[];
  let retainedBytes=reuse?accepted!.partitionBytes:0,operations=0,triangles=0,wasmBytes=0,contourVertices=0;
  const acceptedBytes=accepted?accepted.retainedBytes+accepted.result.budget.meshBytes*3:0;
  const check=()=>{
    checkLayoutBudget({parts:bases.length,contourVertices,cadOperations:operations,triangles,
      // Candidate copies, normal/GPU arrays and accepted renderer coexist with
      // active native heaps. Whole-process measurements remain separate evidence.
      memoryBytes:workers*NATIVE_BATCH_RESERVATION+acceptedBytes+(host.reservedBytes??0)+retainedBytes*4});
    job.signal.throwIfAborted();
  };
  try {
    check();host.progress?.({stage:'initialize',completed:0,total:0});
    const module=await abortable(host.loadModule(job.signal),job.signal);
    const run=async(stage: BatchRequest['stage'],items: unknown[],accept:(result:BatchResult)=>void)=>{
      let next=0,completed=0;
      host.progress?.({stage:stage as LayoutProgress['stage'],completed,total:items.length});
      const lane=async()=>{
        try {
          while(next<items.length){
            check();const start=next;next+=32;
            const result=await requestBatch(host.createPort,{stage,items:items.slice(start,start+32),parameters,module,reservation:NATIVE_BATCH_RESERVATION} as BatchRequest,job.signal);
            for(const key of ['operations','triangles','retainedBytes','wasmBytes'] as const)
              if(!Number.isSafeInteger(result[key])||result[key]<0)throw new DesignError('PROTOCOL','Invalid native batch accounting.');
            if(result.wasmBytes+result.retainedBytes>NATIVE_BATCH_RESERVATION)throw new DesignError('GENERATION_BUDGET','Native batch exceeded its memory reservation.');
            operations+=result.operations;triangles+=result.triangles;wasmBytes=Math.max(wasmBytes,result.wasmBytes);
            accept(result);completed+=Math.min(32,items.length-start);check();
            host.progress?.({stage:stage as LayoutProgress['stage'],completed,total:items.length});
          }
        }catch(error){job.abort(error);throw error;}
      };
      const results=await Promise.allSettled(Array.from({length:workers},lane));
      const failure=results.find(result=>result.status==='rejected');
      if(failure?.status==='rejected')throw job.signal.reason??failure.reason;
    };
    if(!reuse)await run('partition',cells,result=>{
      bases.push(...result.bases);excluded.push(...result.excluded);retainedBytes+=result.retainedBytes;
      // Native path commands bound the actual retained contour complexity too.
      contourVertices+=JSON.stringify([result.bases.map(base=>base.paths),result.excluded.map(base=>base.paths)]).match(/[MLCQAZ]/gi)?.length??0;
    });
    else contourVertices=JSON.stringify([...bases,...excluded].map(base=>base.paths)).match(/[MLCQAZ]/gi)?.length??0;
    check();
    if(!bases.length)throw new DesignError('CONTOUR','All cells were excluded. Increase dimensions or reduce the gap.');
    if(!reuse){
      bases.sort((a,b)=>b.centroid[1]-a.centroid[1]||a.centroid[0]-b.centroid[0]||(a.id<b.id?-1:a.id>b.id?1:0));
      bases.forEach((base,index)=>{base.mapNumber=index+1;});
      excluded.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    }
    const partitionBytes=retainedBytes;
    await run('parts',bases,result=>{parts.push(...result.parts);retainedBytes+=result.retainedBytes;});
    parts.sort((a,b)=>a.part.mapNumber-b.part.mapNumber);
    if(parts.length!==bases.length||parts.some((item,index)=>item.part.id!==bases[index]!.id||item.part.mapNumber!==index+1))
      throw new DesignError('PROTOCOL','Native generation lost a part or changed its identity.');
    const pairs=clearancePairs(parts.map(item=>({id:item.part.id,bounds:item.assemblyBounds,clearanceHull:item.clearanceHull})));
    await run('clearance',pairs.map(([a,b])=>[parts[a],parts[b]]),()=>{});
    const bounds={min:[Infinity,Infinity,Infinity] as [number,number,number],max:[-Infinity,-Infinity,-Infinity] as [number,number,number]};
    let meshBytes=0;
    for(const item of parts){
      for(let axis=0;axis<3;axis++){bounds.min[axis]=Math.min(bounds.min[axis]!,item.assemblyBounds.min[axis]!);bounds.max[axis]=Math.max(bounds.max[axis]!,item.assemblyBounds.max[axis]!);}
      meshBytes+=item.part.mesh.positions.byteLength+item.part.mesh.indices.byteLength;
    }
    const exclusionKey=excluded.length?Array.from(new Uint8Array(await abortable(crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(excluded))),job.signal)),v=>v.toString(16).padStart(2,'0')).join(''):'';
    check();
    return {parameters,bases,excluded,parts,exclusionKey,partitionBytes,retainedBytes,
      result:{revision,digest:definitionDigest({modelSchemaVersion:2,generatorVersion:2,parameters}),units:'mm',parts:parts.map(item=>item.part),bounds,
        diagnostics:excluded.length?[`${excluded.length} fragments excluded. Review the numbered plan before export.`]:[],
        budget:{triangles,meshBytes,wasmBytes,elapsedMs:performance.now()-started}}};
  }finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);job.abort();}
}
