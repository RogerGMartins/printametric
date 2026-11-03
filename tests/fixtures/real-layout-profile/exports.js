// Explicit qualification action only. The accepted model and renderer stay live
// through export/download. This does not connect storage to the application.
import wasmURL from 'replicad-opencascadejs/wasm?url';
import { reserveTemporaryExport } from '../../support/temporary-export.mjs';
import { LIMITS_V2 } from '../../../src/tools/wall-art/model/validation-v2.ts';
const downloads=new Map();
window.exportRealLayout=async format=>{
  const accepted=window.retainedRealLayout;
  if(!accepted||!['step','stl','3mf'].includes(format))throw Error('No accepted export source or unknown format');
  const started=performance.now(),lease=await reserveTemporaryExport();
  const worker=new Worker(new URL('./export-worker.js',import.meta.url),{type:'module'});
  let nativeWorker,timer;
  try{
    const module=format==='step'?await WebAssembly.compile(await(await fetch(wasmURL)).arrayBuffer()):null;
    const result=await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(Error('120-second real export watchdog')),Math.max(0,LIMITS_V2.timeoutMs-(performance.now()-started)));
      worker.onerror=event=>reject(Error(event.message));
      worker.onmessage=async({data})=>{
        if(data.error){reject(Error(data.error));return;}
        if(data.file){resolve(data);return;}
        if(!Number.isInteger(data.request))return;
        try{
          const start=data.request;
          nativeWorker=new Worker(new URL('./step-worker.js',import.meta.url),{type:'module'});
          const fragment=await new Promise((accept,fail)=>{
            nativeWorker.onerror=event=>fail(Error(event.message));
            nativeWorker.onmessage=({data})=>data.error?fail(Error(data.error)):accept(data);
            nativeWorker.postMessage({module,reservation:Math.floor(LIMITS_V2.memoryBytes/6),
              items:accepted.parts.slice(start,start+32).map(({part,snapshot})=>({part:{id:part.id,translation:part.translation},snapshot}))});
          });
          nativeWorker.terminate();nativeWorker=undefined;
          worker.postMessage({fragment},{transfer:[fragment.bytes.buffer]});
          await window.exportProbeProgress?.({format,completed:Math.min(start+32,accepted.parts.length),elapsedMs:performance.now()-started});
        }catch(error){reject(error);}
      };
      worker.postMessage({id:lease.id,maxBytes:lease.maxBytes,format,count:accepted.parts.length,
        parts:format==='step'?undefined:accepted.parts.map(item=>item.part)});
    });
    downloads.set(lease.id,{lease,file:result.file,url:null,accepted});
    return {id:lease.id,bytes:result.file.size,...result.metrics,elapsedMs:performance.now()-started};
  }catch(error){nativeWorker?.terminate();worker.terminate();await lease.release();throw error;}
  finally{clearTimeout(timer);nativeWorker?.terminate();worker.terminate();}
};
window.downloadRealExport=(id,name)=>{
  const state=downloads.get(id);if(!state)throw Error('Export not ready');
  state.url??=URL.createObjectURL(state.file);
  const anchor=document.createElement('a');anchor.href=state.url;anchor.download=name;
  document.body.append(anchor);anchor.click();anchor.remove();
};
window.releaseRealExport=async id=>{
  const state=downloads.get(id);if(!state)return;
  if(state.url)URL.revokeObjectURL(state.url);
  await state.lease.release();downloads.delete(id);
};
window.inspectRealMeshExport=async(id,format)=>{
  const state=downloads.get(id);if(!state)throw Error('Export not ready');
  const bytes=await state.file.arrayBuffer(),{Box3}=await import('three');
  const expected={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const item of state.accepted.parts)for(let axis=0;axis<3;axis++){
    expected.min[axis]=Math.min(expected.min[axis],item.assemblyBounds.min[axis]);
    expected.max[axis]=Math.max(expected.max[axis],item.assemblyBounds.max[axis]);
  }
  let bounds,count,dispose;
  if(format==='3mf'){
    const {ThreeMFLoader}=await import('three/addons/loaders/3MFLoader.js');
    const group=new ThreeMFLoader().parse(bytes);bounds=new Box3().setFromObject(group);count=0;
    group.traverse(object=>{if(object.isMesh)count++;});
    dispose=()=>group.traverse(object=>{if(object.isMesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
  }else if(format==='stl'){
    const {STLLoader}=await import('three/addons/loaders/STLLoader.js');
    const geometry=new STLLoader().parse(bytes);geometry.computeBoundingBox();bounds=geometry.boundingBox;
    count=geometry.attributes.position.count/3;dispose=()=>geometry.dispose();
  }else throw Error('Unsupported mesh inspection');
  try{
    for(const side of ['min','max'])for(let axis=0;axis<3;axis++)if(Math.abs(bounds[side].toArray()[axis]-expected[side][axis])>.05)throw Error('Downloaded mesh bounds differ from accepted CAD');
    const expectedCount=format==='3mf'?state.accepted.parts.length:state.accepted.parts.reduce((sum,item)=>sum+item.part.mesh.indices.length/3,0);
    if(count!==expectedCount)throw Error('Downloaded mesh count differs from accepted model');
    return {reader:format==='3mf'?'ThreeMFLoader':'STLLoader',count,min:bounds.min.toArray(),max:bounds.max.toArray()};
  }finally{dispose();}
};
