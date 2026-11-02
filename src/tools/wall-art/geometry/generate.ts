/** Deterministic generator 1. Local origins are base centroids; assembly +Z is front. */
import { drawRectangle, makeBox, measureShapeVolumeProperties, cast, Sketch, type Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import { validateSolid } from '../../../shared/geometry/kernel.ts';
import { validateMesh, weldMesh } from '../../../shared/geometry/validate-mesh.ts';
import type { ModelResult, Part } from '../../../shared/geometry/types.ts';
import { validateParameters } from '../model/validation.ts';
import { estimateDesign, LIMITS, DesignError } from '../model/budget.ts';
import { parameterDigest, type Parameters } from '../model/parameters.ts';

export interface CanonicalModel { result: ModelResult; parameters: Parameters; solids: Shape3D[]; dispose(): void }

export function generateModel(input: unknown, revision: number, kernel: Kernel, partCap = LIMITS.parts): CanonicalModel {
  const p = validateParameters(input, partCap), e = estimateDesign(p, partCap);
  const started = performance.now(), solids: Shape3D[] = [], parts: Part[] = [];
  let meshBytes = 0, triangles = 0;
  try {
    for (let row = 0; row < e.rows; row++) for (let column = 0; column < e.columns; column++) {
      // Every v1 cell is identical. Clone the validated prototype instead of repeating
      // expensive loft/boolean construction; each part still owns a solid wrapper.
      const prototype = solids[0];
      let solid: Shape3D = prototype ? prototype.clone() : makeBox([-e.baseWidth / 2, -e.length / 2, 0], [e.baseWidth / 2, e.length / 2, p.baseThickness]);
      try {
        if (!prototype && p.reliefHeight > 0) {
          const lower = drawRectangle(e.baseWidth, e.length).sketchOnPlane('XY', p.baseThickness);
          const upper = drawRectangle(e.topWidth, e.length).sketchOnPlane('XY', e.depth);
          if (!(lower instanceof Sketch) || !(upper instanceof Sketch)) throw new Error('Expected simple rectangular sketches.');
          const loft = new kernel.BRepOffsetAPI_ThruSections(true, true, LIMITS.cadTolerance);
          try {
            loft.AddWire(lower.wire.wrapped); loft.AddWire(upper.wire.wrapped); loft.Build();
            const relief = loft.Shape();
            try {
              const fusion = new kernel.BRepAlgoAPI_Fuse(solid.wrapped, relief);
              try {
                fusion.Build(); fusion.SimplifyResult(true, true, LIMITS.cadTolerance);
                const raw = fusion.Shape();
                try { const fused = cast(raw) as Shape3D; solid.delete(); solid = fused; }
                finally { raw.delete(); }
              } finally { fusion.delete(); }
            } finally { relief.delete(); }
          } finally { loft.delete(); lower.delete(); upper.delete(); }
        }
        const prototypePart = parts[0];
        let volume: number;
        if (prototypePart) volume = prototypePart.volume;
        else {
          validateSolid(kernel, solid);
          const properties = measureShapeVolumeProperties(solid);
          try { volume = properties.volume; } finally { properties.delete(); }
        }
        if (!Number.isFinite(volume) || Math.abs(volume - e.volume) > Math.max(0.001, e.volume * 1e-6)) throw new Error('CAD volume differs from the blade construction.');
        // Clones share the exact native shape, so one tessellation is authoritative.
        // Distinct arrays keep transfer ownership explicit for every returned part.
        const raw = prototypePart ? null : solid.mesh({ tolerance: LIMITS.chordTolerance, angularTolerance: LIMITS.angleRadians });
        const mesh = prototypePart ? { positions: prototypePart.mesh.positions.slice(), indices: prototypePart.mesh.indices.slice() } : weldMesh(raw!.vertices, raw!.triangles);
        const checked = validateMesh(mesh);
        const expectedMin = [-e.baseWidth / 2, -e.length / 2, 0], expectedMax = [e.baseWidth / 2, e.length / 2, e.depth];
        if (checked.bounds.min.some((n, i) => Math.abs(n - expectedMin[i]!) > 0.001) ||
            checked.bounds.max.some((n, i) => Math.abs(n - expectedMax[i]!) > 0.001) || Math.abs(checked.volume - volume) / volume > 0.001) throw new Error('Mesh differs from the canonical CAD solid.');
        triangles += mesh.indices.length / 3; meshBytes += mesh.positions.byteLength + mesh.indices.byteLength;
        const wasmBytes = kernel.wasmMemory.buffer.byteLength;
        // Reserve two canonical results, UI copies and a worst-case binary export buffer.
        if (triangles > LIMITS.triangles || wasmBytes + meshBytes * 4 + triangles * 100 > LIMITS.memoryBytes) throw new DesignError('MEMORY_BUDGET', 'The generated model exceeds the geometry memory budget. Increase pitch.');
        parts.push({ id: `wa-g1-r${row}-c${column}`, mapNumber: parts.length + 1,
          translation: [-p.width / 2 + (column + 0.5) * e.cellWidth, p.height / 2 - (row + 0.5) * e.cellLength, 0],
          bounds: checked.bounds, volume, mesh });
        solids.push(solid);
      } catch (error) { solid.delete(); throw error; }
    }
    let disposed = false;
    return { parameters: p, solids,
      result: { revision, digest: parameterDigest(p), units: 'mm', parts,
        bounds: { min: [-(p.width - p.gap) / 2, -(p.height - p.gap) / 2, 0], max: [(p.width - p.gap) / 2, (p.height - p.gap) / 2, e.depth] },
        diagnostics: p.reliefHeight === 0 ? ['Top width ratio has no effect when relief height is zero.'] : [],
        budget: { triangles, meshBytes, wasmBytes: kernel.wasmMemory.buffer.byteLength, elapsedMs: performance.now() - started } },
      dispose() { if (!disposed) { disposed = true; solids.forEach(solid => solid.delete()); } },
    };
  } catch (error) { solids.forEach(solid => solid.delete()); throw error; }
}
