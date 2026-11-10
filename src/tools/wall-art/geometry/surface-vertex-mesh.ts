/** Incident faces use their actual CAD vertex at edge-polygon endpoints. This
 * resolves exact Float32 seams without spatial welding or repairing holes. */
import type { Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';

export type SurfaceMeshOptions = { tolerance: number; angularTolerance: number };
export function meshWithNativeVertices(kernel: Kernel, solid: Shape3D, { tolerance, angularTolerance }: SurfaceMeshOptions) {
  kernel.ReplicadMeshExtractor.mesh(solid.wrapped, tolerance, angularTolerance);
  const vertices: number[] = [], triangles: number[] = [], faces = solid.faces;
  let vertexUses = 0, maximumVertexAdjustmentMm = 0;
  try {
    for (const face of faces) {
      const location = new kernel.TopLoc_Location(), edges = face.edges;
      let triangulation, transform;
      try {
        triangulation = kernel.BRep_Tool.Triangulation(face.wrapped, location, 0);
        const triangleCount = triangles.length / 3 + triangulation.NbTriangles(), nodeCount = vertices.length / 3 + triangulation.NbNodes();
        if (triangleCount > 100_000 || nodeCount > 300_000) throw Error(`Native vertex mesh exceeds its triangle/node budget: ${triangleCount} triangles, ${nodeCount} nodes.`);
        transform = location.Transformation();
        const endpoints = new Map<number, number[]>();
        for (const edge of edges) {
          let polygon; const nativeVertices: { parameter: number; xyz: number[] }[] = [];
          try {
            polygon = kernel.BRep_Tool.PolygonOnTriangulation(edge.wrapped, triangulation, location);
            if (!polygon || !polygon.HasParameters() || kernel.BRep_Tool.Degenerated(edge.wrapped)) continue;
            const explorer = new kernel.TopExp_Explorer(edge.wrapped, kernel.TopAbs_ShapeEnum.TopAbs_VERTEX, kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
            try {
              while (explorer.More()) {
                const raw = explorer.Current(), vertex = kernel.TopoDS.Vertex(raw); let point;
                try { point = kernel.BRep_Tool.Pnt(vertex); nativeVertices.push({ parameter: kernel.BRep_Tool.Parameter(vertex, edge.wrapped), xyz: [point.X(), point.Y(), point.Z()] }); }
                finally { point?.delete(); vertex.delete(); raw.delete(); }
                explorer.Next();
              }
            } finally { explorer.delete(); }
            for (const i of [1, polygon.NbNodes()]) {
              if (++vertexUses > 100_000) throw Error('Native vertex mapping exceeds its work budget.');
              const parameter = polygon.Parameter(i), matching = nativeVertices.find(v => Math.abs(v.parameter - parameter) <= 1e-10 * Math.max(1, Math.abs(parameter)));
              if (!matching) throw Error('Native polygon endpoint has no matching CAD vertex parameter.');
              const node = polygon.Node(i), previous = endpoints.get(node);
              if (previous && previous.some((v, axis) => v !== matching.xyz[axis])) throw Error('One mesh node maps to inconsistent CAD vertices.');
              endpoints.set(node, matching.xyz);
            }
          } finally { polygon?.delete(); }
        }
        const offset = vertices.length / 3;
        for (let i = 1; i <= triangulation.NbNodes(); i++) {
          const point = triangulation.Node(i);
          try {
            point.Transform(transform); const before = [point.X(), point.Y(), point.Z()], canonical = endpoints.get(i) ?? before;
            const adjustment = Math.hypot(...before.map((v, axis) => v - canonical[axis]!));
            if (!Number.isFinite(adjustment) || adjustment > 1e-7) throw Error('Native vertex adjustment exceeds 0.0000001 mm.');
            maximumVertexAdjustmentMm = Math.max(maximumVertexAdjustmentMm, adjustment);
            vertices.push(...canonical.map(Math.fround));
          } finally { point.delete(); }
        }
        const reversed = face.wrapped.Orientation() === kernel.TopAbs_Orientation.TopAbs_REVERSED;
        for (let i = 1; i <= triangulation.NbTriangles(); i++) {
          const triangle = triangulation.Triangle(i);
          try { const a = offset + triangle.Value(1) - 1, b = offset + triangle.Value(2) - 1, c = offset + triangle.Value(3) - 1; triangles.push(a, reversed ? c : b, reversed ? b : c); }
          finally { triangle.delete(); }
        }
      } finally { transform?.delete(); triangulation?.delete(); edges.forEach(edge => edge.delete()); location.delete(); }
    }
    return { vertices, triangles, maximumVertexAdjustmentMm, vertexUses };
  } finally { faces.forEach(face => face.delete()); }
}
