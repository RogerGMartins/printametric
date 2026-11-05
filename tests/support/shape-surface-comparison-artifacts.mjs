/** Explicit local evidence only. Invalid meshes are labelled for diagnostic views;
 * printable format files are written only after the normal mesh checks pass. */
import { mkdir, writeFile } from 'node:fs/promises';
import { validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { serializeSTL } from '../../src/shared/export/stl.ts';
import { serialize3MF } from '../../src/shared/export/three-mf.ts';
import { removeCollapsedTriangles } from './shape-surface-boundary-mesh.mjs';

const directory = new URL('../../artifacts/shape-surface-comparison/', import.meta.url);
const stem = (parameters, mode) => `${mode}-${parameters.topRatio}${parameters.concavity === 2.2 ? '' : `-c${parameters.concavity}`}`;
export async function writeComparisonView(candidate, parameters, mode) {
  await mkdir(directory, { recursive: true });
  const raw = candidate.solid.mesh({ tolerance: .05, angularTolerance: Math.PI / 36 });
  if (raw.triangles.length / 3 > 100_000) throw Error('Diagnostic view exceeds the unchanged triangle limit.');
  const { mesh } = removeCollapsedTriangles(raw);
  let validation = 'passed';
  try { validateMesh(mesh); } catch (error) { validation = error.message; }
  await writeFile(new URL(`${stem(parameters, mode)}.json`, directory), JSON.stringify({
    mode, parameters, validation, source: 'Native CAD tessellation; diagnostic view, not an export approval',
    positions: Array.from(mesh.positions), indices: Array.from(mesh.indices),
  }));
}
export async function writeComparisonExports(candidate, result, parameters, mode) {
  const part = { id: `checkpoint-${mode}`, mapNumber: 1, translation: [137, -46, 9], mesh: result.mesh, ...validateMesh(result.mesh) };
  const name = stem(parameters, mode);
  await writeFile(new URL(`${name}.step`, directory), await serializeSTEP([part], [candidate.solid]));
  await writeFile(new URL(`${name}.stl`, directory), serializeSTL([part]));
  await writeFile(new URL(`${name}.3mf`, directory), serialize3MF([part]));
  await writeFile(new URL(`${name}-manifest.json`, directory), JSON.stringify({ mode, parameters, translation: part.translation,
    bounds: result.bounds, nativeVolume: result.nativeVolume, meshVolume: part.volume, triangles: result.mesh.indices.length / 3,
    physicalHeightErrorMm: candidate.physicalHeightErrorMm, profilePositionErrorMm: candidate.profilePositionErrorMm,
    maximumBoundaryReductionMm: candidate.maximumBoundaryReductionMm }, null, 2));
}
