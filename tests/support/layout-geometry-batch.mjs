// Real geometry feasibility batches. This entry is excluded from the app bundle.
import initOpenCascade from 'replicad-opencascadejs';
import { setOC } from 'replicad';
import { validateParametersV2, LIMITS_V2 } from '../../src/tools/wall-art/model/validation-v2.ts';
import { partitionCell } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildPartV2 } from '../../src/tools/wall-art/geometry/generate-v2.ts';
import { createGlyphTemplates } from '../../src/tools/wall-art/geometry/engraving.ts';
import { nativeTranslate, requireSolid } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { checkNativeClearance } from '../../src/tools/wall-art/geometry/clearance.ts';
import { archiveNative, restoreNative } from './native-snapshot.mjs';

export async function runGeometryBatch(data) {
  const p=validateParametersV2(data.parameters), started=performance.now();
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>32)throw Error('Real geometry batch bound');
  const kernel=await initOpenCascade({print:()=>{},instantiateWasm(imports,ready){
    const instance=new WebAssembly.Instance(data.module,imports);ready(instance,data.module);return instance.exports;
  }});
  setOC(kernel);
  const initializationMs=performance.now()-started;
  let operations=0,triangles=0,retainedBytes=0;
  const results=[],excluded=[];
  const count=()=>{if(++operations>LIMITS_V2.cadOperations)throw Error('Native operation budget');};
  const templates=createGlyphTemplates(kernel,count);
  try {
  for(const item of data.items) {
    if(data.stage==='partition') {
      // Conservative fixed allowance for clip, offset, measurement and span queries.
      operations+=20;
      const result=partitionCell(kernel,p,item);
      results.push(...result.bases);excluded.push(...result.excluded);
    } else if(data.stage==='parts') {
      const result=buildPartV2(kernel,p,item,count,templates);
      try {
        const snapshot=await archiveNative(kernel,result.solid,result.part.id);
        triangles+=result.part.mesh.indices.length/3;
        retainedBytes+=snapshot.bytes.length+result.part.mesh.positions.byteLength+result.part.mesh.indices.byteLength;
        retainedBytes+=JSON.stringify({id:result.part.id,identification:result.identification,
          bounds:result.part.bounds,translation:result.part.translation,assemblyBounds:result.assemblyBounds,clearanceHull:result.clearanceHull}).length*2;
        results.push({part:result.part,snapshot,identification:result.identification,assemblyBounds:result.assemblyBounds,clearanceHull:result.clearanceHull});
      } finally {result.solid.delete();}
    } else if(data.stage==='clearance') {
      const shapes=[];
      try {
        for(const part of item) {
          const local=await restoreNative(kernel,part.snapshot,part.part.id);
          try {shapes.push(requireSolid(nativeTranslate(kernel,local,...part.part.translation)));}finally{local.delete();}
        }
        count();checkNativeClearance(shapes[0],shapes[1],item[0].part.id,item[1].part.id);
      } finally {shapes.forEach(shape=>shape.delete());}
    } else throw Error('Unknown real geometry stage');
    if(kernel.wasmMemory.buffer.byteLength+retainedBytes>data.batchReservation)throw Error('Real native batch memory reservation exceeded');
  }
  return {results,excluded,operations,triangles,retainedBytes,initializationMs,elapsedMs:performance.now()-started,wasmBytes:kernel.wasmMemory.buffer.byteLength};
  }finally{templates.dispose();}
}
