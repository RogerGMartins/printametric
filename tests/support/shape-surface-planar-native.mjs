/** R3 rectangular flat/sloping top construction. Exact planar caps and shared
 * polynomial flanks; a separately extruded per-part plinth is fused if requested.
 * This is isolated capability evidence, not the arbitrary-footprint generator. */
import { cast, makePolygon } from 'replicad';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { nativeBoolean, nativeExtrude, requireSolid } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { fitPowerProfile } from '../../src/tools/wall-art/geometry/surface-fit.ts';

export function buildPlanarRectangle(kernel, { width, height = width, ratio, concavity, baseThickness, top }) {
  if (![width, height, ratio, concavity, baseThickness, ...top].every(Number.isFinite) || width <= 0 || height <= 0 || width > 2000 || height > 2000 ||
    ratio < .1 || ratio > 1 || concavity < 1 || concavity > 4 || baseThickness < 0 || baseThickness > 40 || top.length !== 3) throw Error('Invalid planar rectangle parameters.');
  const minimum = top[0] - Math.abs(top[1]) - Math.abs(top[2]);
  if (minimum <= baseThickness || minimum < 1.2 || Math.min(width, height) * ratio < 1.2) throw Error('Planar part has invalid relief or minimum material size.');
  const resources = [], own = object => { resources.push(object); return object; };
  const scale = fitPowerProfile(concavity, .0002 / (Math.hypot(width, height) / 2 * Math.max(1 - ratio, .000001)));
  const values = [...scale.coefficients].reverse(), degree = values.length - 1;
  // At fixed XY the height must increase with section parameter t. This proves
  // injectivity of the nested rectangular sections, including sloping tops.
  // Positive top heights alone do not prevent a strongly tapered tilted flank
  // from folding. Bound the constructed polynomial, not selected sample points.
  const split = coefficients => {
    const left = [coefficients[0]], right = [coefficients.at(-1)]; let row = coefficients;
    while (row.length > 1) { row = row.slice(1).map((x, i) => (row[i] + x) / 2); left.push(row[0]); right.unshift(row.at(-1)); }
    return [left, right];
  };
  const sizeCoefficients = values.map(x => ratio + (1 - ratio) * x);
  const derivative = sizeCoefficients.slice(1).map((x, i) => degree * (x - sizeCoefficients[i]));
  const tilt = Math.abs(top[1]) + Math.abs(top[2]), centralHeight = top[0] - baseThickness;
  const prove = (sizes, slopes, from, to, depth) => {
    const lower = Math.min(...sizes), slope = Math.max(0, ...slopes.map(x => -x));
    if (lower > 0 && centralHeight - tilt - to * slope * tilt / lower > 1e-10) return;
    if (depth === 8) throw Error('Planar taper cannot be certified free of folded flanks.');
    const [s0, s1] = split(sizes), [d0, d1] = split(slopes), mid = (from + to) / 2;
    prove(s0, d0, from, mid, depth + 1); prove(s1, d1, mid, to, depth + 1);
  };
  prove(sizeCoefficients, derivative, 0, 1, 0);
  // Subdivision preserves the polynomial exactly. Short native charts avoid
  // asking the mesher to resolve the whole steep power profile in one face.
  const sections = [];
  const subdivide = (coefficients, from, to, depth) => {
    if (depth === 2) { sections.push({ coefficients, from, to }); return; }
    const [left, right] = split(coefficients), mid = (from + to) / 2;
    subdivide(left, from, mid, depth + 1); subdivide(right, mid, to, depth + 1);
  };
  subdivide(sizeCoefficients, 0, 1, 0);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], faces = [];
  let solid;
  function knots(length, value) {
    const array = own(new kernel.NCollection_Array1_int(1, length));
    for (let i = 1; i <= length; i++) array.SetValue(i, value);
    return array;
  }
  try {
    const ends = own(new kernel.NCollection_Array1_double(1, 2)); ends.SetValue(1, 0); ends.SetValue(2, 1);
    const uMult = knots(2, 2), vMult = knots(2, degree + 1);
    const bottom = own(makePolygon(corners.map(([x, y]) => [x * width / 2, y * height / 2, baseThickness])));
    const cap = own(makePolygon(corners.map(([x, y]) => [x * width * ratio / 2, y * height * ratio / 2, top[0] + top[1] * x + top[2] * y])));
    faces.push(bottom, cap);
    for (let edge = 0; edge < 4; edge++) for (const section of sections) {
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, 2, 1, degree + 1));
      for (let i = 0; i < 2; i++) {
        const [x, y] = corners[(edge + i) % 4], z = top[0] + top[1] * x + top[2] * y;
        for (let j = 0; j <= degree; j++) {
          const size = section.coefficients[j], t = section.from + (section.to - section.from) * j / degree;
          const point = new kernel.gp_Pnt(x * width * size / 2, y * height * size / 2, baseThickness + (z - baseThickness) * t);
          try { net.SetValue(i + 1, j + 1, point); } finally { point.delete(); }
        }
      }
      const surface = own(new kernel.Geom_BSplineSurface(net, ends, ends, uMult, vMult, 1, degree, false, false));
      const maker = own(new kernel.BRepBuilderAPI_MakeFace(surface, 1e-6));
      if (!maker.IsDone()) throw Error('Planar flank construction failed.');
      faces.push(own(cast(own(maker.Face()))));
    }
    const sewing = own(new kernel.BRepBuilderAPI_Sewing(1e-6, true, true, true, false));
    for (const face of faces) sewing.Add(face.wrapped);
    sewing.Perform();
    if (sewing.NbFreeEdges() || sewing.NbMultipleEdges()) throw Error('Planar relief has unclosed boundaries.');
    const shell = own(cast(own(sewing.SewedShape())));
    if (shell.constructor.name !== 'Shell') throw Error('Expected a single planar relief shell.');
    const maker = own(new kernel.BRepBuilderAPI_MakeSolid(shell.wrapped)), raw = own(maker.Solid());
    if (!kernel.BRepLib.OrientClosedSolid(raw)) throw Error('Cannot orient planar relief.');
    solid = cast(raw); validateSolid(kernel, solid);
    if (baseThickness > 0) {
      const foot = own(makePolygon(corners.map(([x, y]) => [x * width / 2, y * height / 2, 0])));
      const plinth = own(nativeExtrude(kernel, foot, baseThickness));
      const joined = requireSolid(nativeBoolean(kernel, 'fuse', plinth, solid));
      solid.delete(); solid = joined; validateSolid(kernel, solid);
    }
    return { solid, poles: 8 * sections.length * (degree + 1), physicalHeightErrorMm: 0,
      profilePositionErrorMm: scale.error * Math.hypot(width, height) / 2 * (1 - ratio) };
  } catch (error) { solid?.delete(); throw error; }
  finally { for (const resource of resources.reverse()) resource[Symbol.dispose] ? resource[Symbol.dispose]() : resource.delete(); }
}
