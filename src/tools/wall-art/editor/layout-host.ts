/** Browser boundary for compiled code and fresh native heaps. A failed fetch is
 * retryable; no model data or native heap is cached across jobs here. */
import type { LayoutHost } from '../geometry/layout-coordinator.ts';
import { abortable } from '../geometry/batch-client.ts';

export function createLayoutHost(progress?:LayoutHost['progress']):LayoutHost {
  let compiled:Promise<WebAssembly.Module>|null=null;
  return {...(progress?{progress}:{}),createPort:()=>new Worker(new URL('../geometry/batch-worker.ts',import.meta.url),{type:'module'}),
    loadModule(signal){
      // Compiled code belongs to the host, not a candidate. Cancelling one job
      // must not abort a shared download that its replacement is already using.
      // Each caller still stops waiting immediately through abortable below.
      if(!compiled)compiled=import('replicad-opencascadejs/wasm?url').then(({default:wasmURL})=>fetch(wasmURL)).then(async response=>{
        if(!response.ok)throw Error('CAD engine download failed. Retry generation.');
        return WebAssembly.compile(await response.arrayBuffer());
      }).catch(error=>{compiled=null;throw error;});
      return abortable(compiled,signal);
    }};
}
