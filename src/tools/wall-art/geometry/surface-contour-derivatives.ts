/** Real rational-Bezier helpers for bounded nonsmooth-field boundary integrals.
 * Callers validate degree, positive weights, coordinates and aggregate work. */
export type ContourPoint = readonly [number, number, number];
const magnitude = (values: readonly number[]) => Math.max(...values.map(Math.abs));
const difference = (values: readonly number[]): number[] => values.length === 1 ? [0] : values.slice(1).map((x, i) => (values.length - 1) * (x - values[i]!));
export function contourPointAt(points: readonly ContourPoint[], t: number): ContourPoint {
  let row = points;
  while (row.length > 1) row = row.slice(1).map((p, i) => p.map((v, j) => row[i]![j]! * (1 - t) + v * t) as unknown as ContourPoint);
  return row[0]!;
}
export function splitContour(points: readonly ContourPoint[]): [ContourPoint[], ContourPoint[]] {
  let row = points; const left = [row[0]!], right = [row.at(-1)!];
  while (row.length > 1) {
    row = row.slice(1).map((p, i) => p.map((v, j) => (v + row[i]![j]!) / 2) as unknown as ContourPoint);
    left.push(row[0]!); right.unshift(row.at(-1)!);
  }
  return [left, right];
}
/** Bounds derivatives through order 3 on the full real interval. The quotient
 * recurrence follows P=W*C, with positive Bernstein weights bounding W below. */
export function contourDerivativeBounds(points: readonly ContourPoint[], axis: 0 | 1): number[] {
  let numerator = points.map(p => p[axis]), weights = points.map(p => p[2]);
  const lower = Math.min(...weights), value = magnitude(points.map(p => p[axis] / p[2]));
  const result = [value], wd = [magnitude(weights)];
  for (let order = 1; order <= 3; order++) {
    numerator = difference(numerator); weights = difference(weights); wd.push(magnitude(weights));
    const correction = order === 1 ? wd[1]! * result[0]! : order === 2
      ? 2 * wd[1]! * result[1]! + wd[2]! * result[0]!
      : 3 * wd[1]! * result[2]! + 3 * wd[2]! * result[1]! + wd[3]! * result[0]!;
    result.push((magnitude(numerator) + correction) / lower);
  }
  return result;
}
