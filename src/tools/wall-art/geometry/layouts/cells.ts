/** Pure, bounded lattice enumeration in assembly millimeters. Native clipping follows. */
import type { ParametersV2 } from '../../model/parameters-v2.ts';
import { validateParametersV2, LIMITS_V2 } from '../../model/validation-v2.ts';
import { irregularSite } from '../../model/random.ts';
import { DesignError } from '../../model/budget.ts';

export type XY = [number, number];
export type Cell = { key: string; center: XY } & (
  { kind: 'polygon'; points: XY[] } |
  { kind: 'sector'; inner: number; outer: number; start: number; end: number } |
  { kind: 'disk'; radius: number });

/** Clip a convex polygon by n·(point-origin) <= 0, without coordinate rounding. */
export function halfPlane(points: XY[], normal: XY, origin: XY): XY[] {
  const output: XY[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const da = (a[0] - origin[0]) * normal[0] + (a[1] - origin[1]) * normal[1];
    const db = (b[0] - origin[0]) * normal[0] + (b[1] - origin[1]) * normal[1];
    if (da <= 0) output.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return output;
}

export function voronoiCell(seed: number, pitch: number, i: number, j: number): XY[] {
  const site = irregularSite(seed, i, j, pitch), radius = 0.8 * Math.SQRT2 * pitch;
  let points: XY[] = [[site[0] - radius, site[1] - radius], [site[0] + radius, site[1] - radius],
    [site[0] + radius, site[1] + radius], [site[0] - radius, site[1] + radius]];
  // Every point has a site within R. A cell is inside its site's R disk, so only
  // neighbors within 2R matter. Five tiles away is >=4.4p >2R despite both jitters.
  for (let x = i - 4; x <= i + 4; x++) for (let y = j - 4; y <= j + 4; y++) {
    if (x === i && y === j) continue;
    const other = irregularSite(seed, x, y, pitch), dx = other[0] - site[0], dy = other[1] - site[1];
    if (Math.hypot(dx, dy) > 2 * radius) continue;
    points = halfPlane(points, [dx, dy], [(site[0] + other[0]) / 2, (site[1] + other[1]) / 2]);
  }
  return points;
}

export function enumerateCells(input: unknown): Cell[] {
  const p = validateParametersV2(input), cells: Cell[] = [], pitch = p.pitch;
  let complexity = 0;
  const add = (cell: Cell) => {
    const bounds = cell.kind === 'polygon' ? [Math.min(...cell.points.map(v => v[0])), Math.min(...cell.points.map(v => v[1])),
      Math.max(...cell.points.map(v => v[0])), Math.max(...cell.points.map(v => v[1]))] : null;
    if (bounds && (bounds[2]! < -p.width / 2 || bounds[0]! > p.width / 2 || bounds[3]! < -p.height / 2 || bounds[1]! > p.height / 2)) return;
    complexity += cell.kind === 'polygon' ? cell.points.length : 4;
    if (complexity > LIMITS_V2.contourVertices) throw new DesignError('GENERATION_BUDGET', 'The source cells exceed the contour budget. Increase pitch.', 'pitch');
    cells.push(cell);
  };
  if (p.layout === 'square') {
    const cols = Math.max(1, Math.round(p.width / pitch)), rows = Math.max(1, Math.round(p.height / pitch));
    const dx = p.width / cols, dy = p.height / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -p.width / 2 + c * dx, y = p.height / 2 - (r + 1) * dy;
      add({ kind: 'polygon', key: `s:${r},${c}`, center: [x + dx / 2, y + dy / 2], points: [[x, y], [x + dx, y], [x + dx, y + dy], [x, y + dy]] });
    }
  } else if (p.layout === 'hexagonal') {
    const a = pitch / Math.sqrt(3), extent = Math.ceil(p.height / (3 * a)) + 2;
    for (let r = -extent; r <= extent; r++) {
      const qMin = Math.floor(-p.width / (2 * pitch) - r / 2) - 1, qMax = Math.ceil(p.width / (2 * pitch) - r / 2) + 1;
      for (let q = qMin; q <= qMax; q++) {
        const x = pitch * (q + r / 2), y = 1.5 * a * r;
        add({ kind: 'polygon', key: `h:${q},${r}`, center: [x, y], points: Array.from({ length: 6 }, (_, k) => {
          const angle = (30 + 60 * k) * Math.PI / 180; return [x + a * Math.cos(angle), y + a * Math.sin(angle)];
        }) });
      }
    }
  } else if (p.layout === 'triangular') {
    const dy = Math.sqrt(3) * pitch / 2, extent = Math.ceil(p.height / (2 * dy)) + 2;
    for (let j = -extent; j <= extent; j++) {
      for (let i = Math.floor(-p.width / (2 * pitch) - j / 2) - 2; i <= Math.ceil(p.width / (2 * pitch) - j / 2) + 1; i++) {
        const x = pitch * (i + j / 2), y = dy * j;
        const a: XY = [x, y], b: XY = [x + pitch, y], c: XY = [x + pitch / 2, y + dy], d: XY = [x + 1.5 * pitch, y + dy];
        for (const [parity, points] of [[0, [a, b, c]], [1, [b, d, c]]] as const) {
          add({ kind: 'polygon', key: `t:${i},${j},${parity}`, center: [points.reduce((s, v) => s + v[0], 0) / 3, points.reduce((s, v) => s + v[1], 0) / 3], points: [...points] });
        }
      }
    }
  } else if (p.layout === 'irregular') {
    for (let i = Math.floor(-p.width / (2 * pitch)) - 1; i <= Math.floor(p.width / (2 * pitch)) + 1; i++) {
      for (let j = Math.floor(-p.height / (2 * pitch)) - 1; j <= Math.floor(p.height / (2 * pitch)) + 1; j++) {
        add({ kind: 'polygon', key: `v:${i},${j}`, center: [...irregularSite(p.seed, i, j, pitch)], points: voronoiCell(p.seed, pitch, i, j) });
      }
    }
  } else {
    add({ kind: 'disk', key: 'd:center', center: [0, 0], radius: pitch / 2 });
    const extent = Math.hypot(p.width / 2, p.height / 2);
    // Ring 1 starts at the central disk. The final ring covers the furthest corner.
    for (let ring = 1, inner = pitch / 2; inner < extent; ring++, inner += pitch) {
      const outer = inner + pitch, n = Math.max(3, Math.round(2 * Math.PI * (inner + pitch / 2) / pitch));
      for (let sector = 0; sector < n; sector++) {
        const start = 2 * Math.PI * sector / n, end = 2 * Math.PI * (sector + 1) / n;
        const radius = 4 * Math.sin((end - start) / 2) * (outer ** 3 - inner ** 3) / (3 * (end - start) * (outer ** 2 - inner ** 2));
        add({ kind: 'sector', key: `d:${ring},${sector}`, center: [radius * Math.cos((start + end) / 2), radius * Math.sin((start + end) / 2)], inner, outer, start, end });
      }
    }
  }
  return cells;
}

export function usesWholeCells(p: ParametersV2): boolean {
  return p.outline === 'rectangle' && (p.layout === 'hexagonal' || p.layout === 'triangular') && !p.straightBoundary;
}
