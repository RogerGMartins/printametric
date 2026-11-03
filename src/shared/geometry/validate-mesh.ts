/** Mesh validation is independent of CAD and rendering. No automatic hole repairs. */
import type { Bounds, Mesh, Vector3 } from './types.ts';

export function weldMesh(vertices: number[], triangles: number[]): Mesh {
  const positions: number[] = [], remap: number[] = [], seen = new Map<string, number>();
  // CAD face seams repeat the same float32 positions. Merge exact duplicates only.
  for (let i = 0; i < vertices.length; i += 3) {
    const xyz = vertices.slice(i, i + 3).map(Math.fround), key = xyz.join(',');
    let index = seen.get(key);
    if (index === undefined) { index = positions.length / 3; positions.push(...xyz); seen.set(key, index); }
    remap.push(index);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(triangles.map(i => {
    const mapped = remap[i];
    if (mapped === undefined) throw new Error('Mesh contains an invalid index.');
    return mapped;
  })) };
}

export function validateMesh(mesh: Mesh, triangleCap = 100_000): { bounds: Bounds; volume: number } {
  const { positions: p, indices: ix } = mesh;
  if (!p.length || p.length % 3 || !ix.length || ix.length % 3 || ix.length / 3 > triangleCap ||
      !p.every(Number.isFinite)) throw new Error('Invalid mesh size or coordinates.');
  const min: Vector3 = [Infinity, Infinity, Infinity], max: Vector3 = [-Infinity, -Infinity, -Infinity];
  const edges = new Map<string, { count: number; balance: number }>();
  const adjacent = new Map<number, Set<number>>();
  let volume = 0;
  const point = (i: number): Vector3 => {
    if (!Number.isInteger(i) || i < 0 || i >= p.length / 3) throw new Error('Invalid mesh index.');
    return [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
  };
  for (let i = 0; i < p.length; i += 3) for (const axis of [0, 1, 2] as const) {
    min[axis] = Math.min(min[axis], p[i + axis]!); max[axis] = Math.max(max[axis], p[i + axis]!);
  }
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i]!, b = ix[i + 1]!, c = ix[i + 2]!;
    const A = point(a), B = point(b), C = point(c);
    const u = B.map((v, n) => v - A[n]!), v = C.map((x, n) => x - A[n]!);
    const cross = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    if (Math.hypot(...cross) < 1e-10) throw new Error('Degenerate mesh triangle.');
    volume += (A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    for (const [from, to] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge);
      if (!adjacent.has(from)) adjacent.set(from, new Set());
      adjacent.get(from)!.add(to);
    }
  }
  if ([...edges.values()].some(edge => edge.count !== 2 || edge.balance !== 0)) throw new Error('Mesh is open, non-manifold or inconsistently wound.');
  const visited = new Set<number>(), queue = [ix[0]!];
  while (queue.length) { const next = queue.pop()!; if (visited.has(next)) continue; visited.add(next); queue.push(...adjacent.get(next) ?? []); }
  if (visited.size !== p.length / 3 || volume <= 0) throw new Error('Mesh must be one connected positive-volume component.');
  return { bounds: { min, max }, volume };
}
