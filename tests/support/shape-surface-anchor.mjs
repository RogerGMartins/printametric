/** Deterministic native-curve anchor investigation. Keep an interior area centroid;
 * otherwise bound the maximum-inscribed-circle radius using 1-Lipschitz signed
 * distance and native face/boundary distances. Numerical tolerances are explicit
 * checkpoint proposals; exhausting work never substitutes an arbitrary point. */
export function selectNativeAnchor(kernel, face, centroid) {
  const distanceError = 1e-7, radiusTolerance = .0005, tieTolerance = 1e-6;
  const border = face.clone().outerWire(), box = face.boundingBox;
  let samples = 0;
  const sample = (x, y) => {
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
    const queue = [], candidates = [];
    let best = -Infinity, upper = -Infinity;
    const add = (x, y, hx, hy, depth) => {
      const p = sample(x, y), cell = { ...p, hx, hy, depth, upper: p.d + distanceError + Math.hypot(hx, hy) };
      candidates.push(p); best = Math.max(best, p.lower); queue.push(cell);
    };
    add((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (max[0] - min[0]) / 2, (max[1] - min[1]) / 2, 0);
    while (queue.length) {
      // The list and evaluations are capped at 4096. Stable explicit selection
      // keeps tie handling independent of engine sort stability or worker order.
      let index = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].upper > queue[index].upper || (queue[i].upper === queue[index].upper && (queue[i].x < queue[index].x || (queue[i].x === queue[index].x && queue[i].y < queue[index].y)))) index = i;
      const cell = queue.splice(index, 1)[0];
      if (cell.upper <= best + radiusTolerance) { upper = Math.max(upper, cell.upper); continue; }
      if (cell.depth === 24) throw Error('Native anchor radius is unresolved at the depth limit.');
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) add(cell.x + sx * cell.hx / 2, cell.y + sy * cell.hy / 2, cell.hx / 2, cell.hy / 2, cell.depth + 1);
    }
    const eligible = candidates.filter(p => p.lower > 0 && p.lower >= best - tieTolerance).sort((a, b) => a.x - b.x || a.y - b.y);
    const chosen = eligible[0];
    if (!chosen || upper - chosen.lower > radiusTolerance + tieTolerance + 2 * distanceError) throw Error('No certified interior anchor was found.');
    return { point: [chosen.x, chosen.y], method: 'inscribed-circle', samples, radiusLower: chosen.lower,
      radiusError: Math.max(0, upper - chosen.lower), radiusTolerance, tieTolerance };
  } finally { border.delete(); box.delete(); }
}
