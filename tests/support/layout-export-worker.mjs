// A fresh native heap per family checks the real v2 output, including private
// archive restoration and the bounded STEP/3MF writers intended for integration.
import assert from 'node:assert/strict';
import { parentPort, workerData } from 'node:worker_threads';
import { importSTEP, measureShapeVolumeProperties } from 'replicad';
import initReader from 'occt-import-js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import { loadKernel } from './wall-art-kernel.mjs';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildPartV2 } from '../../src/tools/wall-art/geometry/generate-v2.ts';
import { buildPartV3 } from '../../src/tools/wall-art/geometry/generate-v3.ts';
import { layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { surfaceContourIdentity } from '../../src/tools/wall-art/model/part-identity.ts';
import { measureBoundaryVolume, removeCollapsedTriangles } from '../../src/tools/wall-art/geometry/surface-mesh.ts';
import { createGlyphTemplates } from '../../src/tools/wall-art/geometry/engraving.ts';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { validateMesh, weldMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { serializeSTL } from '../../src/shared/export/stl.ts';
import { archiveNative, restoreNative } from './native-snapshot.mjs';
import { assembleSTEP } from './step-fragments.mjs';
import { stream3MF } from './stream-three-mf.mjs';

const closeBounds=(actual,expected,tolerance)=>{
  for(const side of ['min','max'])for(let axis=0;axis<3;axis++)
    assert.ok(Math.abs(actual[side][axis]-expected[side][axis])<=tolerance,`${side}[${axis}]: ${actual[side][axis]} versus ${expected[side][axis]}`);
};
const boundsOf=parts=>{
  const result={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const part of parts)for(let axis=0;axis<3;axis++){
    result.min[axis]=Math.min(result.min[axis],part.bounds.min[axis]+part.translation[axis]);
    result.max[axis]=Math.max(result.max[axis],part.bounds.max[axis]+part.translation[axis]);
  }
  return result;
};
try {
  const kernel=await loadKernel(),surface=workerData.generatorVersion===3,p=surface?workerData.parameters:workerData;
  const partition=partitionLayout(kernel,surface?layoutParametersV3(p):p);
  if(surface)partition.bases=partition.bases.map(surfaceContourIdentity);
  const parts=[],snapshots=[],templates=createGlyphTemplates(kernel,()=>{});
  let engraved=0,curved=false;
  try {
    for(const base of partition.bases){
      const result=surface?buildPartV3(kernel,p,base,()=>{}):buildPartV2(kernel,p,base,()=>{},templates);
      try{
        parts.push(result.part);snapshots.push(await archiveNative(kernel,result.solid,result.part.id));
        engraved+=Number(result.identification.status==='engraved');
        const faces=result.solid.faces;
        try{curved ||= faces.some(face=>face.geomType!=='PLANE');}finally{faces.forEach(face=>face.delete());}
      }finally{result.solid.delete();}
    }
  }finally{templates.dispose();}
  assert.ok(parts.length>0&&parts.length<=32,'Fixture must fit one bounded native batch');
  const expected=boundsOf(parts),volume=parts.reduce((sum,part)=>sum+part.volume,0);
  const fragments=[];
  for(const [index,snapshot] of snapshots.entries()){
    const restored=await restoreNative(kernel,snapshot,parts[index].id);
    try{fragments.push(await serializeSTEP([parts[index]],[restored]));}finally{restored.delete();}
  }
  const chunks=[];
  await assembleSTEP(fragments,{async write(bytes){chunks.push(bytes);}});
  const step=new Uint8Array(await new Blob(chunks).arrayBuffer());
  const imported=await importSTEP(new Blob([step]));
  try{
    const solids=imported.solids,faces=imported.faces,properties=measureShapeVolumeProperties(imported);
    try{
      assert.equal(solids.length,parts.length);solids.forEach(solid=>validateSolid(kernel,solid));
       const nativeVolume=surface?measureBoundaryVolume(imported).nativeVolume:properties.volume;
       assert.ok(Math.abs(nativeVolume-volume)/volume<=.001);
      if(curved)assert.ok(faces.some(face=>face.geomType!=='PLANE'),'STEP must retain native curved surfaces');
    }finally{properties.delete();solids.forEach(solid=>solid.delete());faces.forEach(face=>face.delete());}
    const box=imported.boundingBox;
    try{
      // STEP has no cached triangulation. Spline control hulls can enlarge its native box;
      // the independent reader below checks actual surface bounds at the same tolerance.
      if(surface)for(let axis=0;axis<3;axis++){
        assert.ok(box.bounds[0][axis]<=expected.min[axis]+.05);
        assert.ok(box.bounds[1][axis]>=expected.max[axis]-.05);
      }
      else closeBounds({min:box.bounds[0],max:box.bounds[1]},expected,.05);
    }finally{box.delete();}
  }finally{imported.delete();}
  const reader=await initReader(),independent=reader.ReadStepFile(step,{linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:.01,angularDeflection:Math.PI/36});
  assert.equal(independent.success,true);assert.equal(independent.meshes.length,parts.length);
  const readerParts=independent.meshes.map(mesh=>{
    // Independent STEP tessellation has its own bounded diagnostic allowance;
    // canonical/exported meshes still passed the unchanged 100k part limit.
    const imported=surface?removeCollapsedTriangles({vertices:mesh.attributes.position.array,triangles:mesh.index.array}).mesh
      :weldMesh(mesh.attributes.position.array,mesh.index.array);
    const checked=validateMesh(imported,surface?500_000:100_000);
    return {bounds:checked.bounds,translation:[0,0,0]};
  });
  closeBounds(boundsOf(readerParts),expected,.05);
  const stepText=new TextDecoder().decode(step);
  for(const part of parts)assert.ok(stepText.includes(`'${part.id}'`),'Native STEP part name');

  const stl=serializeSTL(parts),mesh=new STLLoader().parse(stl.buffer);
  try{
    mesh.computeBoundingBox();closeBounds({min:mesh.boundingBox.min.toArray(),max:mesh.boundingBox.max.toArray()},expected,.001);
    assert.equal(mesh.attributes.position.count,parts.reduce((sum,part)=>sum+part.mesh.indices.length,0));
  }finally{mesh.dispose();}
  const zipChunks=[];
  const metrics=await stream3MF(parts,{async write(bytes){zipChunks.push(bytes);}});
  const threeMF=new Uint8Array(await new Blob(zipChunks).arrayBuffer()),zip=unzipSync(threeMF);
  const xml=strFromU8(zip['3D/3dmodel.model']);
  assert.match(xml,/unit="millimeter"/);assert.equal(metrics.parts,parts.length);
  const objects=[...xml.matchAll(/<object\b[^>]*>(.*?)<\/object>/gs)];
  assert.equal(objects.length,parts.length);
  for(const [index,object] of objects.entries()){
    const vertices=[...object[1].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].flatMap(match=>match.slice(1).map(Number));
    const indices=[...object[1].matchAll(/<triangle v1="([^"]+)" v2="([^"]+)" v3="([^"]+)"\/>/g)].flatMap(match=>match.slice(1).map(Number));
    assert.deepEqual(vertices,[...parts[index].mesh.positions]);assert.deepEqual(indices,[...parts[index].mesh.indices]);
    assert.ok(xml.includes(`transform="1 0 0 0 1 0 0 0 1 ${parts[index].translation.join(' ')}"`));
  }
  parentPort.postMessage({parts:parts.length,engraved,curved,stepBytes:step.length,stlBytes:stl.length,threeMFBytes:threeMF.length});
}catch(error){parentPort.postMessage({error:error.stack??String(error)});}
