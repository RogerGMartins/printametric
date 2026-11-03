/** Binary STL over canonical mesh arrays. Coordinates are mm; STL has no unit field. */
import type { Part } from '../geometry/types.ts';

export function serializeSTL(parts: Part[]): Uint8Array<ArrayBuffer> {
  const count = parts.reduce((sum, p) => sum + p.mesh.indices.length / 3, 0);
  if (count > 500_000) throw new Error('STL triangle budget exceeded.');
  const bytes = new Uint8Array(84 + count * 50), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('Printametric assembled model; coordinates in millimeters'));
  view.setUint32(80, count, true);
  let offset = 84;
  for (const { mesh, translation } of parts) for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = [0, 1, 2].map(n => [0, 1, 2].map(axis => mesh.positions[mesh.indices[i + n]! * 3 + axis]! + translation[axis]!));
    const [a, b, c] = points as [number[], number[], number[]];
    const u = b.map((v, n) => v - a[n]!), v = c.map((x, n) => x - a[n]!);
    const normal = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const length = Math.hypot(...normal);
    for (const n of [...normal.map(n => n / length), ...a, ...b, ...c]) { view.setFloat32(offset, n, true); offset += 4; }
    offset += 2;
  }
  return bytes;
}
