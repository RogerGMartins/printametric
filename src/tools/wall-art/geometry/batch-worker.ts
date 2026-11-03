/** One request per worker; the controller terminates the native heap on completion. */
import { runNativeBatch } from './native-batch.ts';
import { DesignError } from '../model/budget.ts';
import type { BatchRequest } from './batch-protocol.ts';
self.onmessage=async({data}: MessageEvent<BatchRequest>)=>{
  try {
    const result=await runNativeBatch(data);
    const transfers: Transferable[]=result.parts.flatMap(item=>[item.part.mesh.positions.buffer,item.part.mesh.indices.buffer,item.snapshot.bytes.buffer]);
    if(result.step)transfers.push(result.step.buffer);
    self.postMessage({result},{transfer:transfers});
  }catch(error){self.postMessage({error:{code:error instanceof DesignError?error.code:'CAD',message:error instanceof Error?error.message:'Native batch failed.',
    ...(error instanceof DesignError&&error.field?{field:error.field}:{})}});}
};
