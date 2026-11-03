/** Captured-revision export with explicit download lifetime. The caller releases
 * its lease after download; cancel/failure closes workers before storage cleanup. */
import { reserveTemporaryExport } from '../../../shared/export/temporary-export.ts';
import type { ExportFormat } from '../../../shared/geometry/types.ts';
import { DesignError } from '../model/budget.ts';
import { LIMITS_V2 } from '../model/validation-v2.ts';
import { requestBatch, abortable } from '../geometry/batch-client.ts';
import { NATIVE_BATCH_RESERVATION, type LayoutHost } from '../geometry/layout-coordinator.ts';
import type { LayoutSnapshot } from '../geometry/batch-protocol.ts';
import type { ExportJob } from '../geometry/export-worker-v2.ts';

export async function exportLayout(snapshot:LayoutSnapshot,format:ExportFormat,acknowledgedKey:string,host:LayoutHost,signal:AbortSignal) {
  if(snapshot.exclusionKey!==acknowledgedKey)throw new DesignError('EXCLUSIONS','Acknowledge the excluded fragments for this design before exporting.');
  if(!['step','stl','3mf'].includes(format))throw new DesignError('EXPORT','Choose a supported format.');
  const job=new AbortController(),cancel=()=>job.abort(signal.reason??new DesignError('CANCELLED','Export cancelled.'));
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  const timer=setTimeout(()=>job.abort(new DesignError('TIMEOUT','Export exceeded 120 seconds. The accepted design is retained.')),LIMITS_V2.timeoutMs);
  let lease:Awaited<ReturnType<typeof reserveTemporaryExport>>|undefined,worker:Worker|undefined;
  try {
    job.signal.throwIfAborted();
    // Do not race reservation against abort: a late-acquired lease must still be
    // released by this owner, rather than left locked by a detached promise.
    lease=await reserveTemporaryExport();job.signal.throwIfAborted();
    const module=format==='step'?await abortable(host.loadModule(job.signal),job.signal):null;
    const acceptedBytes=snapshot.retainedBytes+snapshot.result.budget.meshBytes*4;
    if(acceptedBytes+NATIVE_BATCH_RESERVATION+3*32*1024**2>LIMITS_V2.memoryBytes)throw new DesignError('EXPORT_BUDGET','Export exceeds the memory reservation.');
    worker=new Worker(new URL('../geometry/export-worker-v2.ts',import.meta.url),{type:'module'});
    const port=worker,revision=snapshot.result.revision;
    const file=await abortable(new Promise<File>((resolve,reject)=>{
      let pending=false,next=0;
      port.onerror=event=>reject(new DesignError('EXPORT',event.message||'Export worker stopped.'));
      port.onmessage=({data})=>{
        if(data.error){reject(new DesignError('EXPORT',data.error));return;}
        if(typeof data.request==='number'){
          if(!module||pending||data.request!==next||next>=snapshot.parts.length){reject(new DesignError('PROTOCOL','Unexpected STEP fragment request.'));return;}
          pending=true;const start=next;next+=32;
          void requestBatch(host.createPort,{stage:'step',items:snapshot.parts.slice(start,start+32),parameters:snapshot.parameters,module,reservation:NATIVE_BATCH_RESERVATION},job.signal)
            .then(result=>{job.signal.throwIfAborted();if(!result.step)throw Error('Missing native STEP fragment.');pending=false;port.postMessage({fragment:result.step},[result.step.buffer]);})
            .catch(reject);
        }else if(data.file instanceof File&&data.revision===revision&&data.format===format)resolve(data.file);
        else reject(new DesignError('PROTOCOL','Unexpected export completion.'));
      };
      const request:ExportJob={id:lease!.id,maxBytes:lease!.maxBytes,format,revision,exclusionKey:snapshot.exclusionKey,acknowledgedKey,parts:snapshot.result.parts};
      port.postMessage(request);
    }),job.signal);
    job.signal.throwIfAborted();
    const held=lease;lease=undefined;
    return {file,revision,format,release:()=>held.release()};
  }finally{
    clearTimeout(timer);signal.removeEventListener('abort',cancel);job.abort();worker?.terminate();await lease?.release();
  }
}
