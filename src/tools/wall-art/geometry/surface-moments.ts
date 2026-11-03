/** Checkpoint-only bounded rectangular moments for harmonic/radial fields. Coordinates are
 * assembly millimeters; normalized u/v span [-1,1] about the rectangle center.
 * Nonrectangular footprints need a separately bounded domain integrator.
 * No field is approximated by vertex averages. */
import { DesignError } from '../model/budget.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import { surfaceRandomWords } from '../model/surface-random.ts';
import { domeRectangleMoments } from './surface-dome-moments.ts';
import { ringRectangleMoments } from './surface-ring-moments.ts';
import { ridgeRectangleMoments } from './surface-ridge-moments.ts';
import { spiralRectangleMoments } from './surface-spiral-moments.ts';
import { validateSpiralCenter, type SpiralCenter } from './spiral-center.ts';

export interface MomentRectangle { minX: number; maxX: number; minY: number; maxY: number }
export interface RectangleMoments {
  readonly mean: number;
  readonly uMean: number;
  readonly vMean: number;
  /** Floating evaluation allowance, not a formal proof of platform libm accuracy. */
  readonly error: number;
}

export function validateMomentRectangle(box: MomentRectangle): void {
  if (![box.minX, box.maxX, box.minY, box.maxY].every(x => Number.isFinite(x) && Math.abs(x) <= 4000) ||
    box.maxX <= box.minX || box.maxY <= box.minY) {
    throw new DesignError('SURFACE_DOMAIN', 'Expected a bounded positive-area rectangle in assembly millimeters.');
  }
}

function sinc(x: number): number {
  if (Math.abs(x) > .01) return Math.sin(x) / x;
  const t = x * x;
  return 1 - t / 6 + t * t / 120 - t ** 3 / 5040 + t ** 4 / 362880;
}
function firstMoment(x: number): number {
  if (Math.abs(x) > .01) return (Math.sin(x) - x * Math.cos(x)) / (x * x);
  const t = x * x;
  return x * (1 / 3 - t / 30 + t * t / 840 - t ** 3 / 45360 + t ** 4 / 3991680);
}

export function rectangleSurfaceMoments(input: unknown, box: MomentRectangle, spiralCenter: SpiralCenter = 'linear'): RectangleMoments {
  const p = validateParametersV3(input); validateMomentRectangle(box); validateSpiralCenter(spiralCenter);
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const hx = (box.maxX - box.minX) / 2, hy = (box.maxY - box.minY) / 2;
  const length = Math.min(p.width, p.height), angle = (p.rotation % 360) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), tau = 2 * Math.PI, phase = p.phase % 1;
  let mean = .5, uMean = 0, vMean = 0;
  // Each term is in the same rotated physical field coordinates as surface-fields.
  const add = (fa: number, fb: number, offset: number, amplitude: number) => {
    const kx = tau * (fa * c - fb * s) / length, ky = tau * (fa * s + fb * c) / length;
    const theta = kx * cx + ky * cy + tau * offset, ax = kx * hx, ay = ky * hy;
    mean += amplitude * Math.sin(theta) * sinc(ax) * sinc(ay);
    uMean += amplitude * Math.cos(theta) * firstMoment(ax) * sinc(ay);
    vMean += amplitude * Math.cos(theta) * sinc(ax) * firstMoment(ay);
  };
  switch (p.family) {
    case 'ring': return ringRectangleMoments(box, length, p.density, p.depth);
    case 'ridges': return ridgeRectangleMoments(p, box);
    case 'spiral': return spiralRectangleMoments(p, box, spiralCenter);
    case 'wave': add(p.density, 0, phase, .5); break;
    case 'dunes': {
      const q = surfaceRandomWords('dunes', p.surfaceSeed).map(x => x / 2 ** 32);
      add(p.density, 0, phase + q[0]!, 1 / 3.5);
      add(0, .7 * p.density, -phase + q[1]!, .5 / 3.5);
      add(.6 * p.density, .6 * p.density, q[2]!, .25 / 3.5); break;
    }
    case 'random': {
      const q = surfaceRandomWords('random', p.surfaceSeed).map(x => x / 2 ** 32);
      const weights = Array.from({ length: 6 }, (_, i) => 1 / (i + 1));
      const total = weights.reduce((sum, value) => sum + value, 0);
      for (let i = 0; i < 6; i++) {
        const a = tau * q[2 * i]!, frequency = p.density * (.5 + (i + 1) / 6);
        add(frequency * Math.cos(a), frequency * Math.sin(a), phase + q[2 * i + 1]!, weights[i]! / (2 * total));
      }
      break;
    }
    case 'dome': {
      const far = Math.max(box.minX ** 2, box.maxX ** 2) + Math.max(box.minY ** 2, box.maxY ** 2);
      const nearest = (box.minX > 0 ? box.minX : box.maxX < 0 ? box.maxX : 0) ** 2 +
        (box.minY > 0 ? box.minY : box.maxY < 0 ? box.maxY : 0) ** 2;
      if (nearest >= length * length / 4) return { mean: 0, uMean: 0, vMean: 0, error: 0 };
      if (far > length * length / 4) {
        const result = domeRectangleMoments(box, length / 2);
        if (result.error > Math.min(.001, .00025 / Math.max(p.depth, 1))) {
          throw new DesignError('SURFACE_DOMAIN_ERROR', 'Dome integral error exceeds the height allocation.');
        }
        return result;
      }
      mean = 1 - 4 * (cx * cx + cy * cy + (hx * hx + hy * hy) / 3) / (length * length);
      uMean = -8 * cx * hx / (3 * length * length); vMean = -8 * cy * hy / (3 * length * length); break;
    }
    default: throw new DesignError('SURFACE_DOMAIN', 'This field needs boundary-aware integration, not rectangular harmonic moments.');
  }
  const error = 32768 * Number.EPSILON;
  if (![mean, uMean, vMean].every(Number.isFinite) || mean < -error || mean > 1 + error) {
    throw new DesignError('SURFACE_FIELD', 'Analytic surface moments exceeded their bounds.');
  }
  return Object.freeze({ mean, uMean, vMean, error });
}

/** Exact centered-rectangle least squares, constrained at all four corners. A
 * plane attains its extrema there, so this checks the complete domain. Enumerate
 * the at-most-three active constraints of this three-variable convex problem. */
export function fitRectanglePlane(moments: RectangleMoments): readonly [number, number, number] {
  if (![moments.mean, moments.uMean, moments.vMean, moments.error].every(Number.isFinite) || moments.error < 0 ||
    moments.mean < 0 || moments.mean > 1) throw new DesignError('SURFACE_FIT', 'Invalid normalized field moments.');
  const target = [moments.mean, 3 * moments.uMean, 3 * moments.vMean], inverse = [1, 3, 3];
  const constraints = [-1, 1].flatMap(u => [-1, 1].flatMap(v => [{ a: [1, u, v], b: 1 }, { a: [-1, -u, -v], b: 0 }]));
  let best: number[] | undefined, cost = Infinity;
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);
  function solve(active: number[]): void {
    const rows = active.map(i => constraints[i]!);
    const matrix = rows.map(row => [...rows.map(other => dot(row.a.map((x, i) => x * inverse[i]!), other.a)), dot(row.a, target) - row.b]);
    for (let i = 0; i < rows.length; i++) {
      let pivot = i;
      for (let j = i + 1; j < rows.length; j++) if (Math.abs(matrix[j]![i]!) > Math.abs(matrix[pivot]![i]!)) pivot = j;
      [matrix[i], matrix[pivot]] = [matrix[pivot]!, matrix[i]!];
      const value = matrix[i]![i]!; if (Math.abs(value) < 1e-12) return;
      for (let k = i; k <= rows.length; k++) matrix[i]![k] = matrix[i]![k]! / value;
      for (let j = 0; j < rows.length; j++) if (j !== i) {
        const factor = matrix[j]![i]!;
        for (let k = i; k <= rows.length; k++) matrix[j]![k] = matrix[j]![k]! - factor * matrix[i]![k]!;
      }
    }
    const result = target.map((x, i) => x - inverse[i]! * rows.reduce((sum, row, j) => sum + row.a[i]! * matrix[j]![rows.length]!, 0));
    if (constraints.some(row => dot(row.a, result) > row.b + 1e-13)) return;
    const objective = result.reduce((sum, x, i) => sum + (x - target[i]!) ** 2 / inverse[i]!, 0);
    if (objective < cost) { cost = objective; best = result; }
  }
  solve([]);
  for (let a = 0; a < constraints.length; a++) {
    solve([a]);
    for (let b = a + 1; b < constraints.length; b++) {
      solve([a, b]);
      for (let c = b + 1; c < constraints.length; c++) solve([a, b, c]);
    }
  }
  if (!best) throw new DesignError('SURFACE_FIT', 'No bounded planar fit was found.');
  return Object.freeze([best[0]!, best[1]!, best[2]!] as const);
}
