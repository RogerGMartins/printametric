// One export batch owns one fresh native heap. Never transfer accepted sources.
import initOpenCascade from 'replicad-opencascadejs';
import { setOC } from 'replicad';
import { restoreNative } from '../../support/native-snapshot.mjs';
import { serializeSTEP } from '../../../src/shared/export/step.ts';
self.onmessage=async({data})=>{
  const solids=[];
  try{
    if(!Array.isArray(data.items)||!data.items.length||data.items.length>32)throw Error('Native export batch bound');
    const kernel=await initOpenCascade({print:()=>{},instantiateWasm(imports,ready){
      const instance=new WebAssembly.Instance(data.module,imports);ready(instance,data.module);return instance.exports;
    }});
    setOC(kernel);
    for(const item of data.items)solids.push(await restoreNative(kernel,item.snapshot,item.part.id));
    const bytes=await serializeSTEP(data.items.map(item=>item.part),solids);
    if(bytes.length>32*1024**2||kernel.wasmMemory.buffer.byteLength+bytes.length>data.reservation)throw Error('Native export batch memory bound');
    self.postMessage({bytes,wasmBytes:kernel.wasmMemory.buffer.byteLength},[bytes.buffer]);
  }catch(error){self.postMessage({error:String(error)});}
  finally{solids.forEach(solid=>solid.delete());}
};
