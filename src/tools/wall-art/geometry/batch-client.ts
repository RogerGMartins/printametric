/** Main-thread cancellation bounds blocking native work by terminating its heap.
 * Every request has one owner; late messages cannot complete a retired request. */
import { DesignError } from '../model/budget.ts';
import type { BatchPort, BatchRequest, BatchResult } from './batch-protocol.ts';

export function requestBatch(createPort: ()=>BatchPort, request: BatchRequest, signal: AbortSignal): Promise<BatchResult> {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    let port: BatchPort | undefined, settled=false;
    const finish=(error?: unknown,result?: BatchResult)=>{
      if(settled)return;settled=true;
      signal.removeEventListener('abort',cancel);
      if(port){port.onmessage=null;port.onerror=null;port.terminate();}
      if(error)reject(error);else resolve(result!);
    };
    const cancel=()=>finish(signal.reason??new DesignError('CANCELLED','Generation cancelled.'));
    signal.addEventListener('abort',cancel,{once:true});
    try {
      port=createPort();
      port.onmessage=({data})=>{
        if(data.error)finish(new DesignError(data.error.code,data.error.message,data.error.field));
        else if(data.result)finish(undefined,data.result);
        else finish(new DesignError('PROTOCOL','Native worker returned no result.'));
      };
      port.onerror=event=>finish(new DesignError('WORKER',event.message||'Native worker stopped. Retry generation.'));
      port.postMessage(request);
      if(signal.aborted)cancel();
    }catch(error){finish(error);}
  });
}

/** Covers initialization as well as CAD. Aborting also rejects a pending WASM
 * compilation wait, which cannot otherwise be cancelled by WebAssembly. */
export function abortable<T>(promise: Promise<T>,signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(signal.reason);
    signal.addEventListener('abort',cancel,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',cancel);if(signal.aborted)reject(signal.reason);else resolve(value);},
      error=>{signal.removeEventListener('abort',cancel);reject(error);});
  });
}
