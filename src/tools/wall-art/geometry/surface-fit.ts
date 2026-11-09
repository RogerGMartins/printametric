/** R1 checkpoint numerics: polynomial Bernstein curves with whole-interval bounds.
 * Remainders use derivative envelopes and the complete nodal polynomial, never
 * agreement between sample grids. Floating-point balls cover polynomial arithmetic;
 * elementary sin/cos calls reserve 64 machine epsilons (not a formal libm proof).
 * No CAD allocation, field smoothing or production dispatch occurs here. */
import { DesignError } from '../model/budget.ts';

interface Ball { value: number; error: number }
export interface BoundedCurve { readonly coefficients: readonly number[]; readonly error: number }
const epsilon = Number.EPSILON;
const ball = (value: number, error = 0): Ball => ({ value, error });
const rounding = (magnitude: number) => 4 * epsilon * magnitude + Number.MIN_VALUE;
function add(a: Ball, b: Ball): Ball {
  return ball(a.value + b.value, a.error + b.error + rounding(Math.abs(a.value) + Math.abs(b.value) + a.error + b.error));
}
function multiply(a: Ball, b: Ball): Ball {
  const magnitude = (Math.abs(a.value) + a.error) * (Math.abs(b.value) + b.error);
  return ball(a.value * b.value, Math.abs(a.value) * b.error + Math.abs(b.value) * a.error + a.error * b.error + rounding(magnitude));
}
function divide(a: Ball, b: Ball): Ball {
  const lower = Math.abs(b.value) - b.error;
  if (!(lower > 0)) throw new DesignError('SURFACE_FIT', 'Interpolation denominator cannot be bounded.');
  const value = a.value / b.value;
  return ball(value, (a.error + Math.abs(value) * b.error) / lower + rounding((Math.abs(a.value) + a.error) / lower));
}
function affineProduct(a: readonly Ball[], left: Ball, right: Ball): Ball[] {
  const n = a.length;
  return Array.from({ length: n + 1 }, (_, i) => add(
    i < n ? multiply(multiply(a[i]!, left), ball((n - i) / n, epsilon)) : ball(0),
    i > 0 ? multiply(multiply(a[i - 1]!, right), ball(i / n, epsilon)) : ball(0)));
}
function split(a: readonly Ball[]): [Ball[], Ball[]] {
  let row = [...a]; const left = [row[0]!], right = [row.at(-1)!];
  while (row.length > 1) {
    row = row.slice(0, -1).map((v, i) => multiply(add(v, row[i + 1]!), ball(.5)));
    left.push(row[0]!); right.unshift(row.at(-1)!);
  }
  return [left, right];
}
function intervalMagnitude(a: readonly Ball[], depth: number): number {
  if (!depth) return Math.max(...a.map(v => Math.abs(v.value) + v.error));
  const [left, right] = split(a);
  return Math.max(intervalMagnitude(left, depth - 1), intervalMagnitude(right, depth - 1));
}
const bases = new Map<number, { nodes: number[]; basis: Ball[][]; productBound: number }>();
function interpolationBasis(degree: number) {
  if (!Number.isInteger(degree) || degree < 1 || degree > 18) throw new DesignError('SURFACE_FIT', 'Curve degree must be 1–18.');
  const previous = bases.get(degree); if (previous) return previous;
  // The actual double nodes define interpolation. Their ideal Chebyshev positions
  // are not used by the error proof, so a rounded node cannot invalidate it.
  const nodes = Array.from({ length: degree + 1 }, (_, i) => i === 0 ? 0 : i === degree ? 1 : (1 - Math.cos(Math.PI * i / degree)) / 2);
  const basis = nodes.map((node, i) => {
    let coefficients = [ball(1)], denominator = ball(1);
    nodes.forEach((other, j) => {
      if (j === i) return;
      coefficients = affineProduct(coefficients, ball(-other), add(ball(1), ball(-other)));
      denominator = multiply(denominator, add(ball(node), ball(-other)));
    });
    return coefficients.map(value => divide(value, denominator));
  });
  let product = [ball(1)];
  for (const node of nodes) product = affineProduct(product, ball(-node), add(ball(1), ball(-node)));
  const result = { nodes, basis, productBound: intervalMagnitude(product, 6) };
  bases.set(degree, result); return result;
}

/** Candidate only: no function approximation bound is implied. A separate
 * complete-domain comparison must accept these coefficients before CAD use. */
export function interpolateCandidate(evaluate: (t: number) => number, degree: number): readonly number[] {
  const { nodes, basis } = interpolationBasis(degree);
  const values = nodes.map(node => evaluate(node));
  if (!values.every(Number.isFinite)) throw new DesignError('SURFACE_FIT', 'Nonfinite candidate interpolation value.');
  const coefficients = nodes.map((_, j) => values.reduce((sum, value, i) => sum + value * basis[i]![j]!.value, 0));
  coefficients[0] = values[0]!; coefficients[degree] = values[degree]!;
  return coefficients;
}

/** Checkpoint profile candidate with a complete-interval Taylor residual bound.
 * Elementary power calls use the same explicit floating allowance as trig fits.
 * Exhausted refinement rejects the candidate rather than claiming sampled accuracy. */
export function fitPowerProfile(exponent: number, allowance: number, compact = false): BoundedCurve {
  if (!Number.isFinite(exponent) || exponent < 1 || exponent > 4 || !Number.isFinite(allowance) || allowance <= 0) throw new DesignError('SURFACE_FIT', 'Invalid side-profile request.');
  if (typeof compact !== 'boolean') throw new DesignError('SURFACE_FIT', 'Invalid side-profile strategy.');
  if (Number.isInteger(exponent)) return { coefficients: Array.from({ length: exponent + 1 }, (_, i) => i === exponent ? 1 : 0), error: 0 };
  function splitValues(values: readonly number[]) {
    let row = [...values]; const left = [row[0]!], right = [row.at(-1)!];
    while (row.length > 1) { row = row.slice(0, -1).map((v, i) => (v + row[i + 1]!) / 2); left.push(row[0]!); right.unshift(row.at(-1)!); }
    return [left, right] as const;
  }
  // A lower-degree candidate is useful when many clipped boundaries share this
  // profile. It must pass the same complete-interval residual proof below.
  for (const degree of compact ? [8, 10, 12, 16, 18] : [12, 16, 18]) {
    const coefficients = interpolateCandidate(t => t ** exponent, degree);
    function verify(values: readonly number[], lower: number, upper: number, depth: number): number | null {
      const width = upper - lower, middle = (lower + upper) / 2;
      const first = values.slice(1).map((v, i) => degree * (v - values[i]!) / width);
      const second = first.slice(1).map((v, i) => (degree - 1) * (v - first[i]!) / width);
      const value = splitValues(values)[0].at(-1)!, slope = splitValues(first)[0].at(-1)!;
      const derivative = exponent * middle ** (exponent - 1);
      const secondEnds = [lower, upper].map(t => exponent * (exponent - 1) * t ** (exponent - 2));
      const secondBound = Math.max(Math.abs(Math.min(...second) - Math.max(...secondEnds)), Math.abs(Math.max(...second) - Math.min(...secondEnds)));
      const rounding = 8192 * Number.EPSILON * Math.max(1, ...coefficients.map(Math.abs));
      const bound = Math.abs(value - middle ** exponent) + width / 2 * Math.abs(slope - derivative) + width * width / 8 * secondBound + rounding;
      if (Number.isFinite(bound) && bound <= allowance) return bound;
      if (depth === 8) return null;
      const halves = splitValues(values), a = verify(halves[0], lower, middle, depth + 1); if (a === null) return null;
      const b = verify(halves[1], middle, upper, depth + 1); return b === null ? null : Math.max(a, b);
    }
    const error = verify(coefficients, 0, 1, 0);
    if (error !== null) return { coefficients, error };
  }
  throw new DesignError('SURFACE_DOMAIN_ERROR', 'Side-profile residual exceeds the bounded polynomial route.');
}

/** Approximate sin(frequency*x + phase) on [start,end]. Frequency is radians/unit. */
export function fitSine(start: number, end: number, frequency: number, phase: number, degree: number): BoundedCurve {
  if (![start, end, frequency, phase].every(Number.isFinite) || !(end > start)) throw new DesignError('SURFACE_FIT', 'Invalid trigonometric domain.');
  const { nodes, basis, productBound } = interpolationBasis(degree);
  const span = add(ball(end), ball(-start));
  const values = nodes.map(node => {
    const argument = add(multiply(add(ball(start), multiply(span, ball(node))), ball(frequency)), ball(phase));
    return ball(Math.sin(argument.value), argument.error + 64 * epsilon);
  });
  const coefficients = nodes.map((_, j) => values.reduce((sum, value, i) => add(sum, multiply(value, basis[i]![j]!)), ball(0)));
  // Endpoint interpolation is exact in the polynomial contract. Assign it directly
  // so adjoining domains use the same boundary values instead of summation noise.
  coefficients[0] = values[0]!; coefficients[degree] = values[degree]!;
  let factorial = 1; for (let i = 2; i <= degree + 1; i++) factorial *= i;
  const argumentSpan = (Math.abs(span.value) + span.error) * Math.abs(frequency);
  const remainder = argumentSpan ** (degree + 1) * productBound / factorial;
  const error = remainder * (1 + 64 * epsilon) + Math.max(...coefficients.map(v => v.error));
  if (!Number.isFinite(error)) throw new DesignError('SURFACE_FIT', 'Trigonometric error bound overflowed.');
  return { coefficients: coefficients.map(v => v.value), error };
}

/** Degree elevation preserves the polynomial and its convex-hull error bound. */
export function elevateCurve(curve: BoundedCurve, degree: number): BoundedCurve {
  if (!Number.isInteger(degree) || degree < curve.coefficients.length - 1 || degree > 24) throw new DesignError('SURFACE_FIT', 'Invalid degree elevation.');
  let coefficients = curve.coefficients.map(value => ball(value, curve.error));
  while (coefficients.length <= degree) coefficients = affineProduct(coefficients, ball(1), ball(1));
  return { coefficients: coefficients.map(v => v.value), error: Math.max(...coefficients.map(v => v.error)) };
}

export function evaluateCurve(curve: BoundedCurve, t: number): number {
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new DesignError('SURFACE_FIT', 'Curve coordinate must be in [0,1].');
  let row = [...curve.coefficients];
  while (row.length > 1) row = row.slice(0, -1).map((value, i) => (1 - t) * value + t * row[i + 1]!);
  return row[0]!;
}

/** Multiplication by a linear function is exact in Bernstein form, apart from the
 * explicitly accumulated floating-point and source approximation error. */
export function multiplyLinear(curve: BoundedCurve, start: number, end: number): BoundedCurve {
  const result = affineProduct(curve.coefficients.map(value => ball(value, curve.error)), ball(start), ball(end));
  return { coefficients: result.map(v => v.value), error: Math.max(...result.map(v => v.error)) };
}

/** Exact polynomial multiplication by the experimental cubic/quintic envelope.
 * Source and arithmetic errors follow each Bernstein coefficient. */
export function multiplySmoothCenter(curve: BoundedCurve, start: number, end: number, order: 1 | 2 = 2): BoundedCurve {
  if (![start, end].every(Number.isFinite) || start < 0 || end > 1 || end <= start) throw new DesignError('SURFACE_FIT', 'Invalid center-envelope domain.');
  let power = curve;
  for (let i = 0; i < 2; i++) power = multiplyLinear(power, start, end);
  const third = multiplyLinear(power, start, end);
  if (order === 1) {
    const squared = elevateCurve(power, third.coefficients.length - 1);
    const result = third.coefficients.map((v, i) => add(multiply(ball(squared.coefficients[i]!, squared.error), ball(3)), multiply(ball(v, third.error), ball(-2))));
    return { coefficients: result.map(v => v.value), error: Math.max(...result.map(v => v.error)) };
  }
  power = third;
  const fourth = multiplyLinear(power, start, end), fifth = multiplyLinear(fourth, start, end);
  const degree = fifth.coefficients.length - 1, a = elevateCurve(power, degree), b = elevateCurve(fourth, degree);
  const result = fifth.coefficients.map((v, i) => add(add(multiply(ball(a.coefficients[i]!, a.error), ball(10)),
    multiply(ball(b.coefficients[i]!, b.error), ball(-15))), multiply(ball(v, fifth.error), ball(6))));
  return { coefficients: result.map(v => v.value), error: Math.max(...result.map(v => v.error)) };
}
