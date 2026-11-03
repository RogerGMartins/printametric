/** Production batching lifetime and accepted/candidate isolation, without a UI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { generateLayout } from '../src/tools/wall-art/geometry/layout-coordinator.ts';
import { requestBatch } from '../src/tools/wall-art/geometry/batch-client.ts';
import { DEFAULT_PARAMETERS_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';
import { DesignClient } from '../src/tools/wall-art/editor/design-client.ts';

test('production native batches retain immutable accepted sources through edits and failed candidates',async()=>{
  const module=await WebAssembly.compile(await readFile(new URL(import.meta.resolve('replicad-opencascadejs/wasm'))));
  let active=0,maxActive=0,created=0,terminated=0;
  const host={loadModule:async()=>module,createPort(){
    created++;active++;maxActive=Math.max(active,maxActive);
    const worker=new Worker(new URL('./support/layout-runtime-worker.mjs',import.meta.url));
    const port={onmessage:null,onerror:null,postMessage:request=>worker.postMessage(request),terminate(){active--;terminated++;void worker.terminate();}};
    worker.on('message',data=>port.onmessage?.({data}));worker.on('error',error=>port.onerror?.({message:error.message}));return port;
  }};
  const parameters={...DEFAULT_PARAMETERS_V2,width:100,height:100,layout:'triangular',topRatio:.99};
  const accepted=await generateLayout(parameters,1,null,host,new AbortController().signal);
  const bytes=accepted.parts.map(item=>item.snapshot.bytes.slice()),ids=accepted.parts.map(item=>item.part.id);
  assert.equal(accepted.result.parts.length,20);assert.equal(accepted.result.units,'mm');
  const replacement=await generateLayout({...parameters,reliefHeight:21},2,accepted,host,new AbortController().signal);
  assert.deepEqual(replacement.parts.map(item=>item.part.id),ids);
  assert.equal(replacement.bases[0],accepted.bases[0]);
  assert.notEqual(replacement.parts[0].snapshot,accepted.parts[0].snapshot);
  assert.ok(Math.abs(accepted.result.bounds.max[2]-30)<1e-6);assert.ok(Math.abs(replacement.result.bounds.max[2]-31)<1e-6);
  const count=created;
  await assert.rejects(generateLayout({...parameters,width:NaN},3,accepted,host,new AbortController().signal),{code:'PARAMETER'});
  assert.equal(created,count);
  await assert.rejects(generateLayout({...parameters,topRatio:.01},4,accepted,host,new AbortController().signal));
  assert.deepEqual(accepted.parts.map(item=>item.snapshot.bytes),bytes);
  assert.equal(active,0);assert.equal(created,terminated);assert.ok(maxActive<=3);
});

test('batch cancellation retires its heap once and ignores completion after abort',async()=>{
  let port,terminated=0;
  const controller=new AbortController();
  const pending=requestBatch(()=>port={onmessage:null,onerror:null,postMessage(){},terminate(){terminated++;}}, {},controller.signal);
  const late=port.onmessage;
  controller.abort(Error('cancelled'));
  await assert.rejects(pending,/cancelled/);
  late({data:{result:{}}});assert.equal(terminated,1);assert.equal(port.onmessage,null);
});

test('the 120-second watchdog also covers blocked initialization and preserves accepted data',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let heaps=0;
  const host={loadModule:()=>new Promise(()=>{}),createPort(){heaps++;throw Error('unexpected native access');}};
  const pending=generateLayout({...DEFAULT_PARAMETERS_V2,width:100,height:100},1,null,host,new AbortController().signal);
  const rejected=assert.rejects(pending,{code:'TIMEOUT'});
  t.mock.timers.tick(120000);await rejected;assert.equal(heaps,0);
});

test('versioned client pins export revisions, queues edits and retains archives after cancel and export failure',async()=>{
  const module=await WebAssembly.compile(await readFile(new URL(import.meta.resolve('replicad-opencascadejs/wasm'))));
  const listeners=new Set(),downloads=[];
  let finishExport,rejectExport,captured,releaseCount=0,delayModule=false,finishModule;
  const host={loadModule:()=>delayModule?new Promise(resolve=>{finishModule=resolve;}):Promise.resolve(module),
    createLegacy(){throw Error('Unexpected legacy dispatch');},
    createPort(){
      const worker=new Worker(new URL('./support/layout-runtime-worker.mjs',import.meta.url));
      const port={onmessage:null,onerror:null,postMessage:request=>worker.postMessage(request),terminate(){void worker.terminate();}};
      worker.on('message',data=>port.onmessage?.({data}));worker.on('error',error=>port.onerror?.({message:error.message}));return port;
    },
    exportLayout:async(snapshot,format,ack,unused,signal)=>{captured={snapshot,format,ack,signal};return await new Promise((resolve,reject)=>{finishExport=resolve;rejectExport=reject;});},
    download:(file,format,revision)=>downloads.push({file,format,revision})};
  const client=new DesignClient(host,state=>{for(const listener of listeners)listener(state);});
  const wait=predicate=>predicate(client.snapshot)?Promise.resolve(client.snapshot):new Promise(resolve=>{
    const listener=state=>{if(predicate(state)){listeners.delete(listener);resolve(state);}};listeners.add(listener);
  });
  const definition={modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100,topRatio:1}};
  try {
    client.submit(definition);await wait(state=>state.status==='ready');
    const accepted=client.snapshot.accepted,original=accepted.layout.parts.map(item=>item.snapshot.bytes.slice());
    client.export('step');assert.equal(captured.snapshot,accepted.layout);
    client.submit({...definition,parameters:{...definition.parameters,reliefHeight:21}});
    assert.equal(client.snapshot.accepted,accepted);assert.equal(client.snapshot.status,'ready');
    finishExport({file:new File(['step'],'model.step'),revision:accepted.result.revision,format:'step',release:async()=>{releaseCount++;}});
    await wait(state=>state.accepted!==accepted&&state.status==='ready');
    assert.equal(downloads.length,1);assert.equal(downloads[0].revision,accepted.result.revision);
    assert.equal(client.snapshot.accepted.definition.parameters.reliefHeight,21);
    assert.deepEqual(accepted.layout.parts.map(item=>item.snapshot.bytes),original);
    const replacement=client.snapshot.accepted;
    delayModule=true;client.submit({...definition,parameters:{...definition.parameters,reliefHeight:22}});
    client.cancelGeneration();finishModule(module);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(client.snapshot.accepted,replacement);assert.equal(client.snapshot.status,'ready');
    delayModule=false;client.export('3mf');rejectExport(Error('Quota denied'));
    await wait(state=>state.exporting===null&&state.error);
    assert.equal(client.snapshot.accepted,replacement);assert.match(client.snapshot.error.message,/Quota denied/);
    client.clearError();client.export('stl');client.cancelExport();
    assert.equal(captured.signal.aborted,true);
    finishExport({file:new File(['late'],'late.stl'),revision:replacement.result.revision,format:'stl',release:async()=>{releaseCount++;}});
    await wait(state=>state.exporting===null);
    assert.equal(downloads.length,1);assert.equal(releaseCount,1);assert.equal(client.snapshot.accepted,replacement);
    client.export('stl');
    client.submit({...definition,parameters:{...definition.parameters,reliefHeight:23}});
    client.clearError(); // Commit the accepted height again while export is active.
    finishExport({file:new File(['retained'],'retained.stl'),revision:replacement.result.revision,format:'stl',release:async()=>{}});
    await wait(state=>state.exporting===null);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(client.snapshot.status,'ready');assert.equal(client.snapshot.accepted,replacement);
    assert.equal(downloads.length,2);assert.equal(downloads[1].revision,replacement.result.revision);
  } finally {client.dispose();}
});
