/** Checkpoint-only rectangular native surface experiment.
 * Shared control nets make all top/flank boundaries identical. This is NOT the
 * clipped-footprint generator or a certified continuous-field approximation.
 * The caller owns the returned solid; every intermediate native object is freed.
 */
import { cast, makePolygon } from 'replicad';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';

/** Reject known approximation failures before the potentially expensive mesher.
 * Passing these samples is necessary, not a global error certificate. */
export function meshRectangleSurface(candidate, progress = () => {}) {
  for (const deviation of [candidate.maximumSampledTopDeviationMm, candidate.maximumSampledScaleDeviationMm]) {
    if (!Number.isFinite(deviation) || deviation < 0 || deviation > .00025) {
      throw Error('Off-grid sampled deviation exceeds the proposed 0.00025 mm component allocation.');
    }
  }
  progress('meshing');
  const mesh = candidate.solid.mesh({ tolerance: .005, angularTolerance: Math.PI / 36 });
  if (mesh.triangles.length / 3 > 100_000) throw Error('Per-part triangle budget exceeded.');
  return mesh;
}

export function buildRectangleSurface(kernel, { width, ratio, concavity, height, count = 33, progress = () => {} }) {
  if (![width, ratio, concavity].every(Number.isFinite) || width <= 0 || width > 2000 || ratio < .1 || ratio > 1 || concavity < 1 || concavity > 4) {
    throw Error('Invalid rectangular capability fixture dimensions or shape.');
  }
  if (typeof height !== 'function') throw Error('A finite height function is required.');
  if (!Number.isInteger(count) || count < 4 || count > 65) throw Error('Probe grid must contain 4–65 samples per axis.');
  const resources = [], faces = [], half = width / 2, topHalf = half * ratio;
  const own = object => { resources.push(object); return object; };
  let poles = 0;
  const face = spline => {
    poles += spline.NbUPoles() * spline.NbVPoles();
    if (poles > 4096) throw Error('Per-part 4096 spline-control-point budget exhausted.');
    const maker = own(new kernel.BRepBuilderAPI_MakeFace(spline, .000001));
    if (!maker.IsDone()) throw Error('Spline face construction failed.');
    faces.push(own(cast(own(maker.Face()))));
  };
  const gridSurface = (n, m, x0, dx, y0, dy, evaluate, interpolate = false) => {
    // Interpolation has a finite grid-driven net. This bounds fitting work;
    // separate deviation checks must precede meshing a poorly fitted center.
    if (interpolate && (n + 2) * (m + 2) > 4096) throw Error('Top grid alone exceeds the spline-control-point budget.');
    const values = own(new kernel.NCollection_Array2_double(1, n, 1, m));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      const value = evaluate(x0 + (i - 1) * dx, y0 + (j - 1) * dy);
      if (!Number.isFinite(value)) throw Error('Non-finite sampled height.');
      values.SetValue(i, j, value);
    }
    const fit = own(interpolate ? new kernel.GeomAPI_PointsToBSplineSurface()
      : new kernel.GeomAPI_PointsToBSplineSurface(values, x0, dx, y0, dy, 3, 8, kernel.GeomAbs_Shape.GeomAbs_C2, .000001));
    if (interpolate) fit.Interpolate(values, x0, dx, y0, dy);
    if (!fit.IsDone()) throw Error('Native scalar spline fitting failed.');
    return own(fit.Surface());
  };
  const knots = (spline, axis) => {
    const length = axis === 'U' ? spline.NbUKnots() : spline.NbVKnots();
    const values = own(new kernel.NCollection_Array1_double(1, length));
    const multiplicities = own(new kernel.NCollection_Array1_int(1, length));
    for (let i = 1; i <= length; i++) {
      values.SetValue(i, axis === 'U' ? spline.UKnot(i) : spline.VKnot(i));
      multiplicities.SetValue(i, axis === 'U' ? spline.UMultiplicity(i) : spline.VMultiplicity(i));
    }
    return { values, multiplicities, degree: axis === 'U' ? spline.UDegree() : spline.VDegree() };
  };
  let solid;
  try {
    const top = gridSurface(count, count, -topHalf, 2 * topHalf / (count - 1), -topHalf, 2 * topHalf / (count - 1), height, true);
    progress('top-interpolated');
    face(top);
    // Z stores scale(t); X stores the exact t coefficient. The same vertical
    // spline is used by every flank, including their corner boundary curves.
    const scale = gridSurface(count, 4, 0, 1 / (count - 1), 0, 1 / 3,
      t => ratio + (1 - ratio) * (1 - t) ** concavity);
    progress('scale-fitted');
    const vertical = knots(scale, 'U');
    for (let edge = 0; edge < 4; edge++) {
      const alongU = edge % 2 === 0, length = alongU ? top.NbUPoles() : top.NbVPoles();
      const horizontal = knots(top, alongU ? 'U' : 'V');
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, length, 1, scale.NbUPoles()));
      for (let i = 1; i <= length; i++) for (let j = 1; j <= scale.NbUPoles(); j++) {
        const boundary = alongU ? top.Pole(i, edge === 0 ? 1 : top.NbVPoles()) : top.Pole(edge === 1 ? top.NbUPoles() : 1, i);
        const coefficient = scale.Pole(j, 1);
        try {
          const point = new kernel.gp_Pnt(boundary.X() * coefficient.Z() / ratio,
            boundary.Y() * coefficient.Z() / ratio, boundary.Z() * coefficient.X());
          try { net.SetValue(i, j, point); } finally { point.delete(); }
        } finally { boundary.delete(); coefficient.delete(); }
      }
      const flank = own(new kernel.Geom_BSplineSurface(net, horizontal.values, vertical.values,
        horizontal.multiplicities, vertical.multiplicities, horizontal.degree, vertical.degree, false, false));
      face(flank);
    }
    faces.push(own(makePolygon([[-half, -half, 0], [half, -half, 0], [half, half, 0], [-half, half, 0]])));
    progress('faces-built');
    const sewing = own(new kernel.BRepBuilderAPI_Sewing(.00001, true, true, true, false));
    for (const item of faces) sewing.Add(item.wrapped);
    sewing.Perform();
    progress('faces-sewn');
    const shell = own(cast(own(sewing.SewedShape())));
    if (shell.constructor.name !== 'Shell') throw Error(`Sewing produced ${shell.constructor.name}, not one shell.`);
    const maker = own(new kernel.BRepBuilderAPI_MakeSolid(shell.wrapped));
    const raw = own(maker.Solid());
    if (!kernel.BRepLib.OrientClosedSolid(raw)) throw Error('Cannot orient the closed shell.');
    solid = cast(raw);
    validateSolid(kernel, solid);
    progress('solid-valid');
    let maximumSampledTopDeviationMm = 0, maximumSampledScaleDeviationMm = 0;
    for (let i = 0; i < 47; i++) for (let j = 0; j < 47; j++) {
      const x = -topHalf + 2 * topHalf * (i + .37) / 47, y = -topHalf + 2 * topHalf * (j + .61) / 47;
      const point = top.Value(x, y);
      try { maximumSampledTopDeviationMm = Math.max(maximumSampledTopDeviationMm, Math.abs(point.Z() - height(x, y))); }
      finally { point.delete(); }
    }
    for (let i = 0; i < 257; i++) {
      const t = (i + .31) / 257, point = scale.Value(t, .5);
      try { maximumSampledScaleDeviationMm = Math.max(maximumSampledScaleDeviationMm,
        Math.abs(point.Z() - (ratio + (1 - ratio) * (1 - t) ** concavity)) * half * Math.SQRT2); }
      finally { point.delete(); }
    }
    return { solid, poles, maximumSampledTopDeviationMm, maximumSampledScaleDeviationMm,
      samples: count * count + count * 4 + 47 * 47 + 257 };
  } catch (error) { solid?.delete(); throw error; }
  finally { for (const resource of resources.reverse()) resource.delete(); }
}
