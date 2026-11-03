/** Native planar curves; tessellation is reserved for the shared preview/export mesh. */
import { draw, drawCircle, drawEllipse, drawRectangle, type Drawing } from 'replicad';
import type { ParametersV2 } from '../../model/parameters-v2.ts';
import type { Cell, XY } from './cells.ts';

export function polygon(points: XY[]): Drawing {
  if (points.length < 3) throw new Error('A closed polygon needs at least three vertices.');
  const pen = draw(points[0]!);
  for (const point of points.slice(1)) pen.lineTo(point);
  return pen.close();
}

export function nativeOutline(p: ParametersV2): Drawing {
  const x = p.width / 2, y = p.height / 2;
  switch (p.outline) {
    case 'rectangle': return drawRectangle(p.width, p.height);
    case 'ellipse': return drawEllipse(x, y);
    case 'hexagon': return polygon([[x, 0], [x / 2, y], [-x / 2, y], [-x, 0], [-x / 2, -y], [x / 2, -y]]);
    case 'arch': return draw([-x, -y]).lineTo([x, -y]).lineTo([x, 0]).ellipseTo([-x, 0], x, y, 0, false, true).close();
  }
}

export function nativeCell(cell: Cell): Drawing {
  if (cell.kind === 'polygon') return polygon(cell.points);
  if (cell.kind === 'disk') return drawCircle(cell.radius);
  const at = (radius: number, angle: number): XY => [radius * Math.cos(angle), radius * Math.sin(angle)];
  const middle = (cell.start + cell.end) / 2;
  return draw(at(cell.inner, cell.start)).lineTo(at(cell.outer, cell.start))
    .threePointsArcTo(at(cell.outer, cell.end), at(cell.outer, middle))
    .lineTo(at(cell.inner, cell.end)).threePointsArcTo(at(cell.inner, cell.start), at(cell.inner, middle)).close();
}
