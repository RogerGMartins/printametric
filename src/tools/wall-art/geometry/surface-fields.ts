/** Pure provisional P0 fields in centered assembly millimeters. No per-cell draws.
 * Native sampling/construction must separately prove approximation and material bounds. */
import { DesignError } from '../model/budget.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import { surfaceRandomWords } from '../model/surface-random.ts';
import { spiralCenterWeight, validateSpiralCenter, type SpiralCenter } from './spiral-center.ts';

export interface SurfaceField {
  readonly referenceLength: number;
  /** Underlying normalized field, independent of amplitude, blend and layout. */
  evaluate(x: number, y: number): number;
}

export function createSurfaceField(input: unknown, spiralCenter: SpiralCenter = 'linear'): SurfaceField {
  validateSpiralCenter(spiralCenter);
  const p = validateParametersV3(input), referenceLength = Math.min(p.width, p.height);
  const radial = p.family === 'ring' || p.family === 'dome';
  const angle = radial ? 0 : (p.rotation % 360) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle), phase = p.phase % 1, d = p.density;
  const q = p.family === 'dunes' || p.family === 'ridges' || p.family === 'random'
    ? surfaceRandomWords(p.family, p.surfaceSeed).map(word => word / 2 ** 32) : [];
  const tau = 2 * Math.PI, wave = (v: number) => Math.sin(tau * v);
  const harmonics = p.family === 'random' ? Array.from({ length: 6 }, (_, i) => {
    const k = i + 1, angle = tau * q[2 * i]!, frequency = d * (0.5 + k / 6);
    return { weight: 1 / k, x: frequency * Math.cos(angle), y: frequency * Math.sin(angle), phase: q[2 * i + 1]! };
  }) : [];
  const weight = harmonics.reduce((sum, h) => sum + h.weight, 0);
  return Object.freeze({ referenceLength, evaluate(x: number, y: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new DesignError('SURFACE_FIELD', 'Surface coordinates must be finite millimeters.');
    const u = x / referenceLength, v = y / referenceLength;
    const a = cos * u + sin * v, b = -sin * u + cos * v, r = 2 * Math.hypot(a, b);
    if (![a, b, r, r * r].every(Number.isFinite)) throw new DesignError('SURFACE_FIELD', 'Surface coordinate arithmetic overflowed.');
    let result: number;
    switch (p.family) {
      case 'wave': result = (1 + wave(d * a + phase)) / 2; break;
      case 'dunes': result = (1 + (wave(d * a + phase + q[0]!) + 0.5 * wave(0.7 * d * b - phase + q[1]!) +
        0.25 * wave(0.6 * d * (a + b) + q[2]!)) / 1.75) / 2; break;
      case 'ring': result = (1 - Math.cos(tau * d * r)) / 2; break;
      case 'dome': result = Math.max(0, 1 - r * r); break;
      case 'spiral': {
        const theta = r === 0 ? 0 : Math.atan2(b, a);
        // Linear remains the default. Smoother alternatives are checkpoint-only;
        // they must not silently change the versioned field or saved parameters.
        result = 0.5 + 0.5 * spiralCenterWeight(r, spiralCenter) * Math.cos(p.spiralArms * theta - tau * d * r + tau * phase);
        break;
      }
      case 'ridges': {
        const value = d * a + 0.2 * wave(d * b + q[0]!) + phase;
        result = 1 - Math.abs(2 * (value - Math.floor(value)) - 1); break;
      }
      case 'random': result = 0.5 + harmonics.reduce((sum, h) => sum + h.weight * wave(h.x * a + h.y * b + phase + h.phase), 0) / (2 * weight); break;
    }
    if (!Number.isFinite(result)) throw new DesignError('SURFACE_FIELD', 'Surface evaluation was nonfinite.');
    // Only floating-point roundoff at the analytic [0,1] boundary is clamped.
    if (result < -1e-12 || result > 1 + 1e-12) throw new DesignError('SURFACE_FIELD', 'Surface evaluation exceeded its normalized bounds.');
    return Math.max(0, Math.min(1, result));
  } });
}
