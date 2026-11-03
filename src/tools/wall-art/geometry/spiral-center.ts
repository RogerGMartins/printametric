/** Checkpoint-only comparison, not a saved parameter or an approved field change.
 * The quintic candidate has zero first/second derivatives at both radial ends.
 * Its O(r^3) amplitude makes the angular field C2 at the origin for fixed arms. */
import { DesignError } from '../model/budget.ts';

export type SpiralCenter = 'linear' | 'smooth-c1' | 'smooth-c2';
export function validateSpiralCenter(value: unknown): asserts value is SpiralCenter {
  if (value !== 'linear' && value !== 'smooth-c1' && value !== 'smooth-c2') throw new DesignError('SURFACE_FIELD', 'Unknown Spiral-center experiment.');
}
export function spiralCenterWeight(radius: number, mode: SpiralCenter): number {
  const t = Math.min(1, radius / .02);
  return mode === 'linear' ? t : mode === 'smooth-c1' ? t * t * (3 - 2 * t) : t * t * t * (10 + t * (-15 + 6 * t));
}
