/** Broad-phase XY grid followed by full native-solid distance, in millimeters. */
import { deserializeDrawing, measureDistanceBetween, type Shape3D } from 'replicad';
import type { Bounds } from '../../../shared/geometry/types.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import type { BaseContour } from './layout-metadata.ts';
import type { ParametersV2 } from '../model/parameters-v2.ts';
import type { XY } from './layouts/cells.ts';

export const MINIMUM_CLEARANCE = 0.81;
type PlacedBounds = { id: string; bounds: Bounds; clearanceHull?: XY[] | null };

/** For line-only bases, every ruled side is inside the convex hull of its four
 * corners. Include both base and X-scaled top vertices; engraving only removes
 * material. These are native contour coordinates, not tessellation vertices.
 * Curved boundaries cannot use this inner polygon as an outer bound. */
export function polygonClearanceHull(base: BaseContour, p: ParametersV2): XY[] | null {
  const drawing=deserializeDrawing(base.nativeContour);
  try {
    if(!drawing.blueprint.curves.every(curve=>curve.geomType==='LINE'))return null;
    const points: XY[]=drawing.blueprint.curves.flatMap(curve=>[curve.firstPoint,curve.lastPoint]);
    if(p.reliefHeight>0)points.push(...points.map(([x,y]): XY=>[base.centroid[0]+p.topRatio*(x-base.centroid[0]),y]));
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const turn=(a:XY,b:XY,c:XY)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const half=(values:XY[])=>{
      const result:XY[]=[];
      for(const point of values){while(result.length>=2&&turn(result.at(-2)!,result.at(-1)!,point)<=0)result.pop();result.push(point);}
      result.pop();return result;
    };
    const hull=[...half(points),...half([...points].reverse())];
    return hull.length>=3?hull:null;
  }finally{drawing.blueprint.delete();}
}

function separatedHulls(left: XY[] | null | undefined, right: XY[] | null | undefined): boolean {
  if(!left||!right)return false;
  // Enlarge both bounds by the CAD tolerance before proving separation. A
  // remaining pair still needs native distance, including any projection overlap.
  const required=MINIMUM_CLEARANCE+2*LIMITS.cadTolerance;
  for(const hull of [left,right])for(let i=0;i<hull.length;i++){
    const a=hull[i]!,b=hull[(i+1)%hull.length]!,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(length<1e-8)continue;
    const project=([x,y]:XY)=>(-dy*x+dx*y)/length;
    const l=left.map(project),r=right.map(project);
    if(Math.min(...r)-Math.max(...l)>required||Math.min(...l)-Math.max(...r)>required)return true;
  }
  return false;
}

/** Grid entries and candidate pairs are bounded independently. Shared XY cells
 * only select candidates: they do not establish a collision between tapered parts. */
export function clearancePairs(parts: readonly PlacedBounds[]): [number, number][] {
  const cells = new Map<string, number[]>(), seen = new Set<string>(), pairs: [number, number][] = [];
  let entries = 0, comparisons = 0;
  if (parts.length > 4000) throw new DesignError('GENERATION_BUDGET', 'Clearance part budget exceeded.');
  for (const [index, part] of parts.entries()) {
    const { min, max } = part.bounds;
    if (![...min, ...max].every(Number.isFinite) || min.some((value, axis) => value > max[axis]!)) {
      throw new DesignError('CLEARANCE', `Invalid native bounds for ${part.id}.`);
    }
    const x0 = Math.floor((min[0] - MINIMUM_CLEARANCE) / 128), x1 = Math.floor((max[0] + MINIMUM_CLEARANCE) / 128);
    const y0 = Math.floor((min[1] - MINIMUM_CLEARANCE) / 128), y1 = Math.floor((max[1] + MINIMUM_CLEARANCE) / 128);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (!Number.isSafeInteger(count) || entries + count > 100_000) throw new DesignError('GENERATION_BUDGET', 'Clearance spatial-index budget exceeded.');
    entries += count;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x},${y}`, bucket = cells.get(key) ?? [];
      for (const other of bucket) {
        if (++comparisons > 1_000_000) throw new DesignError('GENERATION_BUDGET', 'Clearance spatial-query budget exceeded.');
        const previous = parts[other]!.bounds;
        if ([0, 1, 2].some(axis => previous.max[axis]! + MINIMUM_CLEARANCE < min[axis]! || max[axis]! + MINIMUM_CLEARANCE < previous.min[axis]!)) continue;
        const pair = `${other}:${index}`;
        if (seen.has(pair)) continue;
        if(seen.size===200_000)throw new DesignError('GENERATION_BUDGET','Clearance candidate budget exceeded.');
        seen.add(pair);
        if(separatedHulls(parts[other]!.clearanceHull,part.clearanceHull))continue;
        if (pairs.length === 200_000) throw new DesignError('GENERATION_BUDGET', 'Native clearance pair budget exceeded.');
        pairs.push([other, index]);
      }
      bucket.push(index); cells.set(key, bucket);
    }
  }
  return pairs;
}

/** Inputs are full solids at their assembly placement, including any overhang.
 * Distance zero includes touching/intersecting solids; no mesh approximation. */
export function checkNativeClearance(left: Shape3D, right: Shape3D, leftID: string, rightID: string): number {
  const distance = measureDistanceBetween(left, right);
  if (!Number.isFinite(distance) || distance < MINIMUM_CLEARANCE) {
    throw new DesignError('CLEARANCE', `Parts ${leftID} and ${rightID} do not preserve ${MINIMUM_CLEARANCE} mm solid clearance. Change layout, gap or taper.`, 'gap');
  }
  return distance;
}
