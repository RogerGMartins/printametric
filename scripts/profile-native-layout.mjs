// Isolated stage timings for the real large-layout hot path. This diagnostic
// does not qualify a browser tier or change the production generator's behavior.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';
import { enumerateCells } from '../src/tools/wall-art/geometry/layouts/cells.ts';
import { partitionCell } from '../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildRelief } from '../src/tools/wall-art/geometry/relief-v2.ts';
import { engravePart, createGlyphTemplates } from '../src/tools/wall-art/geometry/engraving.ts';
import { archiveNative } from '../tests/support/native-snapshot.mjs';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';
import { measureShapeVolumeProperties } from 'replicad';

if (isMainThread) {
  const reports=[];
  // Sequential diagnostic heaps; this is not a concurrency benchmark.
  for(const cellKey of ['t:0,0,0','t:-32,22,1']) {
    const worker=new Worker(new URL(import.meta.url),{workerData:{cellKey}});
    try {
      const report=await new Promise((resolve,reject)=>{
        worker.once('error',reject);worker.once('exit',code=>reject(Error(`Profiler exited ${code}`)));
        worker.once('message',message=>message.error?reject(Error(message.error)):resolve(message));
      });
      reports.push(report);console.log(JSON.stringify(report));
    }finally{await worker.terminate();}
  }
  await mkdir('artifacts/wall-art-layouts',{recursive:true});
  await writeFile(`artifacts/wall-art-layouts/native-stage-profile-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify(reports,null,2));
} else {
  try {
    const kernel=await loadKernel(),p={...DEFAULT_PARAMETERS_V2,width:2000,height:2000,layout:'triangular',topRatio:.99};
    const cell=enumerateCells(p).find(cell=>cell.key===workerData.cellKey);
    const base=partitionCell(kernel,p,cell).bases[0],timings={},cpu={},retained=[],engravingStages={fit:0,tools:0,extrusion:0,cutAndValidation:0};
    let wall=performance.now(),used=process.cpuUsage(),operations=0,triangles=0,meshAttempts=0,engraved=0;
    const mark=stage=>{
      const now=performance.now(),current=process.cpuUsage();
      timings[stage]=(timings[stage]??0)+now-wall;cpu[stage]=(cpu[stage]??0)+(current.user+current.system-used.user-used.system)/1000;
      wall=now;used=current;
    };
    const templates=createGlyphTemplates(kernel,()=>operations++);
    try {
      for(let number=1000;number<1032;number++) {
        const part={...base,mapNumber:number},relief=buildRelief(kernel,p,part);mark('relief');
        try {
          const begin=performance.now(),events=[];
          const result=engravePart(kernel,p,part,relief,()=>{operations++;events.push(performance.now());},templates);
          const end=performance.now();mark('engraving');
          if(result.identification.status==='engraved'){
            engravingStages.fit+=events[0]-begin;
            engravingStages.tools+=events.at(-2)-events[0];
            engravingStages.extrusion+=events.at(-1)-events.at(-2);
            engravingStages.cutAndValidation+=end-events.at(-1);
          }
          try {
            engraved+=result.identification.status==='engraved'?1:0;
            const properties=measureShapeVolumeProperties(result.solid),volume=properties.volume;properties.delete();mark('volume');
            let mesh;
            for(let attempt=0;attempt<4;attempt++) {
              meshAttempts++;
              const raw=result.solid.mesh({tolerance:.05*.2**attempt,angularTolerance:5*Math.PI/180});
              mesh=weldMesh(raw.vertices,raw.triangles);
              const checked=validateMesh(mesh);
              if(Math.abs(checked.volume-volume)/volume<=.001)break;
              if(attempt===3)throw Error('Mesh volume differs from native volume');
            }
            triangles+=mesh.indices.length/3;mark('mesh');
            const snapshot=await archiveNative(kernel,result.solid,part.id);retained.push({snapshot,mesh});mark('archive');
          }finally{result.solid.delete();mark('solidDisposal');}
        }finally{relief.delete();mark('reliefDisposal');}
      }
    }finally{templates.dispose();}
    parentPort.postMessage({cellKey:workerData.cellKey,parts:32,engraved,operations,triangles,meshAttempts,timings,cpu,engravingStages,
      wasmBytes:kernel.wasmMemory.buffer.byteLength,retainedBytes:retained.reduce((n,p)=>n+p.snapshot.bytes.length+p.mesh.positions.byteLength+p.mesh.indices.byteLength,0)});
  }catch(error){parentPort.postMessage({error:error.stack??String(error)});}
}
