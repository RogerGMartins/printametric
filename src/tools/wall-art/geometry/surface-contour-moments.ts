/** Checkpoint-only integration on closed native rational-Bezier boundaries.
 * A signed radial fan integrates actual curved domains, including non-star-shaped
 * ones; this is NOT a taper-containment certificate. Wave/Dunes/Random are entire
 * harmonic fields. Ring's cos(k*sqrt(x²+y²)) is also entire: its power series has
 * no square-root branch and grows at most exp(k*|Im(x,y)|). Tensor Gauss remainder
 * bounds use complex disks with a proven
 * nonzero rational denominator. Ridges, Dome and Spiral use separate Green boundary
 * integrals after these charts certify geometric moments, sharing the work budget.
 * Floating allowances assume ordinary libm accuracy, as in rectangular moments. */
import { DesignError } from '../model/budget.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import { createSurfaceField } from './surface-fields.ts';
import { ridgeContourMoments } from './surface-ridge-contour-moments.ts';
import { domeContourMoments } from './surface-dome-contour-moments.ts';
import { spiralContourMoments } from './surface-spiral-contour-moments.ts';
import { validateSpiralCenter, type SpiralCenter } from './spiral-center.ts';
import { contourComplexEnvelope as envelope } from './surface-contour-derivatives.ts';

export interface ContourSpan {
  readonly points: readonly (readonly [number, number])[];
  readonly weights: readonly number[];
  readonly direction: 1 | -1;
}
export interface ContourMoments {
  readonly area: number;
  readonly scale: number;
  /** u=(x-anchorX)/scale, v=(y-anchorY)/scale, normalized area moments. */
  readonly u: number; readonly v: number;
  readonly uu: number; readonly uv: number; readonly vv: number;
  readonly mean: number; readonly uMean: number; readonly vMean: number;
  readonly error: number;
  readonly evaluations: number;
}
type HPoint = readonly [number, number, number];
interface Chart { h: HPoint[]; direction: number; a: number; b: number; depth: number; values: number[]; error: number; radialError: number; boundaryError: number }
const nodes = [-.9602898564975363, -.7966664774136267, -.525532409916329, -.1834346424956498,
  .1834346424956498, .525532409916329, .7966664774136267, .9602898564975363];
const weights = [.1012285362903763, .2223810344533745, .3137066458778873, .362683783378362,
  .362683783378362, .3137066458778873, .2223810344533745, .1012285362903763];
// Gauss-8 remainder after Cauchy's 16! derivative bound, on a unit interval.
const gauss = 40320 ** 4 / (17 * 20922789888000 ** 2);
const maximum = (a: number[]) => Math.max(...a.map(Math.abs));
function at(h: readonly HPoint[], t: number): HPoint {
  let row = h.map(p => [...p]);
  while (row.length > 1) row = row.slice(1).map((p, i) => p.map((v, k) => row[i]![k]! * (1 - t) + v * t));
  return row[0]! as [number, number, number];
}
function divide(h: readonly HPoint[]): [HPoint[], HPoint[]] {
  let row = [...h]; const left = [row[0]!], right = [row.at(-1)!];
  while (row.length > 1) {
    row = row.slice(1).map((p, i) => p.map((v, k) => (v + row[i]![k]!) / 2) as unknown as HPoint);
    left.push(row[0]!); right.unshift(row.at(-1)!);
  }
  return [left, right];
}

/** Caller supplies spans of a validated, closed native face in assembly mm.
 * Native contour approximation/closure errors remain a separate explicit budget.
 * This function validates numeric/work bounds; it does not infer native topology.
 * Spiral center modes are explicit diagnostic arguments, not saved parameters. */
export function contourSurfaceMoments(input: unknown, spans: readonly ContourSpan[], anchor: readonly [number, number], tolerance?: number, spiralCenter: SpiralCenter = 'linear', charge?: (count: number) => void): ContourMoments {
  const p = validateParametersV3(input);
  validateSpiralCenter(spiralCenter);
  if (anchor.length !== 2 || !anchor.every(x => Number.isFinite(x) && Math.abs(x) <= 4000) || !spans.length || spans.length > 2048) throw new DesignError('SURFACE_DOMAIN', 'Invalid bounded contour.');
  let poles = 0, scale = 0;
  const initial = spans.map(span => {
    poles += span.points.length;
    if (poles > 4096 || span.points.length < 2 || span.points.length > 19 || span.weights.length !== span.points.length || ![1, -1].includes(span.direction) ||
      span.points.some(point => point.length !== 2 || !point.every(x => Number.isFinite(x) && Math.abs(x) <= 4000)) ||
      span.weights.some(w => !Number.isFinite(w) || w <= 0)) throw new DesignError('SURFACE_DOMAIN', 'Invalid rational contour span.');
    const max = Math.max(...span.weights), min = Math.min(...span.weights);
    if (min / max < 1e-6) throw new DesignError('SURFACE_DOMAIN', 'Rational contour weights are ill-conditioned.');
    const h = span.points.map((point, i): HPoint => {
      const x = point[0] - anchor[0], y = point[1] - anchor[1], w = span.weights[i]! / max;
      scale = Math.max(scale, Math.abs(x), Math.abs(y)); return [x * w, y * w, w];
    });
    return { h, direction: span.direction };
  });
  if (!Number.isFinite(scale) || scale < .001 || scale > 8000) throw new DesignError('SURFACE_DOMAIN', 'Invalid contour extent.');
  if (tolerance !== undefined && (!Number.isFinite(tolerance) || tolerance <= 0)) throw new DesignError('SURFACE_DOMAIN', 'Invalid moment precision.');
  const field = createSurfaceField(p), target = Math.min(.001, .00025 / Math.max(p.depth, 1), tolerance ?? Infinity);
  const geometricOnly = p.family === 'ridges' || p.family === 'dome' || p.family === 'spiral';
  const k = geometricOnly ? 0 : 2 * Math.PI * p.density / Math.min(p.width, p.height) * (p.family === 'random' ? 1.5 : p.family === 'ring' ? 2 : 1);
  let evaluations = 0, created = 0;
  function chart(h: HPoint[], direction: number, a: number, b: number, depth: number): Chart {
    if (++created > 4096 || evaluations + 64 > 65536) throw new DesignError('SURFACE_BUDGET', 'Native-contour moment work exhausted.');
    const n = h.length - 1, derivative = h.slice(1).map((v, i) => v.map((x, j) => n * (x - h[i]![j]!)) as unknown as HPoint);
    const px = maximum(h.map(v => v[0])), py = maximum(h.map(v => v[1])), wmin = Math.min(...h.map(v => v[2]));
    const dx = maximum(derivative.map(v => v[0])), dy = maximum(derivative.map(v => v[1]));
    const span = b - a, realJ = (px * dy + py * dx) / wmin ** 2;
    let radialError = Infinity, boundaryError = Infinity;
    for (const rho of [.25, .5, 1, 2]) {
      // For real t, C lies in the positive-weight control hull. The radial
      // variable is polynomial; only the entire harmonic factor grows off-axis.
      const radius = b + span * rho, coordinate = Math.hypot(px, py) / wmin;
      const f = .5 + .5 * Math.exp(k * span * rho * coordinate);
      const polynomial = Math.max(1, (radius * coordinate / scale) ** 2);
      const radialM = span * radius * realJ * polynomial * Math.max(1, f);
      radialError = Math.min(radialError, gauss * radialM / rho ** 16);
      const ex = envelope(h.map(v => v[0]), rho), ey = envelope(h.map(v => v[1]), rho), ew = envelope(h.map(v => v[2]), rho);
      const lower = wmin - ew.variation;
      if (lower <= wmin * .1) continue;
      const cx = ex.value / lower, cy = ey.value / lower;
      const dcx = (ex.derivative * ew.value + ex.value * ew.derivative) / lower ** 2;
      const dcy = (ey.derivative * ew.value + ey.value * ew.derivative) / lower ** 2;
      const fieldGrowth = .5 + .5 * Math.exp(k * b * rho * Math.hypot(dcx, dcy));
      const jacobian = (ex.value * ey.derivative + ey.value * ex.derivative) / lower ** 2;
      const polynomials = Math.max(1, (b * Math.hypot(cx, cy) / scale) ** 2);
      const boundaryM = span * b * jacobian * polynomials * Math.max(1, fieldGrowth);
      boundaryError = Math.min(boundaryError, gauss * boundaryM / rho ** 16);
    }
    const values = Array<number>(9).fill(0); let absolute = 0;
    charge?.(64);
    for (let i = 0; i < 8; i++) {
      const t = (nodes[i]! + 1) / 2, point = at(h, t), d = at(derivative, t);
      const x = point[0] / point[2], y = point[1] / point[2], j = direction * (point[0] * d[1] - point[1] * d[0]) / point[2] ** 2;
      for (let m = 0; m < 8; m++) {
        const r = a + span * (nodes[m]! + 1) / 2, measure = weights[i]! * weights[m]! * span * r * j / 4;
        const u = r * x / scale, v = r * y / scale, f = geometricOnly ? 0 : field.evaluate(anchor[0] + r * x, anchor[1] + r * y);
        const factors = [1, u, v, u * u, u * v, v * v, f, u * f, v * f];
        for (let q = 0; q < 9; q++) values[q] = values[q]! + measure * factors[q]!;
        absolute += Math.abs(measure); evaluations++;
      }
    }
    const floating = 262144 * Number.EPSILON * (1 + k * (Math.abs(anchor[0]) + Math.abs(anchor[1]) + scale)) * absolute / wmin ** 3;
    const error = radialError + boundaryError + floating;
    return { h, direction, a, b, depth, values, radialError, boundaryError, error: Number.isFinite(error) ? error : Infinity };
  }
  let charts = initial.map(s => chart(s.h, s.direction, 0, 1, 0));
  for (;;) {
    const totals = Array<number>(9).fill(0); let error = 0;
    for (const c of charts) { error += c.error; for (let q = 0; q < 9; q++) totals[q] = totals[q]! + c.values[q]!; }
    const signedArea = totals[0]!, area = Math.abs(signedArea);
    if (area > 0 && Number.isFinite(error) && 2 * error / (area - error) <= target / (geometricOnly ? 16 : 1) && area > error) {
      const normalized = totals.map(x => x / signedArea), resultError = 2 * error / (area - error);
      if (area < 1 || normalized[6]! < -resultError || normalized[6]! > 1 + resultError || !normalized.every(Number.isFinite)) throw new DesignError('SURFACE_DOMAIN', 'Native-contour moments have invalid area or field bounds.');
      const result = Object.freeze({ area, scale, u: normalized[1]!, v: normalized[2]!, uu: normalized[3]!, uv: normalized[4]!, vv: normalized[5]!,
        mean: normalized[6]!, uMean: normalized[7]!, vMean: normalized[8]!, error: resultError, evaluations });
      if (p.family === 'ridges') return ridgeContourMoments(p, spans, anchor, result, Math.sign(signedArea), target, 4096 - created, charge);
      if (p.family === 'dome') return domeContourMoments(p, spans, anchor, result, Math.sign(signedArea), target, 4096 - created, charge);
      if (p.family === 'spiral') return spiralContourMoments(p, spans, anchor, result, Math.sign(signedArea), target, 4096 - created, spiralCenter, charge);
      return result;
    }
    // At most 1,024 evaluated charts fit the field-work cap. A direct scan keeps
    // refinement order stable and avoids a separate mutable priority structure.
    let index = -1;
    for (let i = 0; i < charts.length; i++) if (charts[i]!.depth < 8 && (index < 0 || charts[i]!.error > charts[index]!.error)) index = i;
    if (index < 0) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Native-contour error could not be bounded.');
    const c = charts[index]!;
    if (c.radialError > c.boundaryError) {
      const mid = (c.a + c.b) / 2;
      charts.splice(index, 1, chart(c.h, c.direction, c.a, mid, c.depth + 1), chart(c.h, c.direction, mid, c.b, c.depth + 1));
    } else {
      const [left, right] = divide(c.h);
      charts.splice(index, 1, chart(left, c.direction, c.a, c.b, c.depth + 1), chart(right, c.direction, c.a, c.b, c.depth + 1));
    }
  }
}
