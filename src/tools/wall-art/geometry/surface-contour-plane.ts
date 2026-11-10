/** Area-weighted planar fitting on a bounded native rational contour. Constraint
 * exchange uses actual curve points; Bernstein subdivision certifies the entire
 * boundary before acceptance. It never substitutes a control-polygon domain,
 * clamps individual points, or returns a horizontal fallback. */
import { DesignError } from '../model/budget.ts';
import type { ContourMoments, ContourSpan } from './surface-contour-moments.ts';

type Vector = readonly number[];
const dot = (a: Vector, b: Vector) => a.reduce((sum, v, i) => sum + v * b[i]!, 0);
function solve(a: number[][], b: Vector): number[] | undefined {
  const rows = a.map((row, i) => [...row, b[i]!]), n = b.length;
  for (let i = 0; i < n; i++) {
    let pivot = i; for (let j = i + 1; j < n; j++) if (Math.abs(rows[j]![i]!) > Math.abs(rows[pivot]![i]!)) pivot = j;
    [rows[i], rows[pivot]] = [rows[pivot]!, rows[i]!];
    const denominator = rows[i]![i]!; if (Math.abs(denominator) < 1e-12) return undefined;
    for (let k = i; k <= n; k++) rows[i]![k] = rows[i]![k]! / denominator;
    for (let j = 0; j < n; j++) if (j !== i) {
      const factor = rows[j]![i]!; for (let k = i; k <= n; k++) rows[j]![k] = rows[j]![k]! - factor * rows[i]![k]!;
    }
  }
  return rows.map(row => row[n]!);
}

export function fitContourPlane(m: ContourMoments, spans: readonly ContourSpan[], anchor: readonly [number, number]) {
  if (![m.area, m.scale, m.u, m.v, m.uu, m.uv, m.vv, m.mean, m.uMean, m.vMean, m.error, ...anchor].every(Number.isFinite) ||
    m.area < 1 || m.scale < .001 || m.scale > 8000 || m.error < 0 || m.error > .001 || m.mean < -m.error || m.mean > 1 + m.error || !spans.length || spans.length > 2048) throw new DesignError('SURFACE_FIT', 'Invalid native-domain fitting data.');
  const g = [[1, m.u, m.v], [m.u, m.uu, m.uv], [m.v, m.uv, m.vv]], b = [m.mean, m.uMean, m.vMean];
  if (m.uu - m.u ** 2 <= 1e-10 || (m.uu - m.u ** 2) * (m.vv - m.v ** 2) - (m.uv - m.u * m.v) ** 2 <= 1e-12) throw new DesignError('SURFACE_FIT', 'Native-domain plane fit is ill-conditioned.');
  const inverse = [0, 1, 2].map(i => solve(g, [0, 1, 2].map(j => i === j ? 1 : 0)));
  if (inverse.some(row => !row)) throw new DesignError('SURFACE_FIT', 'Native-domain moment matrix is singular.');
  const inv = inverse as number[][], target = solve(g, b)!;
  const inverseNorm = Math.max(...inv.map(row => row.reduce((sum, x) => sum + Math.abs(x), 0)));
  if (3 * inverseNorm * m.error >= .1) throw new DesignError('SURFACE_FIT', 'Moment uncertainty is too large for this plane fit.');
  const constraints: { a: number[]; b: number }[] = [], margin = 1e-11;
  let work = 0, poles = 0;
  const initial = spans.map(span => {
    poles += span.points.length;
    if (poles > 4096 || span.points.length < 2 || span.points.length > 19 || span.weights.length !== span.points.length || span.weights.some(w => !Number.isFinite(w) || w <= 0) || span.points.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw new DesignError('SURFACE_FIT', 'Invalid fitting boundary.');
    const maximum = Math.max(...span.weights);
    if (Math.min(...span.weights) / maximum < 1e-6 || span.points.some(p => p.some((v, i) => Math.abs(v - anchor[i]!) > m.scale * (1 + 1e-12)))) throw new DesignError('SURFACE_FIT', 'Native fitting coordinates exceed their normalization bounds.');
    return span.points.map((p, i) => { const w = span.weights[i]! / maximum; return [(p[0] - anchor[0]) / m.scale * w, (p[1] - anchor[1]) / m.scale * w, w]; });
  });
  const multiplyInverse = (a: Vector) => inv.map(row => dot(row, a));
  const objective = (result: Vector) => { const delta = result.map((v, i) => v - target[i]!); return dot(delta, g.map(row => dot(row, delta))); };
  function quadratic(relaxed = false): number[] {
    let best: number[] | undefined, cost = Infinity;
    const attempt = (indices: number[]) => {
      const rows = indices.map(i => constraints[i]!), inverseRows = rows.map(row => multiplyInverse(row.a));
      const lambda = solve(rows.map(row => inverseRows.map(other => dot(row.a, other))), rows.map(row => dot(row.a, target) - row.b - (relaxed ? margin : 0)));
      if (!lambda) return;
      const result = target.map((v, i) => v - inverseRows.reduce((sum, row, j) => sum + row[i]! * lambda[j]!, 0));
      if (constraints.some(row => dot(row.a, result) > row.b + (relaxed ? margin : 0) + 1e-12)) return;
      const value = objective(result);
      if (value < cost) { best = result; cost = value; }
    };
    attempt([]);
    for (let i = 0; i < constraints.length; i++) { attempt([i]); for (let j = i + 1; j < constraints.length; j++) { attempt([i, j]); for (let k = j + 1; k < constraints.length; k++) attempt([i, j, k]); } }
    if (!best) throw new DesignError('SURFACE_FIT', 'No feasible native-domain plane was found.');
    return best;
  }
  for (let iteration = 0; iteration <= 24; iteration++) {
    const plane = quadratic(), roundoff = 8192 * Number.EPSILON * (1 + plane.reduce((s, x) => s + Math.abs(x), 0));
    let worst: { point: number[]; value: number; amount: number } | undefined, uncertain = false;
    const inspect = (h: number[][], depth: number): void => {
      if (++work > 65536) throw new DesignError('SURFACE_BUDGET', 'Native plane constraint work exhausted.');
      const values = h.map(p => plane[0]! + plane[1]! * p[0]! / p[2]! + plane[2]! * p[1]! / p[2]!);
      const allowance = roundoff / Math.min(...h.map(p => p[2]!));
      if (Math.min(...values) >= allowance && Math.max(...values) <= 1 - allowance) return;
      let row = h; const left = [row[0]!], right = [row.at(-1)!];
      while (row.length > 1) { row = row.slice(1).map((p, i) => p.map((v, k) => (v + row[i]![k]!) / 2)); left.push(row[0]!); right.unshift(row.at(-1)!); }
      let violation = false;
      for (const p of [h[0]!, row[0]!, h.at(-1)!]) {
        const point = [1, p[0]! / p[2]!, p[1]! / p[2]!], value = dot(plane, point), amount = Math.max(margin - value, value - (1 - margin));
        if (amount > 1e-12) { violation = true; if (!worst || amount > worst.amount) worst = { point, value, amount }; }
      }
      if (violation) return;
      if (depth >= 8) { uncertain = true; return; }
      inspect(left, depth + 1); inspect(right, depth + 1);
    };
    for (const h of initial) inspect(h, 0);
    if (!worst && !uncertain) {
      // Removing the numerical margins makes the finite cut problem a relaxation
      // of the true whole-boundary constraints. Its objective is a lower bound;
      // strong convexity converts the remaining objective gap to a field bound.
      const coefficientMagnitude = Math.max(...plane.map(Math.abs));
      const lower = quadratic(true), value = objective(plane), lowerValue = objective(lower);
      const objectiveGap = Math.max(0, value - lowerValue) + 8192 * Number.EPSILON * Math.max(value, lowerValue, Number.MIN_VALUE);
      const error = 6 * inverseNorm * m.error * (1 + 3 * coefficientMagnitude) / (1 - 3 * inverseNorm * m.error) + Math.sqrt(3 * inverseNorm * objectiveGap);
      return Object.freeze({ coefficients: Object.freeze(plane) as readonly number[], error, objectiveGap, constraints: constraints.length, work });
    }
    if (!worst || iteration === 24) throw new DesignError('SURFACE_FIT', 'Complete native-boundary plane constraints could not be certified.');
    const violation = worst as { point: number[]; value: number; amount: number };
    const sign = violation.value < margin ? -1 : 1, a = violation.point.map(v => sign * v), limit = sign < 0 ? -margin : 1 - margin;
    if (constraints.some(row => row.a.every((v, i) => Math.abs(v - a[i]!) < 1e-12))) throw new DesignError('SURFACE_FIT', 'Native plane constraint refinement stalled.');
    constraints.push({ a, b: limit });
  }
  throw new DesignError('SURFACE_FIT', 'Native plane fit did not converge.');
}
