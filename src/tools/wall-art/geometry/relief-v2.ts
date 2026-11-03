/** A local-centroid base and X-only ruled relief from the accepted native footprint. */
import { Blueprint, Curve2D, Drawing, deserializeDrawing, deserializeShape, Face, Sketch, Wire, cast, type AnyShape, type Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import { validateSolid } from '../../../shared/geometry/kernel.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import type { ParametersV2 } from '../model/parameters-v2.ts';
import type { BaseContour } from './layout-metadata.ts';
import { classifySpan } from './layouts/span.ts';
import { nativeBoolean, nativeExtrude, nativeTranslate, requireSolid } from './native-operations.ts';

/** OCCT cannot apply an affinity directly to an offset of an ellipse. Convert
 * only those curves, with a checked error far below the 0.001 mm CAD tolerance. */
function taperDrawing(kernel: Kernel, drawing: Drawing, ratio: number): Drawing {
  const curves: Curve2D[] = [];
  try {
    for (const curve of drawing.blueprint.curves) {
      if (curve.geomType !== 'OFFSET_CURVE') { curves.push(curve.clone()); continue; }
      const adaptor = curve.adaptor();
      const approximation = new kernel.Geom2dConvert_ApproxCurve(adaptor, 1e-7, kernel.GeomAbs_Shape.GeomAbs_C1, 200, 8);
      try {
        if (!approximation.IsDone() || !Number.isFinite(approximation.MaxError()) || approximation.MaxError() > 1e-7) {
          throw new DesignError('CAD_TAPER', 'An offset curve cannot be tapered within the CAD tolerance.');
        }
        curves.push(new Curve2D(approximation.Curve()));
      } finally { approximation.delete(); adaptor.delete(); }
    }
    // SetAffinity scales perpendicular to its axis: a Y axis gives X-only taper.
    return new Drawing(new Blueprint(curves)).stretch(ratio, [0, 1], [0, 0]);
  } finally { curves.forEach(curve => curve.delete()); }
}

export function buildRelief(kernel: Kernel, p: ParametersV2, base: BaseContour): Shape3D {
  let local: Drawing | undefined, face: AnyShape | undefined, plinth: Shape3D | undefined;
  try {
    const original=deserializeShape(base.nativeFace);
    try { face=nativeTranslate(kernel,original,-base.centroid[0],-base.centroid[1],0); } finally { original.delete(); }
    if (!(face instanceof Face)) throw new DesignError('CONTOUR','Expected one native base face.');
    if (p.reliefHeight===0 || p.topRatio===1) {
      const solid=nativeExtrude(kernel,face,p.baseThickness+p.reliefHeight);
      try { validateSolid(kernel,solid); return solid; } catch(error) { solid.delete(); throw error; }
    }
    const restored=deserializeDrawing(base.nativeContour);
    try { local=restored.translate(-base.centroid[0],-base.centroid[1]); } finally { restored.blueprint.delete(); }
    // Three ruled polygon sections describe the same vertical base and X taper
    // without a Boolean union. Keep curved base extrusions analytic and separate.
    const polygonBase=local.blueprint.curves.every(curve=>curve.geomType==='LINE');
    if(!polygonBase)plinth=nativeExtrude(kernel,face,p.baseThickness);
    const top=taperDrawing(kernel,local,p.topRatio);
    let lower: AnyShape | undefined, bottom: Wire | undefined, upper: ReturnType<Drawing['sketchOnPlane']> | undefined;
    try {
      const baseWire=face.outerWire();
      try {
        if(polygonBase)bottom=baseWire.clone();
        lower=nativeTranslate(kernel,baseWire,0,0,p.baseThickness);
      } finally { baseWire.delete(); }
      upper=top.sketchOnPlane('XY',p.baseThickness+p.reliefHeight);
      if (!(lower instanceof Wire) || !(upper instanceof Sketch)) throw new DesignError('CONTOUR','The tapered contour has unsupported topology.');
      const topFace=upper.face();
      try { if (classifySpan(kernel,topFace).below) throw new DesignError('FEATURE_SIZE',`Part ${base.id} has a top narrower than 1.2 mm. Increase top ratio or set relief to zero.`,'topRatio'); }
      finally { topFace.delete(); }
      const loft=new kernel.BRepOffsetAPI_ThruSections(true,true,LIMITS.cadTolerance);
      let relief: Shape3D | undefined;
      try {
        if(bottom)loft.AddWire(bottom.wrapped);
        loft.AddWire(lower.wrapped); loft.AddWire(upper.wire.wrapped); loft.Build();
        if (!loft.IsDone()) throw new DesignError('CAD_LOFT',`Part ${base.id} could not form a native relief.`);
        const raw=loft.Shape(); try { relief=requireSolid(cast(raw)); } finally { raw.delete(); }
        const solid=plinth?requireSolid(nativeBoolean(kernel,'fuse',plinth,relief)):relief.clone();
        try { validateSolid(kernel,solid); return solid; } catch(error) { solid.delete(); throw error; }
      } finally { relief?.delete(); loft.delete(); }
    } finally {
      lower?.delete(); bottom?.delete(); if (upper instanceof Sketch) upper.delete(); top.blueprint.delete();
    }
  } finally { plinth?.delete(); face?.delete(); local?.blueprint.delete(); }
}
