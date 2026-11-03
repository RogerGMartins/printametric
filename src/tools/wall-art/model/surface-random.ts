/** Provisional v3 relief stream. Never consumes or changes generator-2 site draws. */
import { DesignError } from './budget.ts';

export type SeededSurfaceFamily = 'dunes' | 'ridges' | 'random';

/** Fixed draw counts: dunes phases 1–3; ridges phase 1; random direction/phase
 * pairs for k=1..6. Returning words keeps fixtures independent of float formatting. */
export function surfaceRandomWords(family: SeededSurfaceFamily, seed: number): readonly number[] {
  if (!['dunes', 'ridges', 'random'].includes(family) || !Number.isInteger(seed) || seed < 1 || seed > 9999) {
    throw new DesignError('RANDOM_KEY', 'Invalid surface family or seed.');
  }
  let state = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`wa-g3|relief|${family}|${seed}`)) state = Math.imul(state ^ byte, 0x01000193) >>> 0;
  const count = family === 'random' ? 12 : family === 'dunes' ? 3 : 1;
  return Object.freeze(Array.from({ length: count }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }));
}
