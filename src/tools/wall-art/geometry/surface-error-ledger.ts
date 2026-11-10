/** Conditional engineering bound: exact kernel consistency and stored tolerances
 * are not a formal distance proof for Boolean/trim operations. Units are mm. */
import type { Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';

export interface SurfaceErrorCandidate {
  solid: Shape3D; physicalHeightErrorMm?: number; profilePositionErrorMm?: number;
  maximumContourApproximationMm?: number; maximumBoundaryReductionMm?: number;
}
export function surfaceErrorLedger(kernel: Kernel, candidate: SurfaceErrorCandidate, ratio: number) {
  const analytic = candidate.physicalHeightErrorMm ?? 0, profile = candidate.profilePositionErrorMm ?? 0;
  const contour = (candidate.maximumContourApproximationMm ?? 0) / ratio, boundary = (candidate.maximumBoundaryReductionMm ?? 0) / ratio;
  if (![ratio, analytic, profile, contour, boundary].every(Number.isFinite) || ratio < .1 || ratio > 1 || Math.min(analytic, profile, contour, boundary) < 0) throw Error('Invalid construction-error accounting.');
  const analyzer = new kernel.BRepCheck_Analyzer(candidate.solid.wrapped, true);
  let tolerance = 0;
  try {
    analyzer.SetExactMethod(true);
    if (!analyzer.IsValid()) throw Error('Exact native edge/surface consistency check failed.');
    for (const type of ['FACE', 'EDGE', 'VERTEX'] as const) {
      const explorer = new kernel.TopExp_Explorer(candidate.solid.wrapped, kernel.TopAbs_ShapeEnum[`TopAbs_${type}`], kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
      try {
        while (explorer.More()) {
          const raw = explorer.Current();
          const typed = type === 'FACE' ? kernel.TopoDS.Face(raw) : type === 'EDGE' ? kernel.TopoDS.Edge(raw) : kernel.TopoDS.Vertex(raw);
          try { tolerance = Math.max(tolerance, kernel.BRep_Tool.Tolerance(typed)); }
          finally { typed.delete(); raw.delete(); }
          explorer.Next();
        }
      } finally { explorer.delete(); }
    }
  } finally { analyzer.delete(); }
  const approximation = analytic + profile + contour + boundary, conditionalTotal = approximation + tolerance;
  if (!Number.isFinite(tolerance) || conditionalTotal > .001) throw Error(`Native construction allowance exceeded: ${conditionalTotal} mm.`);
  return { analyticHeightMm: analytic, profilePositionMm: profile, contourPositionMm: contour,
    amplifiedBoundaryMm: boundary, approximationMm: approximation, storedNativeToleranceMm: tolerance,
    conditionalTotalMm: conditionalTotal, limitMm: .001, kernelConsistency: 'exact-method', formalKernelErrorProof: false };
}
