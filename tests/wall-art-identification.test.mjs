/** Native identification and clearance checks, independent of editor state. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deserializeShape, makeBox, makePolygon, measureDistanceBetween, measureShapeSurfaceProperties, measureShapeVolumeProperties } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';
import { partitionLayout, partitionCell } from '../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildRelief } from '../src/tools/wall-art/geometry/relief-v2.ts';
import { buildPartV2 } from '../src/tools/wall-art/geometry/generate-v2.ts';
import { enumerateCells } from '../src/tools/wall-art/geometry/layouts/cells.ts';
import { createGlyphTemplates, engravePart, identificationPolygons } from '../src/tools/wall-art/geometry/engraving.ts';
import { clearancePairs, checkNativeClearance } from '../src/tools/wall-art/geometry/clearance.ts';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';
import { nativeBoolean, nativeExtrude } from '../src/tools/wall-art/geometry/native-operations.ts';

function volume(solid) {
  const properties = measureShapeVolumeProperties(solid);
  try { return properties.volume; } finally { properties.delete(); }
}

function verifyNativeFootprint(kernel,base,identification) {
  const face=deserializeShape(base.nativeFace),border=face.clone().outerWire();
  try {
    for(const points of identificationPolygons(base.mapNumber,identification.height,identification.orientationMark).flat()) {
      const bar=makePolygon(points.map(([x,y])=>[x+identification.anchor[0]+base.centroid[0],y+identification.anchor[1]+base.centroid[1],0]));
      let outside,properties;
      try {
        outside=nativeBoolean(kernel,'cut',bar,face);properties=measureShapeSurfaceProperties(outside);
        assert.ok(properties.area<=1e-8);
        assert.ok(measureDistanceBetween(bar,border)>=1.2-1e-8);
      } finally {properties?.delete();outside?.delete();bar.delete();}
    }
  } finally {border.delete();face.delete();}
}
// Independent rectangle-grid union area for overlapping seven-segment bars.
function numberArea(groups, mark) {
  let area = 0;
  for (const bars of mark ? groups.slice(0,-1) : groups) {
    const rectangles = bars.map(points => [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])), Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))]);
    const xs = [...new Set(rectangles.flatMap(r=>[r[0],r[2]]))].sort((a,b)=>a-b);
    const ys = [...new Set(rectangles.flatMap(r=>[r[1],r[3]]))].sort((a,b)=>a-b);
    for(let x=1;x<xs.length;x++) for(let y=1;y<ys.length;y++) {
      const cx=(xs[x-1]+xs[x])/2,cy=(ys[y-1]+ys[y])/2;
      if(rectangles.some(r=>cx>r[0]&&cx<r[2]&&cy>r[1]&&cy<r[3])) area+=(xs[x]-xs[x-1])*(ys[y]-ys[y-1]);
    }
  }
  // Arrow shaft 0.8×2.5 plus triangular head 4×2.5/2.
  return area+(mark?7:0);
}

test('native underside numbers and +Y marks match pocket volume, remain closed and preserve the source', async () => {
  const kernel=await loadKernel();
  const p={...DEFAULT_PARAMETERS_V2,width:80,height:120,pitch:200,reliefHeight:0};
  const base=partitionLayout(kernel,p).bases[0], solid=buildRelief(kernel,p,base), originalVolume=volume(solid);
  let operations=0;
  const count=()=>{ if(++operations>200_000) throw Error('test CAD budget'); };
  const templates=createGlyphTemplates(kernel,count);
  try {
    for(const number of [1,6,9,10,99,100,999,1000,4000]) for(const orientationMark of [false,true]) {
      const result=engravePart(kernel,{...p,orientationMark},{...base,mapNumber:number},solid,count,templates);
      try {
        assert.equal(result.identification.status,'engraved',String(number));
        verifyNativeFootprint(kernel,{...base,mapNumber:number},result.identification);
        const {height,anchor}=result.identification;
        assert.ok(height>=5 && height<=base.span.lower*p.numeralRatio+1e-8);
        assert.deepEqual(anchor,[0,0]);
        const polygons=identificationPolygons(number,height,orientationMark);
        const removed=originalVolume-volume(result.solid);
        assert.ok(Math.abs(removed-numberArea(polygons,orientationMark)*p.engravingDepth)<1e-5,`${number}/${orientationMark} removed ${removed}`);
        const mesh=result.solid.mesh({tolerance:0.05,angularTolerance:5*Math.PI/180});
        validateMesh(weldMesh(mesh.vertices,mesh.triangles));
        assert.ok(Math.abs(volume(solid)-originalVolume)<1e-8);
      } finally { result.solid.delete(); }
    }
    const plain=engravePart(kernel,{...p,engravingDepth:0},base,solid,()=>{throw Error('inactive engraving called CAD');});
    try { assert.equal(plain.identification.status,'unengraved');assert.equal(volume(plain.solid),originalVolume); } finally { plain.solid.delete(); }
    assert.throws(()=>engravePart(kernel,{...p,baseThickness:2,engravingDepth:1},base,solid,count),{code:'FEATURE_SIZE',field:'engravingDepth'});
  } finally { templates.dispose();solid.delete(); }
  // A conventional upright digit's top bar becomes its lowest-Y bar after
  // flipping through X. The physical orientation arrow still points to +Y.
  const six=identificationPolygons(6,10,false)[0];
  assert.deepEqual(six[0].map(p=>p.map(n=>Math.round(n*1e8)/1e8)),[[-3,-3.4],[3,-3.4],[3,-5],[-3,-5]]);
  const arrow=identificationPolygons(1,10,true).at(-1)[0];
  assert.ok(Math.abs(arrow[4][0])<1e-8 && Math.abs(arrow[4][1]-7.9)<1e-8);
});

test('small footprints keep map-only parts and disabling the arrow can permit numbers alone', async () => {
  const kernel=await loadKernel(), p={...DEFAULT_PARAMETERS_V2,width:80,height:80,reliefHeight:0,numeralRatio:.6};
  const {bases}=partitionCell(kernel,p,{kind:'polygon',key:'small',center:[0,0],points:[[-6.25,-6.75],[6.25,-6.75],[6.25,6.75],[-6.25,6.75]]});
  const base={...bases[0],mapNumber:10}, source=buildRelief(kernel,p,base);
  let operations=0; const count=()=>{if(++operations>200_000)throw Error('test CAD budget');};
  try {
    const marked=engravePart(kernel,p,base,source,count);
    try { assert.equal(marked.identification.status,'map-only'); assert.equal(volume(marked.solid),volume(source)); } finally { marked.solid.delete(); }
    const numbered=engravePart(kernel,{...p,orientationMark:false},base,source,count);
    try { assert.equal(numbered.identification.status,'engraved');assert.ok(numbered.identification.height<6);assert.ok(numbered.identification.height>=5); } finally { numbered.solid.delete(); }
    assert.throws(()=>engravePart(kernel,{...p,orientationMark:false},base,source,()=>{throw Error('operation budget reached');}),/operation budget reached/);
    const fourDigit=engravePart(kernel,{...p,orientationMark:false},{...base,mapNumber:4000},source,count);
    try { assert.equal(fourDigit.identification.status,'map-only'); } finally { fourDigit.solid.delete(); }
  } finally { source.delete(); }
});

test('clearance spatial grid matches a brute-force bounds oracle and native full-solid distances', async () => {
  const parts=Array.from({length:4000},(_,i)=>({id:String(i),bounds:{min:[(i%80)*20,Math.floor(i/80)*20,0],max:[(i%80)*20+10,Math.floor(i/80)*20+10,10]}}));
  assert.deepEqual(clearancePairs(parts),[]);
  const sample=Array.from({length:80},(_,i)=>({id:String(i),bounds:{min:[(i%10)*10,Math.floor(i/10)*8,i%3],max:[(i%10)*10+12,Math.floor(i/10)*8+9,10]}}));
  const expected=[];
  for(let i=0;i<sample.length;i++)for(let j=i+1;j<sample.length;j++)if(![0,1,2].some(a=>sample[i].bounds.max[a]+.81<sample[j].bounds.min[a]||sample[j].bounds.max[a]+.81<sample[i].bounds.min[a])) expected.push(`${i}:${j}`);
  assert.deepEqual(clearancePairs(sample).map(p=>p.join(':')).sort(),expected.sort());
  await loadKernel();
  const a=makeBox([0,0,0],[10,10,10]);
  try {
    for(const gap of [.8,.82,2.5]) {
      const b=makeBox([10+gap,0,0],[20+gap,10,10]);
      try { if(gap<.81) assert.throws(()=>checkNativeClearance(a,b,'a','b'),{code:'CLEARANCE'}); else assert.ok(Math.abs(checkNativeClearance(a,b,'a','b')-gap)<1e-8); }
      finally { b.delete(); }
    }
    const touching=makeBox([9,0,0],[20,10,10]);
    try { assert.throws(()=>checkNativeClearance(a,touching,'a','overlap'),{code:'CLEARANCE'}); } finally { touching.delete(); }
  } finally { a.delete(); }
});

test('native contour envelopes prune separated triangles but retain inadequate diagonal clearance', async () => {
  const kernel=await loadKernel(),leftHull=[[0,0],[10,0],[0,10]],bounds={min:[0,0,0],max:[10,10,10]};
  const leftFace=makePolygon(leftHull.map(([x,y])=>[x,y,0])),left=nativeExtrude(kernel,leftFace,10);leftFace.delete();
  try {
    for(const gap of [.8,.82,2.5]){
      const offset=gap*Math.SQRT2,rightHull=[[10,10],[offset,10],[10,offset]];
      const rightFace=makePolygon(rightHull.map(([x,y])=>[x,y,0])),right=nativeExtrude(kernel,rightFace,10);rightFace.delete();
      try {
        const parts=[{id:'left',bounds,clearanceHull:leftHull},{id:'right',bounds,clearanceHull:rightHull}];
        assert.deepEqual(clearancePairs(parts),gap<.81?[[0,1]]:[]);
        if(gap<.81)assert.throws(()=>checkNativeClearance(left,right,'left','right'),{code:'CLEARANCE'});
        else assert.ok(Math.abs(checkNativeClearance(left,right,'left','right')-gap)<1e-7);
      }finally{right.delete();}
    }
  }finally{left.delete();}
});

test('canonical clipped triangular parts refine their shared mesh to native volume tolerance', async () => {
  const kernel=await loadKernel();
  const p={...DEFAULT_PARAMETERS_V2,width:2000,height:2000,layout:'triangular',topRatio:.99};
  const cell=enumerateCells(p).find(cell=>cell.key==='t:-32,22,1');
  const base={...partitionCell(kernel,p,cell).bases[0],mapNumber:80};
  assert.throws(()=>buildPartV2(kernel,{...p,width:NaN},base,()=>{throw Error('CAD accessed');}),{code:'PARAMETER'});
  let operations=0;
  const result=buildPartV2(kernel,p,base,()=>{if(++operations>200_000)throw Error('CAD budget');});
  try {
    const checked=validateMesh(result.part.mesh);
    assert.ok(Math.abs(checked.volume-result.part.volume)/result.part.volume<=.001);
    assert.deepEqual(result.part.translation,[...base.centroid,0]);
    assert.equal(result.identification.status,'engraved');
    verifyNativeFootprint(kernel,base,result.identification);
    assert.ok(result.part.mesh.indices.length/3<=100_000);
  } finally {result.solid.delete();}
});

test('circular base numbers use the full native span rather than a coarse inscribed polygon', async()=>{
  const kernel=await loadKernel(),p={...DEFAULT_PARAMETERS_V2,layout:'radial',topRatio:1};
  const cell=enumerateCells(p).find(cell=>cell.key==='d:center');
  const base={...partitionCell(kernel,p,cell).bases[0],mapNumber:6};
  const result=buildPartV2(kernel,p,base,()=>{});
  try{
    assert.equal(result.identification.status,'engraved');
    // Native disk diameter after inset is pitch-gap = 47.5 mm.
    assert.ok(Math.abs(result.identification.height-16.15)<1e-9);
    verifyNativeFootprint(kernel,base,result.identification);
  }finally{result.solid.delete();}
});
