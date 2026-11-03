// Node adapter for the same production native-batch function used by the browser.
import { parentPort } from 'node:worker_threads';
import { runNativeBatch } from '../../src/tools/wall-art/geometry/native-batch.ts';
parentPort.on('message',async request=>{
  try {parentPort.postMessage({result:await runNativeBatch(request)});}
  catch(error){parentPort.postMessage({error:{code:error.code??'CAD',message:error.message,field:error.field}});}
});
