// One native heap per layout family. Retire it before the next matrix case, as
// production batches must do; a growing shared test heap is not capacity evidence.
import { parentPort, workerData } from 'node:worker_threads';
import assert from 'node:assert/strict';
import { deserializeDrawing } from 'replicad';
import { loadKernel } from './wall-art-kernel.mjs';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildRelief } from '../../src/tools/wall-art/geometry/relief-v2.ts';
import { validateMesh, weldMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { nativeTranslate, requireSolid } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { clearancePairs, checkNativeClearance, polygonClearanceHull } from '../../src/tools/wall-art/geometry/clearance.ts';

const placed=[];
try {
  const kernel = await loadKernel(), p = workerData;
  const { bases } = partitionLayout(kernel, p);
  for (const base of bases) {
    const solid = buildRelief(kernel, p, base);
    try {
      const expected = base.area * (p.baseThickness + p.reliefHeight * (1 + p.topRatio) / 2);
      const precise = new kernel.GProp_GProps();
      try {
        kernel.BRepGProp.VolumeProperties(solid.wrapped, precise, 1e-10, true, false);
        // Native ruled surfaces use the 0.001 mm CAD tolerance. Require 0.01%
        // analytical volume agreement, ten times tighter than C2 round trips.
        assert.ok(Math.abs(precise.Mass() - expected) < Math.max(1e-4, expected * 1e-4), `${base.id} volume ${precise.Mass()}/${expected}`);
      } finally { precise.delete(); }
      const mesh = solid.mesh({ tolerance: 0.05, angularTolerance: 5 * Math.PI / 180 });
      validateMesh(weldMesh(mesh.vertices, mesh.triangles));
      const clearanceHull=polygonClearanceHull(base,p);
      if(clearanceHull)for(let edge=0;edge<clearanceHull.length;edge++){
        const a=clearanceHull[edge],b=clearanceHull[(edge+1)%clearanceHull.length],dx=b[0]-a[0],dy=b[1]-a[1];
        for(let i=0;i<mesh.vertices.length;i+=3){
          const x=mesh.vertices[i]+base.centroid[0],y=mesh.vertices[i+1]+base.centroid[1];
          assert.ok((dx*(y-a[1])-dy*(x-a[0]))/Math.hypot(dx,dy)>=-.001,`${base.id} native mesh escapes clearance envelope`);
        }
      }
      // Analytic square fixture distinguishes X affinity from a mistaken Y taper.
      if (p.layout === 'square' && p.outline === 'rectangle') {
        const z = p.baseThickness + p.reliefHeight, top = [];
        for (let i = 0; i < mesh.vertices.length; i += 3) {
          if (Math.abs(mesh.vertices[i + 2] - z) < 1e-6) top.push([mesh.vertices[i], mesh.vertices[i + 1]]);
        }
        const drawing = deserializeDrawing(base.nativeContour);
        try {
          const bounds = drawing.boundingBox;
          const dx = Math.max(...top.map(v => v[0])) - Math.min(...top.map(v => v[0]));
          const dy = Math.max(...top.map(v => v[1])) - Math.min(...top.map(v => v[1]));
          assert.ok(Math.abs(dx - bounds.width * p.topRatio) < 1e-4);
          assert.ok(Math.abs(dy - bounds.height) < 1e-4);
        } finally { drawing.blueprint.delete(); }
      }
      const world=requireSolid(nativeTranslate(kernel,solid,base.centroid[0],base.centroid[1],0)), box=world.boundingBox;
      try { placed.push({id:base.id,solid:world,bounds:{min:box.bounds[0],max:box.bounds[1]},clearanceHull}); }
      finally {box.delete();}
    } finally { solid.delete(); }
  }
  // Independently check all original box candidates, including pairs the new
  // native-contour envelopes prove separated. This guards against false pruning.
  const originalPairs=clearancePairs(placed.map(({id,bounds})=>({id,bounds})));
  const prunedPairs=clearancePairs(placed);
  assert.ok(prunedPairs.length<=originalPairs.length);
  for(const [a,b] of originalPairs) checkNativeClearance(placed[a].solid,placed[b].solid,placed[a].id,placed[b].id);
  parentPort.postMessage({ count: bases.length });
} catch (error) { parentPort.postMessage({ error: error.stack ?? String(error) }); }
finally {placed.forEach(part=>part.solid.delete());}
