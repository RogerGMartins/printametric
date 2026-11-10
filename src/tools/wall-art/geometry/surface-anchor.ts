/** Deterministic interior anchor in assembly millimeters. Native distances and
 * 1-Lipschitz bounds certify the fallback; exhausted work rejects the candidate. */
import type { Face } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import type { XY } from './layouts/cells.ts';

export interface SurfaceAnchor {
  point: XY; method: 'area-centroid' | 'inscribed-circle'; samples: number;
  radiusLower: number; radiusError: number; radiusTolerance?: number; tieTolerance?: number;
}

export function selectNativeAnchor(kernel: Kernel, face: Face, centroid: XY): SurfaceAnchor {
  const distanceError = 1e-7, radiusTolerance = .0005, tieTolerance = 1e-6;
  const border = face.clone().outerWire(), box = face.boundingBox;
  let samples = 0;
  const sample = (x: number, y: number) => {
    if (++samples > 4096) throw Error('Native anchor search exceeds its 4096-sample budget.');
    const point = new kernel.gp_Pnt(x, y, 0), maker = new kernel.BRepBuilderAPI_MakeVertex(point), vertex = maker.Vertex();
    let edgeDistance, faceDistance;
    try {
      edgeDistance = new kernel.BRepExtrema_DistShapeShape(vertex, border.wrapped, 1e-9);
      faceDistance = new kernel.BRepExtrema_DistShapeShape(vertex, face.wrapped, 1e-9);
      if (!edgeDistance.IsDone() || !faceDistance.IsDone()) throw Error('Native anchor distance did not converge.');
      const boundary = edgeDistance.Value(), outside = faceDistance.Value();
      if (![boundary, outside].every(Number.isFinite) || boundary < 0 || outside < 0) throw Error('Invalid native anchor distance.');
      const d = outside <= 1e-9 ? boundary : outside > distanceError ? -boundary : 0;
      return { x, y, d, lower: d - distanceError };
    } finally { edgeDistance?.delete(); faceDistance?.delete(); vertex.delete(); maker.delete(); point.delete(); }
  };
  try {
    const [min, max] = box.bounds;
    if (![...min, ...max, ...centroid].every(Number.isFinite) || centroid.length !== 2 || max[0] - min[0] > 4000 || max[1] - min[1] > 4000) throw Error('Invalid native anchor domain.');
    const areaCenter = sample(...centroid);
    if (areaCenter.lower > 0) return { point: [...centroid], method: 'area-centroid', samples, radiusLower: areaCenter.lower, radiusError: distanceError };
    type Sample = ReturnType<typeof sample>;
    const queue: (Sample & { hx: number; hy: number; depth: number; upper: number })[] = [], candidates: Sample[] = [];
    let best = -Infinity, upper = -Infinity;
    const add = (x: number, y: number, hx: number, hy: number, depth: number) => {
      const p = sample(x, y), cell = { ...p, hx, hy, depth, upper: p.d + distanceError + Math.hypot(hx, hy) };
      candidates.push(p); best = Math.max(best, p.lower); queue.push(cell);
    };
    add((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (max[0] - min[0]) / 2, (max[1] - min[1]) / 2, 0);
    while (queue.length) {
      // Explicit ties keep the bounded search independent of worker and sort order.
      let index = 0;
      for (let i = 1; i < queue.length; i++) {
        const a = queue[i]!, b = queue[index]!;
        if (a.upper > b.upper || (a.upper === b.upper && (a.x < b.x || (a.x === b.x && a.y < b.y)))) index = i;
      }
      const cell = queue.splice(index, 1)[0]!;
      if (cell.upper <= best + radiusTolerance) { upper = Math.max(upper, cell.upper); continue; }
      if (cell.depth === 24) throw Error('Native anchor radius is unresolved at the depth limit.');
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) add(cell.x + sx * cell.hx / 2, cell.y + sy * cell.hy / 2, cell.hx / 2, cell.hy / 2, cell.depth + 1);
    }
    const chosen = candidates.filter(p => p.lower > 0 && p.lower >= best - tieTolerance).sort((a, b) => a.x - b.x || a.y - b.y)[0];
    if (!chosen || upper - chosen.lower > radiusTolerance + tieTolerance + 2 * distanceError) throw Error('No certified interior anchor was found.');
    return { point: [chosen.x, chosen.y], method: 'inscribed-circle', samples, radiusLower: chosen.lower,
      radiusError: Math.max(0, upper - chosen.lower), radiusTolerance, tieTolerance };
  } finally { border.delete(); box.delete(); }
}
