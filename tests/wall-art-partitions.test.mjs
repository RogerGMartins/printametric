/** Phase-02 headless partition gates: native areas and an independent Voronoi oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { Sketches, measureShapeSurfaceProperties, measureShapeVolumeProperties, measureDistanceBetween, drawEllipse, drawRectangle, drawCircle } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V2, OUTLINES, LAYOUTS } from '../src/tools/wall-art/model/parameters-v2.ts';
import { enumerateCells, halfPlane, voronoiCell, usesWholeCells } from '../src/tools/wall-art/geometry/layouts/cells.ts';
import { nativeOutline, nativeCell } from '../src/tools/wall-art/geometry/layouts/outlines.ts';
import { irregularSite } from '../src/tools/wall-art/model/random.ts';
import { assemblyDrawing, drawingComponents, insetComponent } from '../src/tools/wall-art/geometry/layouts/clip.ts';
import { classifySpan } from '../src/tools/wall-art/geometry/layouts/span.ts';
import { partitionLayout, partitionCell } from '../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildRelief } from '../src/tools/wall-art/geometry/relief-v2.ts';
import { nativeTranslate } from '../src/tools/wall-art/geometry/native-operations.ts';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';

const area = points => Math.abs(points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - p[1] * q[0];
}, 0)) / 2;
function drawingArea(drawing) {
  if (!drawing.toSVGPaths().length) return 0;
  const group = drawing.sketchOnPlane('XY'), sketches = group instanceof Sketches ? group.sketches : [group];
  let total = 0;
  for (const sketch of sketches) {
    const face = sketch.face(), properties = measureShapeSurfaceProperties(face);
    try { total += properties.area; } finally { properties.delete(); face.delete(); sketch.delete(); }
  }
  return total;
}

test('bounded lattice cells preserve keys, cover the rectangle and match an all-sites Voronoi oracle', () => {
  for (const layout of LAYOUTS) {
    const p = { ...DEFAULT_PARAMETERS_V2, layout, width: 300, height: 200 };
    const cells = enumerateCells(p);
    assert.equal(new Set(cells.map(c => c.key)).size, cells.length);
    assert.deepEqual(enumerateCells({ ...p, reliefHeight: 0, engravingDepth: 0 }), cells);
    if (layout !== 'irregular') assert.deepEqual(enumerateCells({ ...p, seed: 9999 }), cells);
    if (cells.every(c => c.kind === 'polygon')) {
      let total = 0;
      for (const cell of cells) {
        let clipped = cell.points;
        for (const [n, o] of [[[1, 0], [150, 0]], [[-1, 0], [-150, 0]], [[0, 1], [0, 100]], [[0, -1], [0, -100]]]) clipped = halfPlane(clipped, n, o);
        total += area(clipped);
      }
      assert.ok(Math.abs(total - 60000) < 1e-6, `${layout} covered area ${total}`);
    }
  }
  for (const seed of [1, 5000, 9999]) for (const [i, j] of [[0, 0], [-4, 3], [5, -6]]) {
    const site = irregularSite(seed, i, j, 50);
    let oracle = [[-10000, -10000], [10000, -10000], [10000, 10000], [-10000, 10000]];
    for (let x = i - 8; x <= i + 8; x++) for (let y = j - 8; y <= j + 8; y++) {
      if (x === i && y === j) continue;
      const other = irregularSite(seed, x, y, 50);
      oracle = halfPlane(oracle, [other[0] - site[0], other[1] - site[1]], [(site[0] + other[0]) / 2, (site[1] + other[1]) / 2]);
    }
    const optimized = voronoiCell(seed, 50, i, j);
    assert.ok(Math.abs(area(oracle) - area(optimized)) < 1e-7);
    for (const point of oracle) assert.ok(optimized.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-7));
  }
});

test('native outlines and all twenty clipped cell families preserve analytical area', async () => {
  await loadKernel();
  for (const outline of OUTLINES) for (const [width, height] of [[80, 2000], [2000, 80], [500, 500]]) {
    const p = { ...DEFAULT_PARAMETERS_V2, outline, width, height };
    const factor = { rectangle: 1, ellipse: Math.PI / 4, hexagon: 0.75, arch: 0.5 + Math.PI / 8 }[outline];
    assert.ok(Math.abs(drawingArea(nativeOutline(p)) - width * height * factor) < 1e-5, `${outline} ${width}×${height}`);
  }
  for (const outline of OUTLINES) for (const layout of LAYOUTS) for (const straightBoundary of [false, true]) {
    const p = { ...DEFAULT_PARAMETERS_V2, outline, layout, width: 80, height: 120, straightBoundary };
    const boundary = nativeOutline(p); let covered = 0;
    for (const cell of enumerateCells(p)) {
      if (usesWholeCells(p)) {
        if (Math.abs(cell.center[0]) <= p.width / 2 && Math.abs(cell.center[1]) <= p.height / 2) covered += drawingArea(nativeCell(cell));
      } else covered += drawingArea(nativeCell(cell).intersect(boundary));
    }
    if (usesWholeCells(p)) assert.ok(covered > 0);
    else assert.ok(Math.abs(covered - drawingArea(boundary)) < 1e-5, `${outline}/${layout}/${straightBoundary}: ${covered}`);
  }
});

test('native face insets preserve curved gaps, split components and miter corners', async () => {
  const kernel = await loadKernel();
  for (const drawing of [drawEllipse(40,60), drawEllipse(60,40), drawCircle(40), drawRectangle(80,80)]) {
    const [source] = drawingComponents(drawing), inset = insetComponent(kernel, source, 1.25);
    try {
      assert.equal(inset.length, 1);
      const outer = source.face.outerWire(), inner = inset[0].face.outerWire();
      try { assert.ok(Math.abs(measureDistanceBetween(outer, inner) - 1.25) < 0.001); }
      finally { outer.delete(); inner.delete(); }
      assert.ok(inset[0].area < source.area);
      assert.ok(Math.hypot(...inset[0].centroid) < 1e-6);
    } finally { source.face.delete(); for (const component of inset) component.face.delete(); }
  }
  const split = drawRectangle(40,20).cut(drawRectangle(4,30));
  const components = drawingComponents(split);
  try {
    assert.equal(components.length, 2);
    assert.ok(components[0].centroid[1] >= components[1].centroid[1]);
    assert.deepEqual(components.map(c => Math.round(c.centroid[0])).sort((a,b) => a-b), [-11,11]);
    for (const source of components) {
      const inset = insetComponent(kernel, source, 1.25);
      try { assert.ok(Math.abs(inset[0].area - 15.5 * 17.5) < 1e-7); }
      finally { for (const component of inset) component.face.delete(); }
    }
  } finally { for (const component of components) component.face.delete(); }
});

test('stored contour coordinates follow assembly XY rather than native surface UV', async () => {
  const kernel=await loadKernel();
  const [component]=drawingComponents(drawRectangle(17,31).rotate(37));
  const translated=nativeTranslate(kernel,component.face,137,-46,0);
  try {
    for(const reversed of [false,true]) {
      if(reversed) translated.wrapped.Reverse();
      const drawing=assemblyDrawing(translated), reconstructed=drawingComponents(drawing);
      try {
        assert.equal(reconstructed.length,1);
        assert.ok(Math.abs(reconstructed[0].area-17*31)<1e-7);
        assert.ok(Math.hypot(reconstructed[0].centroid[0]-137,reconstructed[0].centroid[1]+46)<1e-7);
        const expected=translated.boundingBox, actual=reconstructed[0].face.boundingBox;
        try { for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(expected.bounds[side][axis]-actual.bounds[side][axis])<1e-5); }
        finally {expected.delete();actual.delete();}
      } finally { drawing.blueprint.delete();reconstructed.forEach(c=>c.face.delete()); }
    }
  } finally {translated.delete();component.face.delete();}
});

test('material span uses supporting lines and opposing annular branches, with exact line boundaries', async () => {
  const kernel = await loadKernel();
  for (const width of [1.19,1.2,1.21]) {
    for (const angle of [0, 37]) {
      const parts = drawingComponents(drawRectangle(width, 10).rotate(angle));
      try { assert.equal(classifySpan(kernel,parts[0].face).below, width < 1.2, `${width}/${angle}`); }
      finally { parts.forEach(p => p.face.delete()); }
    }
    const [part] = drawingComponents(nativeCell({kind:'sector',key:'test',center:[0,0],inner:20,outer:20+width,start:0,end:Math.PI/2}));
    try { assert.equal(classifySpan(kernel,part.face).below,width < 1.2, `annular ${width}`); }
    finally { part.face.delete(); }
  }
  for (const width of [1.19,1.21]) {
    const [part] = drawingComponents(drawEllipse(width/2, 10));
    try { assert.equal(classifySpan(kernel,part.face).below,width < 1.2); }
    finally { part.face.delete(); }
  }
});

test('all twenty inset layouts report exclusions and retain stable contiguous identification', async () => {
  const kernel = await loadKernel();
  for (const outline of OUTLINES) for (const layout of LAYOUTS) for (const straightBoundary of [false,true]) {
    const p = { ...DEFAULT_PARAMETERS_V2, outline, layout, width:80, height:120, straightBoundary };
    const first = partitionLayout(kernel,p), repeated = partitionLayout(kernel,{...p,reliefHeight:0,engravingDepth:0});
    assert.deepEqual(first,repeated,`${outline}/${layout}/${straightBoundary}`);
    assert.deepEqual(first.bases.map(b => b.mapNumber),first.bases.map((_,i) => i+1));
    assert.equal(new Set([...first.bases,...first.excluded].map(b=>b.id)).size,first.bases.length+first.excluded.length);
    assert.ok(first.bases.every(b=>b.area >= 4-1e-10 && b.span.lower >= 1.2));
    assert.ok(first.excluded.every(e=>['area','span','collapsed'].includes(e.reason)));
    assert.equal(first.wholeCells,usesWholeCells(p));
  }
  // Source rectangles inset to exact area thresholds while both spans stay >=1.2.
  const p = {...DEFAULT_PARAMETERS_V2, width:80,height:80,gap:2.5};
  for (const target of [3.99,4,4.01]) {
    const x = target/2 + p.gap, y = 2+p.gap;
    const result = partitionCell(kernel,p,{kind:'polygon',key:'area-fixture',center:[0,0],points:[[-x/2,-y/2],[x/2,-y/2],[x/2,y/2],[-x/2,y/2]]});
    assert.equal(result.bases.length,target >=4 ? 1:0,`area ${target}`);
    if(target<4) assert.equal(result.excluded[0].reason,'area');
  }
});

test('curved span bounds resolve the requested numeral lattice and exact circular thresholds',async()=>{
  const kernel=await loadKernel();
  for(const width of [1.19,1.2,1.21,47.5]){
    const [part]=drawingComponents(drawCircle(width/2));
    try{
      const span=classifySpan(kernel,part.face,1.2,.34);
      assert.equal(span.below,width<1.2);assert.ok(Math.abs(span.lower-width)<1e-7);assert.equal(span.lower,span.upper);
    }finally{part.face.delete();}
  }
  const [part]=drawingComponents(drawEllipse(24.37,40).rotate(23));
  try{
    const span=classifySpan(kernel,part.face,1.2,.34);
    const step=width=>Math.floor((width*.34-5+1e-10)/.05);
    assert.equal(step(span.lower),step(48.74));assert.equal(step(span.upper),step(48.74));
  }finally{part.face.delete();}
});

test('clipped native reliefs validate as one solid and zero relief preserves base volume', async () => {
  const kernel=await loadKernel();
  for(const outline of OUTLINES) for(const layout of LAYOUTS) {
    const p={...DEFAULT_PARAMETERS_V2,outline,layout,width:80,height:120,reliefHeight:0};
    const {bases}=partitionLayout(kernel,p);
    for(const base of bases) {
      let solid;
      try { solid=buildRelief(kernel,p,base); }
      catch(error) { throw new Error(`${outline}/${layout}/${base.id}: ${String(error)}`,{cause:error}); }
      const properties=measureShapeVolumeProperties(solid);
      try {
        assert.ok(Math.abs(properties.volume-base.area*p.baseThickness)<1e-5);
        const mesh=solid.mesh({tolerance:0.05,angularTolerance:5*Math.PI/180});
        validateMesh(weldMesh(mesh.vertices,mesh.triangles));
      } finally { properties.delete();solid.delete(); }
    }
  }
  const p={...DEFAULT_PARAMETERS_V2,width:80,height:80,pitch:200};
  const {bases}=partitionLayout(kernel,p), base=bases[0];
  for(const topRatio of [0.12,1]) {
    const solid=buildRelief(kernel,{...p,topRatio},base), properties=measureShapeVolumeProperties(solid);
    try { assert.ok(Math.abs(properties.volume-base.area*(p.baseThickness+p.reliefHeight*(1+topRatio)/2))<1e-5); }
    finally { properties.delete();solid.delete(); }
  }
});

test('tapered outline/layout matrix preserves native volume and closed meshes with X-only taper', async () => {
  for (const outline of OUTLINES) for (const layout of LAYOUTS) {
    const worker = new Worker(new URL('./support/layout-relief-worker.mjs', import.meta.url), {
      workerData: { ...DEFAULT_PARAMETERS_V2, outline, layout, width: 80, height: 120, topRatio: 0.99 },
    });
    try {
      const result = await new Promise((resolve, reject) => {
        worker.once('error', reject);
        worker.once('exit', code => reject(Error(`Native fixture exited ${code}`)));
        worker.once('message', resolve);
      });
      assert.equal(result.error, undefined, `${outline}/${layout}: ${result.error}`);
      assert.ok(result.count > 0);
    } finally { await worker.terminate(); }
  }
});

test('X taper rejects a retained narrow top rather than dropping its part', async () => {
  const kernel = await loadKernel();
  const p = { ...DEFAULT_PARAMETERS_V2, outline: 'hexagon', layout: 'triangular', width: 80, height: 120, topRatio: 0.8 };
  const base = partitionLayout(kernel, p).bases.find(part => part.id === 'wa-g2-t:-2,1,1:c0:i0');
  assert.ok(base);
  assert.throws(() => buildRelief(kernel, p, base), error => error.code === 'FEATURE_SIZE' && error.field === 'topRatio');
  const flat = buildRelief(kernel, { ...p, reliefHeight: 0 }, base);
  flat.delete();
});
