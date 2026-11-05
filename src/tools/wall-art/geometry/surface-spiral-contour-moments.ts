/** Checkpoint-only Spiral Green integrals over native rational contours.
 * A radial primitive integrates each angular mode without an atan2 branch cut.
 * Origin and envelope-join charts have explicit remainder bounds. The center
 * experiment stays an argument, never a saved parameter or implicit C2 upgrade. */
import { DesignError } from '../model/budget.ts';
import type { ParametersV3 } from '../model/parameters-v3.ts';
import type { ContourMoments, ContourSpan } from './surface-contour-moments.ts';
import { spiralCenterWeight, type SpiralCenter } from './spiral-center.ts';
import { contourPointAt as at, splitContour as split, contourComplexEnvelope as envelope, type ContourPoint as Point } from './surface-contour-derivatives.ts';

type Complex = readonly [number, number];
const nodes = [-.9602898564975363, -.7966664774136267, -.525532409916329, -.1834346424956498,
  .1834346424956498, .525532409916329, .7966664774136267, .9602898564975363];
const weights = [.1012285362903763, .2223810344533745, .3137066458778873, .362683783378362,
  .362683783378362, .3137066458778873, .2223810344533745, .1012285362903763];
const gauss = 40320 ** 4 / (17 * 20922789888000 ** 2);
const maxAbs = (a: number[]) => Math.max(...a.map(Math.abs));

/** (Px²+Py²)/W² is a rational Bernstein polynomial with positive denominator
 * coefficients. Its coefficient ratios bound the complete squared radius, even
 * when a Cartesian control box straddles a constant-radius envelope join. */
function radiusHull(points: readonly Point[]): readonly [number, number] {
  const n = points.length - 1;
  const choose = (degree: number, index: number) => { let value = 1; for (let i = 1; i <= index; i++) value *= (degree - i + 1) / i; return value; };
  let lower = Infinity, upper = 0;
  for (let k = 0; k <= 2 * n; k++) {
    let numerator = 0, denominator = 0, absolute = 0;
    for (let i = Math.max(0, k - n); i <= Math.min(n, k); i++) {
      const j = k - i, factor = choose(n, i) * choose(n, j) / choose(2 * n, k), a = points[i]!, b = points[j]!;
      numerator += factor * (a[0] * b[0] + a[1] * b[1]);
      absolute += factor * (Math.abs(a[0] * b[0]) + Math.abs(a[1] * b[1]));
      denominator += factor * a[2] * b[2];
    }
    const allowance = 8192 * Number.EPSILON * (absolute + Math.abs(numerator)) / denominator;
    lower = Math.min(lower, numerator / denominator - allowance);
    upper = Math.max(upper, numerator / denominator + allowance);
  }
  return [Math.sqrt(Math.max(0, lower)) * (1 - 1e-12), Math.sqrt(upper) * (1 + 1e-12)];
}

/** Integral_0^1 u^power exp(-i*z*u) du. For |z|<=2, 32 Taylor terms
 * leave < exp(2)*2^32/32! < 1.3e-25 absolute remainder. Outside that interval,
 * integration by parts is well-conditioned for the only requested powers 1/2. */
function exponentialMoment(z: number, power: number): Complex {
  if (Math.abs(z) <= 2) {
    let re = 0, im = 0, tr = 1, ti = 0;
    for (let n = 0; n < 32; n++) {
      re += tr / (power + n + 1); im += ti / (power + n + 1);
      [tr, ti] = [ti * z / (n + 1), -tr * z / (n + 1)];
    }
    return [re, im];
  }
  let re = Math.sin(z) / z, im = (Math.cos(z) - 1) / z;
  for (let j = 1; j <= power; j++) [re, im] = [Math.sin(z) / z + j * im / z, Math.cos(z) / z - j * re / z];
  return [re, im];
}

interface Chart { points: Point[]; direction: number; depth: number; values: number[]; error: number; arithmetic: number }
export function spiralContourMoments(p: ParametersV3, spans: readonly ContourSpan[], anchor: readonly [number, number],
  geometry: ContourMoments, orientation: number, target: number, availableCharts: number, mode: SpiralCenter): ContourMoments {
  const length = Math.min(p.width, p.height), center = .01 * length, k = 4 * Math.PI * p.density / length;
  const phase = 2 * Math.PI * (p.phase % 1) - p.spiralArms * (p.rotation % 360) * Math.PI / 180;
  const polynomial = mode === 'linear' ? [[1, 1]] : mode === 'smooth-c1' ? [[2, 3], [3, -2]] : [[3, 10], [4, -15], [5, 6]];
  const inner = (r: number, j: number): Complex => {
    let re = 0, im = 0;
    for (const [power, coefficient] of polynomial) {
      const integral = exponentialMoment(k * r, j + power!), factor = coefficient! * (r / center) ** power!;
      re += factor * integral[0]; im += factor * integral[1];
    }
    return [re, im];
  };
  const correction = [1, 2].map(j => { const a = inner(center, j), b = exponentialMoment(k * center, j); return [a[0] - b[0], a[1] - b[1]] as Complex; });
  const radial = (r: number, j: number): Complex => {
    if (r <= center) return inner(r, j);
    const outer = exponentialMoment(k * r, j), factor = (center / r) ** (j + 1), delta = correction[j - 1]!;
    return [outer[0] + factor * delta[0], outer[1] + factor * delta[1]];
  };
  let created = 0, evaluations = geometry.evaluations;
  function make(points: Point[], direction: number, depth: number): Chart {
    if (++created > availableCharts || evaluations + 8 > 65536) throw new DesignError('SURFACE_BUDGET', 'Spiral contour integration exhausted its shared work budget.');
    const n = points.length - 1, d = points.slice(1).map((point, i) => point.map((v, j) => n * (v - points[i]![j]!)) as unknown as Point);
    const lowerW = Math.min(...points.map(v => v[2]));
    const xs = points.map(v => v[0] / v[2]), ys = points.map(v => v[1] / v[2]);
    const nearAxis = (a: number[]) => Math.max(0, Math.min(...a), -Math.max(...a));
    const [radialNear, radialFar] = radiusHull(points);
    const near = Math.max(radialNear, Math.hypot(nearAxis(xs), nearAxis(ys)) * (1 - 1e-12));
    const far = Math.min(radialFar, Math.hypot(maxAbs(xs), maxAbs(ys)) * (1 + 1e-12));
    let realJ = (maxAbs(points.map(v => v[0])) * maxAbs(d.map(v => v[1])) + maxAbs(points.map(v => v[1])) * maxAbs(d.map(v => v[0]))) / lowerW ** 2;
    let lineCross: number | undefined, determinantError = 0;
    if (points.length === 2 && points[0]![2] === points[1]![2]) {
      const [a, b] = points as [Point, Point], positive = a[0] * b[1], negative = a[1] * b[0];
      lineCross = (positive - negative) / a[2] ** 2;
      determinantError = 8192 * Number.EPSILON * (Math.abs(positive) + Math.abs(negative)) / a[2] ** 2;
      realJ = Math.abs(lineCross) + determinantError;
    }
    const relative = Math.max(1, (maxAbs(xs) + Math.abs(anchor[0])) / geometry.scale, (maxAbs(ys) + Math.abs(anchor[1])) / geometry.scale);
    let arithmeticMagnitude = relative;
    if (near >= center && k * near >= 2) {
      // Bound actual terms of the outer recurrence rather than assigning unit
      // amplitude to a decaying radial primitive. The stored center correction
      // and its subtraction error decay as (center/r)^(j+1) as well.
      const z = k * near, coefficientSum = polynomial.reduce((sum, [, a]) => sum + Math.abs(a!), 1);
      const centerMagnitude = Math.exp(k * center) * coefficientSum;
      const b0 = 1 / z + 2 / z ** 2 + centerMagnitude / 2 * (center / near) ** 2;
      const b1 = 1 / z + 2 / z ** 2 + 4 / z ** 3 + centerMagnitude / 3 * (center / near) ** 3;
      arithmeticMagnitude = Math.min(relative, Math.max(b0,
        (maxAbs(xs) * b1 + Math.abs(anchor[0]) * b0) / geometry.scale,
        (maxAbs(ys) * b1 + Math.abs(anchor[1]) * b0) / geometry.scale));
    }
    // The radial primitive's oscillatory factor is at most w(far)/(j+1).
    // This bound also handles a curve through the origin without dividing by r.
    const centerError = .25 * spiralCenterWeight(2 * far / length, mode) * realJ * relative;
    let analyticError = Infinity;
    for (const rho of [.125, .25, .5, 1, 2]) {
      const ex = envelope(points.map(v => v[0]), rho), ey = envelope(points.map(v => v[1]), rho), ew = envelope(points.map(v => v[2]), rho);
      const w = lowerW - ew.variation; if (w <= lowerW * .1 || near === 0) continue;
      const dx = (ex.derivative * ew.value + ex.value * ew.derivative) / w ** 2;
      const dy = (ey.derivative * ew.value + ey.value * ew.derivative) / w ** 2;
      const eta = rho * Math.hypot(dx, dy); if (eta >= near / 8) continue;
      // |sqrt(C(z)·C(z))-r| <= 3*eta; the disk excludes both square-root
      // zeros. (x+i*y)/r gives a single-valued integer angular mode.
      const lowR = near - 3 * eta, angular = ((near + 2 * eta) / lowR) ** p.spiralArms;
      const inside = far < center;
      const envelopeSize = inside ? polynomial.reduce((sum, [power, coefficient]) => sum + Math.abs(coefficient!) * ((far + 3 * eta) / center) ** power!, 0) : 1;
      const base = envelopeSize * Math.exp(3 * k * eta);
      const b0 = (base + (inside ? 0 : (center / lowR) ** 2)) / 2;
      const b1 = (base + (inside ? 0 : (center / lowR) ** 3)) / 3;
      const moment = Math.max(b0, (ex.value / w * b1 + Math.abs(anchor[0]) * b0) / geometry.scale,
        (ey.value / w * b1 + Math.abs(anchor[1]) * b0) / geometry.scale);
      const jacobian = (ex.value * ey.derivative + ey.value * ex.derivative) / w ** 2;
      const analytic = gauss * .5 * angular * moment * jacobian / rho ** 16;
      // At the center-envelope join, the outer analytic primitive differs by
      // only the missing integral from r to center. Charge it in Q8 and integral.
      const join = !inside && near < center ? (1 - spiralCenterWeight(2 * near / length, mode)) *
        Math.max(((center / near) ** 2 - 1) / 2, ((center / near) ** 3 - 1) / 3) * realJ * relative : 0;
      analyticError = Math.min(analyticError, analytic + join);
    }
    const zero = centerError <= analyticError, values: [number, number, number] = [0, 0, 0];
    if (!zero) for (let i = 0; i < 8; i++) {
      const t = (nodes[i]! + 1) / 2, v = at(points, t), tangent = at(d, t);
      const x = v[0] / v[2], y = v[1] / v[2], r = Math.hypot(x, y);
      const angle = p.spiralArms * Math.atan2(y, x) + phase, c = Math.cos(angle), s = Math.sin(angle);
      const a = radial(r, 1), b = radial(r, 2), f0 = c * a[0] - s * a[1], f1 = c * b[0] - s * b[1];
      const cross = lineCross ?? (v[0] * tangent[1] - v[1] * tangent[0]) / v[2] ** 2;
      const measure = .25 * weights[i]! * direction * orientation * cross;
      values[0] += measure * f0;
      values[1] += measure * (x * f1 - anchor[0] * f0) / geometry.scale;
      values[2] += measure * (y * f1 - anchor[1] * f0) / geometry.scale;
    }
    evaluations += zero ? 0 : 8;
    // Arithmetic allowance: <=65,536 accumulated samples, <=32 Taylor terms
    // with absolute polynomial coefficient sum <=31 and exp(k*center)<4.52,
    // plus degree-18 rational evaluation and the short outer recurrence. The
    // 2^17 coefficient includes their operation-count margin. Phase sensitivity
    // and rational conditioning are separate factors; libm accuracy is assumed.
    const floating = 131072 * Number.EPSILON * (1 + k * far + p.spiralArms) * realJ * arithmeticMagnitude / lowerW ** 3 + determinantError * relative;
    return { points, direction, depth, values, error: Math.min(centerError, analyticError) + floating, arithmetic: floating };
  }
  const charts = spans.map(span => { const max = Math.max(...span.weights); return make(span.points.map((p, i): Point => {
    const w = span.weights[i]! / max; return [p[0] * w, p[1] * w, w];
  }), span.direction, 0); });
  for (;;) {
    const totals = [0, 0, 0]; let error = 0;
    for (const chart of charts) { error += chart.error; chart.values.forEach((v, i) => { totals[i] = totals[i]! + v; }); }
    const result = [.5, geometry.u / 2, geometry.v / 2].map((v, i) => v + totals[i]! / geometry.area);
    error = (error / geometry.area + 2 * geometry.error * Math.max(1, ...result.map(Math.abs))) / (1 - geometry.error);
    if (Number.isFinite(error) && error <= target) {
      if (!result.every(Number.isFinite) || result[0]! < -error || result[0]! > 1 + error) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Spiral contour moments exceed their field bounds.');
      return Object.freeze({ ...geometry, mean: result[0]!, uMean: result[1]!, vMean: result[2]!, error, evaluations });
    }
    let index = -1;
    for (let i = 0; i < charts.length; i++) if (charts[i]!.depth < 8 && (index < 0 || charts[i]!.error > charts[index]!.error)) index = i;
    if (index < 0) throw new DesignError('SURFACE_DOMAIN_ERROR', `Spiral contour error ${error} exceeds ${target} at the refinement limit (arithmetic ${charts.reduce((sum, c) => sum + c.arithmetic, 0) / geometry.area}).`);
    const chart = charts[index]!, children = split(chart.points).map(points => make(points, chart.direction, chart.depth + 1));
    charts.splice(index, 1, ...children);
  }
}
