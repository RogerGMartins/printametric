import { parentPort } from 'node:worker_threads';
import { measureShapeVolumeProperties } from 'replicad';
import { loadKernel } from './wall-art-kernel.mjs';
import { numberedBladeFactory } from './layout-native-fixture.mjs';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { weldMesh, validateMesh } from '../../src/shared/geometry/validate-mesh.ts';

const kernel = await loadKernel(), cut = numberedBladeFactory(kernel), profile = numberedBladeFactory(kernel, 'profile');
const volume = shape => { const properties = measureShapeVolumeProperties(shape); try { return properties.volume; } finally { properties.delete(); } };
const results = [];
try {
  for (const number of [1, 6, 9, 10, 99, 100, 999, 1000, 4000]) {
    const a = cut.make(number), b = profile.make(number);
    let common;
    try {
      validateSolid(kernel, a); validateSolid(kernel, b);
      common = a.intersect(b);
      const av = volume(a), bv = volume(b), intersection = volume(common);
      if (Math.abs(av - bv) > av * 1e-8 || Math.abs(intersection - av) > av * 1e-8) throw Error(`Different native material region for ${number}`);
      for (const shape of [a, b]) {
        const raw = shape.mesh({ tolerance: 0.05, angularTolerance: Math.PI / 36 });
        const checked = validateMesh(weldMesh(raw.vertices, raw.triangles));
        if (Math.abs(checked.volume - av) > av * 0.001) throw Error(`Invalid mesh volume for ${number}`);
      }
      results.push(number);
    } finally { common?.delete(); a.delete(); b.delete(); }
  }
  parentPort.postMessage({ results });
} catch (error) { parentPort.postMessage({ error: String(error) }); }
finally { cut.dispose(); profile.dispose(); }
