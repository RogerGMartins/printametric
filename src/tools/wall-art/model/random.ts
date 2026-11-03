/** Generator-2 site streams: UTF-8 FNV-1a → Mulberry32; independent of enumeration order. */
import { DesignError } from './budget.ts';

export function siteRandomWords(seed: number, i: number, j: number): readonly [number, number] {
  if (!Number.isInteger(seed) || seed < 1 || seed > 9999 || !Number.isSafeInteger(i) || !Number.isSafeInteger(j)) {
    throw new DesignError('RANDOM_KEY', 'Invalid layout seed or site coordinates.');
  }
  let state = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`wa-g2|layout|${seed}|${i},${j}`)) state = Math.imul(state ^ byte, 0x01000193) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return [next(), next()];
}

export function irregularSite(seed: number, i: number, j: number, pitch: number): readonly [number, number] {
  if (!Number.isFinite(pitch) || pitch < 50 || pitch > 200) throw new DesignError('PARAMETER', 'Cell pitch must be from 50 to 200 mm.', 'pitch');
  const [x, y] = siteRandomWords(seed, i, j);
  return [(i + 0.5 + (x / 2 ** 32 - 0.5) * 0.6) * pitch,
    (j + 0.5 + (y / 2 ** 32 - 0.5) * 0.6) * pitch];
}
