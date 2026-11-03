/** One explicit disk-backed export. Native STEP fragments arrive with backpressure;
 * final output is never collected into one application-sized byte buffer. */
import { openTemporarySink } from '../../../shared/export/temporary-export.ts';
import { assembleSTEP } from '../../../shared/export/step-fragments.ts';
import { stream3MF } from '../../../shared/export/stream-three-mf.ts';
import { streamSTL } from '../../../shared/export/stream-stl.ts';
import type { ExportFormat, Part } from '../../../shared/geometry/types.ts';

export interface ExportJob {
  id:string;maxBytes:number;format:ExportFormat;revision:number;
  exclusionKey:string;acknowledgedKey:string;parts:Part[];
}
let active=false;
let supply:((bytes:Uint8Array<ArrayBuffer>)=>void)|undefined;
self.onmessage=async({data}:MessageEvent<ExportJob|{fragment:Uint8Array<ArrayBuffer>}>)=>{
  if('fragment' in data){const callback=supply;supply=undefined;callback?.(data.fragment);return;}
  if(active)return;active=true;
  let sink:Awaited<ReturnType<typeof openTemporarySink>>|undefined;
  try {
    if(!Number.isSafeInteger(data.revision)||data.revision<1||!data.parts.length||data.parts.length>4000 ||
      data.exclusionKey!==data.acknowledgedKey)throw Error('Export requires the acknowledged accepted revision.');
    sink=await openTemporarySink(data.id,data.maxBytes);
    const target=sink;
    const output={write:async(bytes:Uint8Array)=>{target.write(new Uint8Array(bytes));}};
    let metrics;
    if(data.format==='step') {
      const total=data.parts.length;
      async function* fragments(){
        for(let start=0;start<total;start+=32){
          const pending=new Promise<Uint8Array<ArrayBuffer>>(resolve=>{supply=resolve;});
          self.postMessage({request:start});yield await pending;
        }
      }
      metrics=await assembleSTEP(fragments(),output,{maxBytes:data.maxBytes});
    }else if(data.format==='stl')metrics=await streamSTL(data.parts,output,{maxBytes:data.maxBytes});
    else if(data.format==='3mf')metrics=await stream3MF(data.parts,output,{maxBytes:data.maxBytes});
    else throw Error('Unsupported export format.');
    const file=await sink.finish();self.postMessage({file,revision:data.revision,format:data.format,metrics});
  }catch(error){sink?.close();self.postMessage({error:error instanceof Error?error.message:'Export failed.'});}
  finally{sink?.close();}
};
