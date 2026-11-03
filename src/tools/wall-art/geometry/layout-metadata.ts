/** Tool-local, handle-free contour and identification data in assembly millimeters. */
import type { XY } from './layouts/cells.ts';

export type BaseContour = {
  id: string; cellKey: string; mapNumber: number; centroid: XY; area: number;
  /** Pinned native-curve encoding for CAD restoration; never accepted from a design file. */
  nativeContour: string;
  /** Native face topology preserves offset-curve vertex tolerances across batches. */
  nativeFace: string;
  paths: string[] | string[][];
  span: { lower: number; upper: number; neck: number | null };
};
export type ExcludedContour = {
  id: string; cellKey: string; centroid: XY; area: number;
  reason: 'area' | 'span' | 'collapsed'; paths: string[] | string[][];
};
