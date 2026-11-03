/** Native planar intersection and miter inset. Callers own and delete returned faces. */
import { cast, drawFaceOutline, getOC, makeFace, measureShapeSurfaceProperties, Sketch, CompoundSketch, Sketches, Wire, type Drawing, type Face } from 'replicad';
import type { Kernel } from '../../../../shared/geometry/kernel.ts';
import { DesignError } from '../../model/budget.ts';

export type PlanarComponent = { face: Face; area: number; centroid: [number, number]; contour: string; paths: string[] | string[][] };

/** drawFaceOutline returns surface UV coordinates, which are not necessarily XY.
 * Recover the plane's rigid UV basis before storing assembly-space contours. */
export function assemblyDrawing(face: Face): Drawing {
  const kernel=getOC(), surface=new kernel.BRepAdaptor_Surface(face.wrapped,false);
  const origin=surface.Value(0,0), u=surface.Value(1,0), v=surface.Value(0,1);
  let drawing=drawFaceOutline(face);
  try {
    const ux=u.X()-origin.X(), uy=u.Y()-origin.Y(), vx=v.X()-origin.X(), vy=v.Y()-origin.Y();
    if (Math.abs(Math.hypot(ux,uy)-1)>1e-8 || Math.abs(Math.hypot(vx,vy)-1)>1e-8 || Math.abs(origin.Z())>1e-8) {
      throw new DesignError('CONTOUR','Expected a horizontal millimeter plane.');
    }
    if (ux*vy-uy*vx < 0) { const mirrored=drawing.mirror([1,0],[0,0],'plane');drawing.blueprint.delete();drawing=mirrored; }
    const rotated=drawing.rotate(Math.atan2(uy,ux)*180/Math.PI);drawing.blueprint.delete();drawing=rotated;
    const translated=drawing.translate(origin.X(),origin.Y());drawing.blueprint.delete();drawing=translated;
    return drawing;
  } catch(error) { drawing.blueprint.delete();throw error; }
  finally { origin.delete();u.delete();v.delete();surface.delete(); }
}

export function describeFace(face: Face): PlanarComponent {
  const properties = measureShapeSurfaceProperties(face);
  try {
    const area = properties.area, center = properties.centerOfMass, drawing = assemblyDrawing(face);
    if (!Number.isFinite(area) || area <= 0 || !center.every(Number.isFinite)) throw new DesignError('CONTOUR', 'A native contour has invalid area or centroid.');
    try { return { face, area, centroid: [center[0], center[1]], contour: drawing.serialize(), paths: drawing.toSVGPaths() }; }
    finally { drawing.blueprint.delete(); }
  } finally { properties.delete(); }
}

export function componentOrder(a: PlanarComponent, b: PlanarComponent): number {
  return b.centroid[1] - a.centroid[1] || a.centroid[0] - b.centroid[0] || b.area - a.area || (a.contour < b.contour ? -1 : a.contour > b.contour ? 1 : 0);
}

/** Built-in cells have no holes; disconnected intersections remain separate faces. */
export function drawingComponents(drawing: Drawing): PlanarComponent[] {
  if (!drawing.toSVGPaths().length) return [];
  const group = drawing.sketchOnPlane('XY'), sketches = group instanceof Sketches ? group.sketches : [group];
  if (!sketches.every(sketch => sketch instanceof Sketch || sketch instanceof CompoundSketch)) throw new DesignError('CONTOUR', 'Unsupported native sketch type.');
  const result: PlanarComponent[] = [];
  try {
    for (const sketch of sketches) {
      const face = sketch.face();
      try { result.push(describeFace(face)); } catch (error) { face.delete(); throw error; }
    }
    return result.sort(componentOrder);
  } catch (error) { for (const part of result) part.face.delete(); throw error; }
  finally { for (const sketch of sketches) sketch.delete(); }
}

/** Use OCCT's oriented face offset: Drawing.offset reverses tall elliptical offsets
 * in the pinned Replicad version. Offset failure is never an implicit exclusion. */
export function insetComponent(kernel: Kernel, source: PlanarComponent, distance: number): PlanarComponent[] {
  if (!Number.isFinite(distance) || distance <= 0) throw new DesignError('PARAMETER', 'Inset distance must be positive.');
  const operation = new kernel.BRepOffsetAPI_MakeOffset(source.face.wrapped, kernel.GeomAbs_JoinType.GeomAbs_Intersection, false);
  const result: PlanarComponent[] = [];
  try {
    operation.Perform(-distance, 0);
    if (!operation.IsDone()) throw new DesignError('CONTOUR_OFFSET', 'The native inset failed. The candidate has not been accepted.');
    const shape = operation.Shape();
    try {
      const explorer = new kernel.TopExp_Explorer(shape, kernel.TopAbs_ShapeEnum.TopAbs_WIRE, kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
      try {
        for (; explorer.More(); explorer.Next()) {
          const raw = explorer.Current(); let wire;
          try { wire = cast(raw); } finally { raw.delete(); }
          try {
            if (!(wire instanceof Wire)) throw new DesignError('CONTOUR_OFFSET', 'The native inset did not return a wire.');
            const face = makeFace(wire);
            try { result.push(describeFace(face)); } catch (error) { face.delete(); throw error; }
          } finally { wire.delete(); }
        }
      } finally { explorer.delete(); }
    } finally { shape.delete(); }
    // IsDone with an empty result is a successful complete erosion. The caller
    // must record it as a zero-area exclusion, rather than silently losing a cell.
    if (result.reduce((sum, part) => sum + part.area, 0) >= source.area) throw new DesignError('CONTOUR_OFFSET', 'The native inset did not reduce the contour.');
    return result.sort(componentOrder);
  } catch (error) { for (const part of result) part.face.delete(); throw error; }
  finally { operation.delete(); }
}
