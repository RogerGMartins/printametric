/** Bounded planar stage. Native faces are temporary; outputs contain native curve data. */
import type { Kernel } from '../../../../shared/geometry/kernel.ts';
import { DesignError } from '../../model/budget.ts';
import { validateParametersV2, LIMITS_V2 } from '../../model/validation-v2.ts';
import { enumerateCells, usesWholeCells, type Cell } from './cells.ts';
import { nativeCell, nativeOutline } from './outlines.ts';
import { drawingComponents, insetComponent } from './clip.ts';
import { classifySpan } from './span.ts';
import type { BaseContour, ExcludedContour } from '../layout-metadata.ts';
import type { ParametersV2 } from '../../model/parameters-v2.ts';

export function partitionCell(kernel: Kernel, p: ParametersV2, cell: Cell): { bases: BaseContour[]; excluded: ExcludedContour[] } {
  const bases: BaseContour[] = [], excluded: ExcludedContour[] = [];
  if (usesWholeCells(p) && (Math.abs(cell.center[0]) > p.width/2 || Math.abs(cell.center[1]) > p.height/2)) return { bases, excluded };
  const source = nativeCell(cell), outline = nativeOutline(p);
  const clipped = drawingComponents(usesWholeCells(p) ? source : source.intersect(outline));
  try {
    for (const [componentIndex, component] of clipped.entries()) {
      const prefix = `wa-g2-${cell.key}:c${componentIndex}`;
      const inset = insetComponent(kernel, component, p.gap/2);
      try {
        if (!inset.length) excluded.push({ id: `${prefix}:i0`, cellKey: cell.key, centroid: component.centroid, area: 0, reason: 'collapsed', paths: component.paths });
        for (const [index, base] of inset.entries()) {
          const id = `${prefix}:i${index}`;
          // Only floating-point arithmetic noise at the exact area boundary is
          // treated as equality. This is not parameter/geometry quantization.
          const error = 32*Number.EPSILON*Math.max(1,base.area);
          if (base.area < 4-error) {
            excluded.push({ id, cellKey: cell.key, centroid: base.centroid, area: base.area, reason: 'area', paths: base.paths }); continue;
          }
          const span = classifySpan(kernel, base.face);
          if (span.below) {
            excluded.push({ id, cellKey: cell.key, centroid: base.centroid, area: base.area, reason: 'span', paths: base.paths }); continue;
          }
          bases.push({ id, cellKey: cell.key, mapNumber: 0, centroid: base.centroid, area: base.area,
            nativeContour: base.contour, nativeFace: base.face.serialize(), paths: base.paths, span: { lower: span.lower, upper: span.upper, neck: span.neck } });
        }
      } finally { for (const base of inset) base.face.delete(); }
    }
  } finally {
    for (const component of clipped) component.face.delete();
    source.blueprint.delete(); outline.blueprint.delete();
  }
  return { bases, excluded };
}

/** Small headless coordinator. Large jobs must call partitionCell in retired
 * native batches; the editor may not call this unbounded-lifetime coordinator. */
export function partitionLayout(kernel: Kernel, input: unknown) {
  const p = validateParametersV2(input), cells = enumerateCells(p);
  const bases: BaseContour[] = [], excluded: ExcludedContour[] = [];
  let nativeBytes = 0;
  for (const cell of cells) {
    const result = partitionCell(kernel,p,cell); bases.push(...result.bases); excluded.push(...result.excluded);
    nativeBytes += result.bases.reduce((sum,part) => sum+(part.nativeContour.length+part.nativeFace.length)*2,0);
    if (bases.length > LIMITS_V2.parts || nativeBytes + kernel.wasmMemory.buffer.byteLength > LIMITS_V2.memoryBytes) {
      throw new DesignError('GENERATION_BUDGET','The layout exceeds the part or geometry memory budget. Increase pitch.','pitch');
    }
  }
  if (!bases.length) throw new DesignError('CONTOUR_COLLAPSE','No printable component remains after the gap and fragment limits.');
  bases.sort((a,b) => b.centroid[1]-a.centroid[1] || a.centroid[0]-b.centroid[0] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const [index,part] of bases.entries()) part.mapNumber=index+1;
  return { bases, excluded, wholeCells: usesWholeCells(p) };
}
