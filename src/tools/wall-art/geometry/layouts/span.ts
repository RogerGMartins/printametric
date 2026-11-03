/** Material-span classification uses native curves, not the axis-aligned box. */
import { Drawing, drawFaceOutline, type Face } from 'replicad';
import type { Kernel } from '../../../../shared/geometry/kernel.ts';
import { DesignError } from '../../model/budget.ts';
import type { XY } from './cells.ts';

const cross = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function hull(points: XY[]): XY[] {
  const sorted = [...points].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const lower: XY[] = [], upper: XY[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop(); upper.pop(); return [...lower, ...upper];
}

function hullWidth(points: XY[]): { width: number; normal: XY } {
  let width = Infinity, normal: XY = [1, 0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const length = Math.hypot(b[0]-a[0], b[1]-a[1]); if (length === 0) continue;
    const n: XY = [-(b[1]-a[1])/length, (b[0]-a[0])/length];
    const projection = points.map(p => p[0]*n[0]+p[1]*n[1]);
    const candidate = Math.max(...projection)-Math.min(...projection);
    if (candidate < width) { width = candidate; normal = n; }
  }
  return { width, normal };
}

/** A support width in one direction is an upper bound on minimum support width. */
function nativeSupportWidth(kernel: Kernel, drawing: Drawing, normal: XY): number {
  const rotated = drawing.rotate(-Math.atan2(normal[1],normal[0])*180/Math.PI);
  const box = new kernel.Bnd_Box2d();
  try {
    for (const curve of rotated.blueprint.curves) kernel.BndLib_Add2dCurve.AddOptimal(curve.wrapped, curve.firstParameter, curve.lastParameter, 1e-9, box);
    return box.GetXMax()-box.GetXMin();
  } finally { box.delete(); rotated.blueprint.delete(); }
}

export type SpanResult = { below: boolean; lower: number; upper: number; neck: number | null };

function fullCircleWidth(kernel: Kernel, drawing: Drawing): number | null {
  const curves=drawing.blueprint.curves;
  if(!curves.length||!curves.every(curve=>curve.geomType==='CIRCLE'))return null;
  let reference: {x:number;y:number;radius:number}|undefined,sweep=0;
  for(const curve of curves){
    const adaptor=new kernel.Geom2dAdaptor_Curve(curve.wrapped),circle=adaptor.Circle(),center=circle.Location();
    try{
      const current={x:center.X(),y:center.Y(),radius:circle.Radius()};
      if(reference&&(Math.hypot(reference.x-current.x,reference.y-current.y)>1e-10||Math.abs(reference.radius-current.radius)>1e-10))return null;
      reference??=current;sweep+=curve.lastParameter-curve.firstParameter;
    }finally{center.delete();circle.delete();adaptor.delete();}
  }
  // Native disks often have two semicircle edges rather than one periodic edge.
  return Math.abs(sweep-2*Math.PI)<1e-10?2*reference!.radius:null;
}

/** Sampled hulls are inside the native contour's convex hull, giving a lower
 * support-width bound. Only a native directional bound can prove an exclusion.
 * Refinement is bounded; unresolved numerical thresholds reject the candidate. */
export function classifySpan(kernel: Kernel, face: Face, threshold = 1.2, numeralRatio?: number): SpanResult {
  const drawing = drawFaceOutline(face), curves = drawing.blueprint.curves;
  try {
    const allLines = curves.every(c => c.geomType === 'LINE');
    // A complete native circle has the same support width in every direction.
    // This avoids an inscribed-polygon underestimate at an exact glyph step.
    const circleWidth=fullCircleWidth(kernel,drawing);
    if(circleWidth!==null){
      return {below:circleWidth<threshold,lower:circleWidth,upper:circleWidth,neck:null};
    }
    let lower = 0, upper = Infinity;
    for (const samples of allLines ? [1] : [4, 16, 64, 256]) {
      const points: XY[] = curves.flatMap(curve => Array.from({ length: samples }, (_, index) => curve.value(curve.firstParameter + (curve.lastParameter-curve.firstParameter)*index/samples)));
      const measured = hullWidth(hull(points)); lower = measured.width;
      upper = allLines ? lower : nativeSupportWidth(kernel, drawing, measured.normal);
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) throw new DesignError('CONTOUR_SPAN', 'Cannot measure the material span of this contour.');
      if (upper < threshold - 1e-8) return { below: true, lower, upper, neck: null };
      const arithmeticError = 32 * Number.EPSILON * Math.max(1, ...points.flat().map(Math.abs));
      if (allLines && Math.abs(lower-threshold) <= arithmeticError) lower = upper = threshold;
      if (lower >= threshold) {
        // A concave annular boundary needs an additional neck test. Consecutive
        // edges (including the closing seam) share a corner, not opposing walls.
        let positive = false, negative = false;
        for (let i = 0; i < points.length; i++) {
          const turn = cross(points[i]!,points[(i+1)%points.length]!,points[(i+2)%points.length]!);
          positive ||= turn > 1e-8; negative ||= turn < -1e-8;
        }
        let neck = Infinity;
        if (positive && negative) for (let i = 0; i < curves.length; i++) for (let j = i+2; j < curves.length; j++) {
          if (i === 0 && j === curves.length-1) continue;
          const distance = curves[i]!.distanceFrom(curves[j]!);
          if (!Number.isFinite(distance)) throw new DesignError('CONTOUR_SPAN', 'Cannot measure opposing boundary branches.');
          neck = Math.min(neck, distance);
        }
        if (Number.isFinite(neck) && Math.abs(neck-threshold) <= arithmeticError) neck = threshold;
        const result={ below: neck < threshold, lower, upper, neck: Number.isFinite(neck) ? neck : null };
        if(result.below||numeralRatio===undefined)return result;
        // Engraving needs the largest requested 0.05 mm step, not merely enough
        // precision to classify a 1.2 mm fragment. Refine until both native span
        // bounds select the same step; never silently choose a smaller number.
        const step=(width:number)=>Math.floor((Math.min(width,neck)*numeralRatio-5+1e-10)/.05);
        if(step(lower)===step(upper))return result;
      }
    }
    throw new DesignError('CONTOUR_SPAN', numeralRatio===undefined?
      `Material span is numerically ambiguous at ${threshold} mm; change pitch or gap.`:
      'Requested numeral height is numerically ambiguous at a 0.05 mm step; change numeral ratio.');
  } finally { drawing.blueprint.delete(); }
}
