// Disk-backed real exports. Request one bounded STEP fragment at a time from
// the controller, applying sink backpressure before requesting the next batch.
import { openTemporarySink } from '../../support/temporary-export.mjs';
import { assembleSTEP } from '../../support/step-fragments.mjs';
import { stream3MF } from '../../support/stream-three-mf.mjs';
import { serializeSTL } from '../../../src/shared/export/stl.ts';
import { validateMesh } from '../../../src/shared/geometry/validate-mesh.ts';
let receive;
self.onmessage=async({data})=>{
  if(data.fragment){receive?.(data.fragment);return;}
  let sink;
  const started=performance.now();
  try{
    sink=await openTemporarySink(data.id,data.maxBytes);
    const output={async write(bytes){sink.write(bytes);}};
    let metrics;
    if(data.format==='step'){
      async function* fragments(){
        for(let start=0;start<data.count;start+=32){
          const pending=new Promise(resolve=>{receive=resolve;});
          self.postMessage({request:start});
          const next=await pending;receive=undefined;
          if(next.error)throw Error(next.error);
          yield next.bytes;
        }
      }
      metrics=await assembleSTEP(fragments(),output,{maxBytes:data.maxBytes});
    }else if(data.format==='3mf')metrics=await stream3MF(data.parts,output,{maxBytes:data.maxBytes});
    else if(data.format==='stl'){
      let triangles=0;
      for(const part of data.parts){validateMesh(part.mesh);triangles+=part.mesh.indices.length/3;}
      if(triangles>2_000_000)throw Error('STL triangle budget');
      const header=new Uint8Array(84);header.set(new TextEncoder().encode('Printametric assembled model; coordinates in millimeters'));
      new DataView(header.buffer).setUint32(80,triangles,true);await output.write(header);
      for(const part of data.parts)await output.write(serializeSTL([part]).subarray(84));
      metrics={parts:data.parts.length,triangles,bytes:84+triangles*50};
    }else throw Error('Unknown export format');
    const file=await sink.finish();
    self.postMessage({file,metrics:{...metrics,elapsedMs:performance.now()-started}});
  }catch(error){sink?.close();self.postMessage({error:String(error)});}
  finally{sink?.close();}
};
