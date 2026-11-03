import { runGeometryBatch } from '../../support/layout-geometry-batch.mjs';
self.onmessage=async({data})=>{
  try{self.postMessage(await runGeometryBatch(data));}
  catch(error){self.postMessage({error:error.stack??String(error)});}
};
