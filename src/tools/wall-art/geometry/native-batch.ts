/** Fresh-heap native work for at most 32 items. No accepted state lives here. */
import initOpenCascade from 'replicad-opencascadejs';
import { setOC, type Shape3D } from 'replicad';
import { archiveNative, restoreNative } from '../../../shared/geometry/native-snapshot.ts';
import { serializeSTEP } from '../../../shared/export/step.ts';
import { validateParametersV2, LIMITS_V2 } from '../model/validation-v2.ts';
import { DesignError } from '../model/budget.ts';
import { partitionCell } from './layouts/partition.ts';
import { buildPartV2 } from './generate-v2.ts';
import { createGlyphTemplates } from './engraving.ts';
import { nativeTranslate, requireSolid } from './native-operations.ts';
import { checkNativeClearance } from './clearance.ts';
import type { BatchRequest, BatchResult } from './batch-protocol.ts';

export async function runNativeBatch(data: BatchRequest): Promise<BatchResult> {
  const p=validateParametersV2(data.parameters);
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>32 ||
    !Number.isSafeInteger(data.reservation)||data.reservation<1||data.reservation>Math.floor(LIMITS_V2.memoryBytes/6))
    throw new DesignError('GENERATION_BUDGET','Native batch exceeds its allocation.');
  const kernel=await initOpenCascade({print:()=>{},instantiateWasm(imports: WebAssembly.Imports,ready: (instance: WebAssembly.Instance,module: WebAssembly.Module)=>void){
    const instance=new WebAssembly.Instance(data.module,imports);ready(instance,data.module);return instance.exports;
  }});
  setOC(kernel);
  const result: BatchResult={bases:[],excluded:[],parts:[],operations:0,triangles:0,retainedBytes:0,wasmBytes:0};
  const check=()=>{
    result.wasmBytes=kernel.wasmMemory.buffer.byteLength;
    if(result.wasmBytes+result.retainedBytes>data.reservation || result.operations>LIMITS_V2.cadOperations || result.triangles>LIMITS_V2.triangles)
      throw new DesignError('GENERATION_BUDGET','Native batch exceeds its memory or geometry budget. Increase pitch or reduce dimensions.','pitch');
  };
  const count=()=>{result.operations++;check();};
  if(data.stage==='step') {
    const solids: Shape3D[]=[];
    try {
      for(const item of data.items){solids.push(await restoreNative(kernel,item.snapshot,item.part.id));check();}
      result.step=await serializeSTEP(data.items.map(item=>item.part),solids);
      if(result.step.length>32*1024**2)throw new DesignError('EXPORT_BUDGET','Native STEP fragment exceeds 32 MiB.');
      result.retainedBytes=result.step.length;check();return result;
    } finally {solids.forEach(solid=>solid.delete());}
  }
  const templates=createGlyphTemplates(kernel,count);
  try {
    if(data.stage==='partition')for(const cell of data.items){
      result.operations+=20;
      const partition=partitionCell(kernel,p,cell);
      result.bases.push(...partition.bases);result.excluded.push(...partition.excluded);
      result.retainedBytes+=JSON.stringify(partition).length*2;check();
    }
    else if(data.stage==='parts')for(const base of data.items){
      const built=buildPartV2(kernel,p,base,count,templates);
      try {
        const snapshot=await archiveNative(kernel,built.solid,built.part.id);
        const {solid: _solid,...metadata}=built;
        result.parts.push({...metadata,snapshot});
        result.triangles+=built.part.mesh.indices.length/3;
        result.retainedBytes+=snapshot.bytes.length+built.part.mesh.positions.byteLength+built.part.mesh.indices.byteLength+
          JSON.stringify({id:built.part.id,identification:built.identification,bounds:built.part.bounds,translation:built.part.translation,
            assemblyBounds:built.assemblyBounds,clearanceHull:built.clearanceHull}).length*2;
        check();
      } finally {built.solid.delete();}
    }
    else if(data.stage==='clearance')for(const pair of data.items){
      const shapes: Shape3D[]=[];
      try {
        for(const item of pair){
          const local=await restoreNative(kernel,item.snapshot,item.part.id);
          try {shapes.push(requireSolid(nativeTranslate(kernel,local,...item.part.translation)));}finally{local.delete();}
        }
        count();checkNativeClearance(shapes[0]!,shapes[1]!,pair[0].part.id,pair[1].part.id);check();
      }finally{shapes.forEach(shape=>shape.delete());}
    }
    else throw new DesignError('PROTOCOL','Unknown native batch stage.');
    return result;
  }finally{templates.dispose();}
}
