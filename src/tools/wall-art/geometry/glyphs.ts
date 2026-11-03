/** Original seven-segment polygons. Coordinates describe the readable underside view. */
export type GlyphPoint = readonly [number, number];
const rectangle = (x: number, y: number, width: number, height: number): readonly GlyphPoint[] =>
  [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];

// Bars overlap at their joints. Union them before cutting; never export overlapping tools.
export const SEGMENTS: readonly (readonly GlyphPoint[])[] = [
  rectangle(0, 8.4, 6, 1.6), rectangle(4.4, 5, 1.6, 4.2),
  rectangle(4.4, 0.8, 1.6, 4.2), rectangle(0, 0, 6, 1.6),
  rectangle(0, 0.8, 1.6, 4.2), rectangle(0, 5, 1.6, 4.2),
  rectangle(0, 4.2, 6, 1.6),
];
// Segment order: top, upper-right, lower-right, bottom, lower-left, upper-left, middle.
export const DIGIT_MASKS = [0b0111111, 0b0000110, 0b1011011, 0b1001111, 0b1100110,
  0b1101101, 0b1111101, 0b0000111, 0b1111111, 0b1101111] as const;
export const GLYPH_HEIGHT = 10, GLYPH_WIDTH = 6, GLYPH_ADVANCE = 7;
export const MINIMUM_GLYPH_HEIGHT = 5;

/** Assembly-space +Y arrow: 4×5 mm, 0.8 mm shaft. Text alone flips through X. */
export const ORIENTATION_ARROW: readonly GlyphPoint[] = [
  [-0.4, 0], [0.4, 0], [0.4, 2.5], [2, 2.5], [0, 5], [-2, 2.5], [-0.4, 2.5],
];

export function digitPolygons(digit: number): readonly (readonly GlyphPoint[])[] {
  const mask = DIGIT_MASKS[digit];
  if (!Number.isInteger(digit) || mask === undefined) throw new Error('Expected one decimal digit.');
  return SEGMENTS.filter((_, index) => mask & (1 << index));
}
