/** Preflight geometry limits. Runtime checks must enforce the same limits. */
import type { Parameters } from './parameters.ts';

export const LIMITS = Object.freeze({ parts: 128, contourVertices: 4096,
  trianglesPerPart: 100_000, triangles: 500_000, cadOperations: 10_000,
  memoryBytes: 256 * 1024 * 1024, fileBytes: 1024 * 1024, depth: 16,
  timeoutMs: 30_000, minimumWidth: 1.2, clearance: 0.8, allowance: 0.01,
  cadTolerance: 0.001, chordTolerance: 0.05, angleRadians: 5 * Math.PI / 180,
});

export class DesignError extends Error {
  readonly code: string;
  readonly field: string | undefined;
  constructor(code: string, message: string, field?: string) {
    super(message); this.name = 'DesignError'; this.code = code; this.field = field;
  }
}

/** Public isolated count guard also supports synthetic estimator regression cases. */
export function checkPartCount(rows: number, columns: number, cap = LIMITS.parts): number {
  const count = rows * columns;
  if (!Number.isSafeInteger(count) || rows < 1 || columns < 1 || count > cap) {
    throw new DesignError('PART_BUDGET', `The design exceeds the ${cap}-part limit. Reduce dimensions or increase pitch.`, 'pitch');
  }
  return count;
}

export function estimateDesign(p: Parameters, cap = LIMITS.parts) {
  const columns = Math.max(1, Math.round(p.width / p.pitch));
  const rows = Math.max(1, Math.round(p.height / p.pitch));
  const count = checkPartCount(rows, columns, cap);
  const cellWidth = p.width / columns, cellLength = p.height / rows;
  const baseWidth = cellWidth - p.gap, length = cellLength - p.gap;
  const topWidth = p.reliefHeight === 0 ? baseWidth : baseWidth * p.topRatio;
  if (Math.min(baseWidth, length, topWidth) < LIMITS.minimumWidth) {
    throw new DesignError('MINIMUM_WIDTH', 'Cell wa-g1-r0-c0 is thinner than 1.2 mm. Increase top width or cell size.', 'topRatio');
  }
  if (p.gap < LIMITS.clearance + LIMITS.allowance) {
    throw new DesignError('CLEARANCE', 'Separate pieces need at least 0.81 mm clearance.', 'gap');
  }
  // Each blade has at most ten planar faces; reserve generously for CAD and copies.
  const contourVertices = count * 8, cadOperations = count * 12;
  const estimatedBytes = 100 * 1024 * 1024 + count * 512 * 1024;
  if (contourVertices > LIMITS.contourVertices || cadOperations > LIMITS.cadOperations || estimatedBytes > LIMITS.memoryBytes) {
    throw new DesignError('GENERATION_BUDGET', 'The design exceeds the generation budget. Increase pitch.', 'pitch');
  }
  return { rows, columns, count, cellWidth, cellLength, baseWidth, length, topWidth,
    contourVertices, cadOperations, estimatedBytes,
    volume: length * (baseWidth * p.baseThickness + p.reliefHeight * (baseWidth + topWidth) / 2),
    depth: p.baseThickness + p.reliefHeight };
}
