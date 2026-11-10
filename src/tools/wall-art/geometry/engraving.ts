/** Native underside pockets. Failed fitting yields a map-only ID, never a missing part. */
import { cast, deserializeDrawing, deserializeShape, Face, makePolygon, measureDistanceBetween, type AnyShape, type Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import { validateSolid } from '../../../shared/geometry/kernel.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import type { ParametersV2 } from '../model/parameters-v2.ts';
import type { BaseContour } from './layout-metadata.ts';
import { digitPolygons, ORIENTATION_ARROW, MINIMUM_GLYPH_HEIGHT } from './glyphs.ts';
import { nativeBoolean, nativeExtrude, nativeScale, nativeTranslate, requireSolid } from './native-operations.ts';
import { classifySpan } from './layouts/span.ts';

export type Identification = { status: 'unengraved' } | { status: 'map-only'; reason?: 'glyph-fit' | 'residual-floor' } | {
  status: 'engraved'; height: number; anchor: [number, number]; orientationMark: boolean;
};

/** Each union, containment check and pocket cut consumes the job's CAD budget. */
export type CountOperation = () => void;

/** Batch-owned unit glyphs. Native unions are shared across numbers, but each
 * scaled/placed cutter is independently owned. Dispose before retiring the batch. */
export function createGlyphTemplates(kernel: Kernel, count: CountOperation) {
  const templates = new Map<number, AnyShape>();
  return {
    get(digit: number): AnyShape {
      const cached=templates.get(digit);if(cached)return cached;
      let joined: AnyShape | undefined;
      try {
        for(const points of digitPolygons(digit)) {
          count();const bar=makePolygon(points.map(([x,y])=>[x,-y,0]));
          if(!joined)joined=bar;
          else{
            try{count();const next=nativeBoolean(kernel,'fuse',joined,bar);joined.delete();joined=next;}
            finally{bar.delete();}
          }
        }
        if(!joined)throw new DesignError('ENGRAVING','Empty glyph template.');
        templates.set(digit,joined);const result=joined;joined=undefined;return result;
      }finally{joined?.delete();}
    },
    dispose(){templates.forEach(shape=>shape.delete());templates.clear();},
  };
}
type GlyphTemplates = ReturnType<typeof createGlyphTemplates>;

function compound(kernel: Kernel, shapes: AnyShape[]): AnyShape {
  const builder = new kernel.TopoDS_Builder(), result = new kernel.TopoDS_Compound();
  try {
    builder.MakeCompound(result);
    for (const shape of shapes) builder.Add(result, shape.wrapped);
    return cast(result);
  } finally { result.delete(); builder.delete(); }
}

function surfaceArea(kernel: Kernel, shape: AnyShape): number {
  const properties = new kernel.GProp_GProps();
  try {
    kernel.BRepGProp.SurfaceProperties(shape.wrapped, properties, false, false);
    const area = properties.Mass();
    if (!Number.isFinite(area) || area < 0) throw new DesignError('ENGRAVING', 'Cannot measure an engraving footprint.');
    return area;
  } finally { properties.delete(); }
}

/** Number polygons flip through local X for underside reading. The physical
 * arrow points to assembly +Y; the plan view explains this front/back convention. */
export function identificationPolygons(number: number, height: number, mark: boolean): [number, number][][][] {
  if (!Number.isInteger(number) || number < 1 || number > 4000 || !Number.isFinite(height) || height < MINIMUM_GLYPH_HEIGHT) {
    throw new DesignError('ENGRAVING', 'Invalid physical number or glyph height.');
  }
  const text = String(number), scale = height / 10, width = (text.length * 7 - 1) * scale;
  const offsetY = mark ? -2.9 : 0;
  const groups = [...text].map((digit, index) => digitPolygons(Number(digit)).map(points => points.map(([x, y]): [number, number] =>
    [x * scale - width / 2 + index * 7 * scale, height / 2 - y * scale + offsetY])));
  if (mark) groups.push([ORIENTATION_ARROW.map(([x, y]): [number, number] => [x, y + height / 2 + 0.8 + offsetY])]);
  return groups;
}

function footprint(kernel: Kernel, number: number, height: number, mark: boolean, count: CountOperation, templates: GlyphTemplates): AnyShape {
  const digits: AnyShape[] = [];
  try {
    const text=String(number),scale=height/10,width=(text.length*7-1)*scale,offsetY=height/2-(mark?2.9:0);
    for(const [index,digit] of [...text].entries()) {
      count();const scaled=nativeScale(kernel,templates.get(Number(digit)),scale);
      try{digits.push(nativeTranslate(kernel,scaled,-width/2+index*7*scale,offsetY,0));}
      finally{scaled.delete();}
    }
    if(mark){count();digits.push(makePolygon(ORIENTATION_ARROW.map(([x,y])=>[x,y+offsetY+.8,0])));}
    return compound(kernel, digits);
  } finally { digits.forEach(digit => digit.delete()); }
}

/** Native straight edges provide exact half-planes for a convex base. Curved or
 * concave bases cannot use this certificate and keep full native fit operations. */
function convexFitPlanes(base: BaseContour): [number, number, number][] {
  const drawing=deserializeDrawing(base.nativeContour);
  try {
    const curves=drawing.blueprint.curves;
    if(!curves.every(curve=>curve.geomType==='LINE'))return [];
    const points=curves.map(curve=>{const p=curve.firstPoint;return [p[0]-base.centroid[0],p[1]-base.centroid[1]];});
    const planes: [number,number,number][]=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i]!,b=points[(i+1)%points.length]!,dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,length=Math.hypot(dx,dy);
      if(length<1e-8)return [];
      let nx=-dy/length,ny=dx/length,c=-(nx*a[0]!+ny*a[1]!);
      if(c<0){nx=-nx;ny=-ny;c=-c;}
      if(points.some(p=>nx*p[0]!+ny*p[1]!+c < -1e-7))return [];
      planes.push([nx,ny,c]);
    }
    return planes;
  } finally {drawing.blueprint.delete();}
}

/** Largest fit on a 0.05 mm lattice anchored at 5 mm. Try the area centroid first,
 * then a fixed 3×3 interior-anchor grid, top-to-bottom and left-to-right. All
 * anchors use the same native containment and 1.2 mm edge-distance checks. */
export function engravePart(kernel: Kernel, p: ParametersV2, base: BaseContour, solid: Shape3D, count: CountOperation, sharedTemplates?: GlyphTemplates): {
  solid: Shape3D; identification: Identification;
} {
  if (p.engravingDepth === 0) return { solid: solid.clone(), identification: { status: 'unengraved' } };
  if (p.baseThickness - p.engravingDepth < 1.2) throw new DesignError('FEATURE_SIZE', 'Engraving must leave a 1.2 mm base floor.', 'engravingDepth');
  const original = deserializeShape(base.nativeFace);
  const templates=sharedTemplates??createGlyphTemplates(kernel,count);
  let face: AnyShape | undefined;
  try {
    face = nativeTranslate(kernel, original, -base.centroid[0], -base.centroid[1], 0);
    if (!(face instanceof Face)) throw new DesignError('ENGRAVING', 'Expected one native base face.');
    // Replicad consumes a face when extracting its outer wire.
    const box = face.boundingBox, border = face.clone().outerWire();
    try {
      const [min, max] = box.bounds;
      const step=(width:number)=>Math.floor((Math.min(width,base.span.neck??Infinity)*p.numeralRatio-MINIMUM_GLYPH_HEIGHT+1e-10)/.05);
      const measured=step(base.span.lower)===step(base.span.upper)?base.span:classifySpan(kernel,face,1.2,p.numeralRatio);
      const span = Math.min(measured.lower, measured.neck ?? Infinity);
      const requested = span * p.numeralRatio;
      const planes=convexFitPlanes(base);
      const anchors: [number, number][] = [[0, 0]];
      for (const fy of [0.75, 0.5, 0.25]) for (const fx of [0.25, 0.5, 0.75]) {
        const anchor: [number, number] = [min[0] + fx * (max[0] - min[0]), min[1] + fy * (max[1] - min[1])];
        if (!anchors.some(a => Math.hypot(a[0] - anchor[0], a[1] - anchor[1]) < 1e-8)) anchors.push(anchor);
      }
      for (let step = Math.floor((requested - MINIMUM_GLYPH_HEIGHT + 1e-10) / 0.05); step >= 0; step--) {
        const height = MINIMUM_GLYPH_HEIGHT + step * 0.05;
        // Cheap rejection only. Acceptance always uses the actual native footprint.
        const width = (String(base.mapNumber).length * 7 - 1) * height / 10;
        const fullHeight = height + (p.orientationMark ? 5.8 : 0);
        const points=planes.length?identificationPolygons(base.mapNumber,height,p.orientationMark).flat(2):[];
        const candidates = anchors.filter(([x, y]) => x - width / 2 >= min[0] + 1.2 && x + width / 2 <= max[0] - 1.2 &&
          y - fullHeight / 2 >= min[1] + 1.2 && y + fullHeight / 2 <= max[1] - 1.2 &&
          planes.every(([nx,ny,c])=>points.every(point=>nx*(point[0]+x)+ny*(point[1]+y)+c>=1.2-1e-7)));
        if (!candidates.length) continue;
        const glyphs = footprint(kernel, base.mapNumber, height, p.orientationMark, count, templates);
        try {
          for (const anchor of candidates) {
            const placed = nativeTranslate(kernel, glyphs, anchor[0], anchor[1], 0);
            try {
              // Every polygon edge lies in the convex hull of its vertices. If
              // all glyph/arrow vertices lie in every inward-offset native base
              // half-plane, containment and clearance follow for the full cuts.
              // Keep a CAD tolerance margin; uncertain placements use OCCT below.
              const certified=planes.length>0&&planes.every(([nx,ny,c])=>points.every(point=>
                nx*(point[0]+anchor[0])+ny*(point[1]+anchor[1])+c>=1.2+2*LIMITS.cadTolerance));
              if(!certified){
                count();
                const outside = nativeBoolean(kernel, 'cut', placed, face);
                let contained;
                try { contained = surfaceArea(kernel, outside) <= 1e-8; } finally { outside.delete(); }
                if (!contained) continue;
                count();
                if (measureDistanceBetween(placed, border) < 1.2 - 1e-8) continue;
              }
              count(); const cutter = nativeExtrude(kernel, placed, p.engravingDepth);
              try {
                count(); const cut = requireSolid(nativeBoolean(kernel, 'cut', solid, cutter));
                try { validateSolid(kernel, cut); } catch (error) { cut.delete(); throw error; }
                return { solid: cut, identification: { status: 'engraved', height, anchor, orientationMark: p.orientationMark } };
              } finally { cutter.delete(); }
            } finally { placed.delete(); }
          }
        } finally { glyphs.delete(); }
      }
      return { solid: solid.clone(), identification: { status: 'map-only' } };
    } finally { box.delete(); border.delete(); }
  } finally { face?.delete(); original.delete();if(!sharedTemplates)templates.dispose(); }
}
