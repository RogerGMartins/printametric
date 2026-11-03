/** Actual family exports, distinct from synthetic capacity or byte-I/O probes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { DEFAULT_PARAMETERS_V2, OUTLINES, LAYOUTS } from '../src/tools/wall-art/model/parameters-v2.ts';

// Top-level cases run sequentially within this file. Bound each real fixture,
// rather than timing the sum of twenty independent native-reader startups.
for(const outline of OUTLINES)for(const layout of LAYOUTS){
  test(`${outline}/${layout} preserves engraved solids, units and placement through assembled exports`, {timeout:30_000}, async t=>{
    // Near-unity X taper retains narrow clipped parts. The separate relief matrix
    // exercises aggressive taper and its required rejection behavior.
    const worker=new Worker(new URL('./support/layout-export-worker.mjs',import.meta.url),{
      workerData:{...DEFAULT_PARAMETERS_V2,width:100,height:100,outline,layout,topRatio:.99}});
    const stop=()=>{void worker.terminate();};t.signal.addEventListener('abort',stop,{once:true});
    try{
      const result=await new Promise((resolve,reject)=>{
        worker.once('error',reject);worker.once('exit',code=>reject(Error(`Export fixture exited ${code}`)));
        worker.once('message',message=>message.error?reject(Error(`${outline}/${layout}: ${message.error}`)):resolve(message));
      });
      assert.ok(result.parts>0);assert.ok(result.stepBytes&&result.stlBytes&&result.threeMFBytes);
      t.diagnostic(`${outline}/${layout}: ${result.parts} parts, ${result.engraved} engraved, curved=${result.curved}`);
    }finally{t.signal.removeEventListener('abort',stop);await worker.terminate();}
  });
}
