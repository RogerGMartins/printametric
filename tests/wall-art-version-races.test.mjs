// Controlled legacy ports reproduce cross-version races without native timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DesignClient } from '../src/tools/wall-art/editor/design-client.ts';
import { DEFAULT_PARAMETERS, parameterDigest } from '../src/tools/wall-art/model/parameters.ts';
import { DEFAULT_PARAMETERS_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
  const ports=[],downloads=[],bytes=new TextEncoder().encode('original imported v1 bytes');
  let rejectModule;
  const module=new Promise((_,reject)=>{rejectModule=reject;});
  const definition={modelSchemaVersion:1,generatorVersion:1,parameters:{...DEFAULT_PARAMETERS}};
  const client=new DesignClient({
    createLegacy(){const port={messages:[],terminated:false,onmessage:null,onerror:null,
      postMessage(message){this.messages.push(message);},terminate(){this.terminated=true;},
      reply(message){this.onmessage?.({data:{epoch:this.messages[0].epoch,...message}});}};ports.push(port);return port;},
    loadModule:()=>module,createPort:()=>{throw Error('Unexpected native batch');},
    exportLayout:()=>{throw Error('Unexpected v2 export');},download:(...args)=>downloads.push(args),
  },()=>{});
  const ready=port=>port.reply({type:'ready'});
  const generated=(port,message=port.messages.findLast(m=>m.type==='generate'))=>port.reply({type:'generated',result:{
    revision:message.revision,digest:parameterDigest(message.parameters),units:'mm',parts:[{id:'fixture'}],
    budget:{wasmBytes:0,meshBytes:0,triangles:0,elapsedMs:0}}});
  client.submit(definition,bytes);ready(ports[0]);generated(ports[0]);
  return {client,ports,downloads,definition,bytes,ready,generated,rejectModule};
}

test('failed version switch cannot export an unaccepted legacy edit',async()=>{
  const h=harness(),{client,ports,definition,bytes}=h;
  try{
    const accepted=client.snapshot.accepted;
    client.submit({...definition,parameters:{...definition.parameters,width:300}});
    const obsolete=ports[0].messages.findLast(m=>m.type==='generate');
    client.submit({modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100}});
    assert.equal(ports[0].terminated,true,'retire the unaccepted legacy edit before v2 starts');
    h.generated(ports[0],obsolete);
    h.rejectModule(Error('Controlled v2 initialization failure'));await flush();
    assert.equal(client.snapshot.accepted,accepted);
    client.cancelGeneration(); // Revert restores retained v1 CAD before exports.
    client.export('stl');
    assert.equal(ports.some(port=>port.messages.some(m=>m.type==='export')),false);
    const restored=ports.at(-1);h.ready(restored);
    assert.deepEqual(restored.messages.findLast(m=>m.type==='generate').parameters,definition.parameters);
    h.generated(restored);client.export('stl');
    const request=restored.messages.findLast(m=>m.type==='export');assert.ok(request);
    assert.equal(request.revision,client.snapshot.accepted.result.revision);
    assert.equal(client.snapshot.accepted.result.digest,parameterDigest(definition.parameters));
    assert.equal(client.snapshot.accepted.originalBytes,bytes);
    assert.deepEqual(client.snapshot.accepted.definition,definition);
  }finally{client.dispose();}
});

test('queued legacy edits survive STEP heap retirement and remain exportable',async()=>{
  const h=harness(),{client,ports,definition}=h;
  try{
    const revision=client.snapshot.accepted.result.revision;
    client.export('step');
    client.submit({...definition,parameters:{...definition.parameters,width:300}});
    ports[0].reply({type:'exported',revision,format:'step',bytes:new Uint8Array([1])});
    await flush();
    assert.equal(ports[0].terminated,true);
    assert.equal(ports[0].messages.filter(m=>m.type==='generate').length,1,'never send the queued edit to the retiring heap');
    h.ready(ports[1]);
    assert.equal(ports[1].messages.findLast(m=>m.type==='generate').parameters.width,300);
    h.generated(ports[1]);await flush();client.export('stl');
    assert.equal(client.snapshot.accepted.definition.parameters.width,300);
    assert.equal(client.snapshot.accepted.result.digest,parameterDigest({...definition.parameters,width:300}));
    assert.equal(ports[1].messages.at(-1).type,'export');
    assert.equal(h.downloads.length,1);
  }finally{client.dispose();}
});

test('a newer submission wins over the deferred post-STEP edit queue',async()=>{
  const h=harness(),{client,ports,definition}=h;
  try{
    const revision=client.snapshot.accepted.result.revision;
    client.export('step');
    client.submit({...definition,parameters:{...definition.parameters,width:300}});
    ports[0].reply({type:'exported',revision,format:'step',bytes:new Uint8Array([1])});
    client.submit({...definition,parameters:{...definition.parameters,width:400}});
    await flush();h.ready(ports[1]);h.generated(ports[1]);
    assert.equal(client.snapshot.accepted.definition.parameters.width,400);
    assert.equal(ports[0].messages.filter(m=>m.type==='generate').length,1);
    assert.equal(ports[1].messages.findLast(m=>m.type==='generate').parameters.width,400);
  }finally{client.dispose();}
});

test('committing accepted values during export cancels an older queued edit',async()=>{
  const h=harness(),{client,ports,definition,bytes}=h;
  try{
    const accepted=client.snapshot.accepted;
    client.export('stl');
    client.submit({...definition,parameters:{...definition.parameters,width:300}});
    client.clearError(); // The editor's accepted-digest shortcut after restoring A.
    ports[0].reply({type:'exported',revision:accepted.result.revision,format:'stl',bytes:new Uint8Array([1])});
    await flush();
    assert.equal(ports[0].messages.filter(m=>m.type==='generate').length,1);
    assert.deepEqual(client.snapshot.accepted.definition,definition);
    assert.equal(client.snapshot.accepted.originalBytes,bytes);
    client.export('stl');assert.equal(ports[0].messages.at(-1).type,'export');
    assert.equal(client.snapshot.exporting,'stl');
  }finally{client.dispose();}
});

test('correcting a failed legacy edit clears its matching CAD error and enables export',()=>{
  const h=harness(),{client,ports,definition,bytes}=h;
  try{
    client.submit({...definition,parameters:{...definition.parameters,width:300}});
    ports[0].reply({type:'failed',code:'CAD',message:'Controlled edit failure'});
    assert.equal(client.snapshot.error.code,'CAD');
    client.clearError(); // Correct the fields to the accepted values, then Enter.
    client.export('stl');
    assert.equal(client.snapshot.error,null);
    assert.equal(client.snapshot.exporting,'stl');
    assert.equal(ports[0].messages.at(-1).type,'export');
    assert.equal(client.snapshot.accepted.originalBytes,bytes);
  }finally{client.dispose();}
});
