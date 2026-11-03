/** Pure v2 boundary. Shape-dependent spans and actual component budgets follow clipping. */
import { exactObject } from './validation.ts';
import { DesignError, LIMITS } from './budget.ts';
import { LAYOUTS, OUTLINES, NUMERIC_NAMES_V2, NUMERIC_RULES_V2, PARAMETER_NAMES_V2, type ParametersV2 } from './parameters-v2.ts';

export const LIMITS_V2 = Object.freeze({ ...LIMITS, parts: 4000, contourVertices: 100_000,
  triangles: 2_000_000, cadOperations: 200_000, memoryBytes: 2_000_000_000,
  workerPeakBytes: 2_000_000_000, timeoutMs: 120_000 });

export function checkLayoutBudget(counts: { parts: number; contourVertices: number; cadOperations: number; triangles: number; memoryBytes: number }): void {
  for (const name of ['parts', 'contourVertices', 'cadOperations', 'triangles', 'memoryBytes'] as const) {
    if (!Number.isSafeInteger(counts[name]) || counts[name] < 0 || counts[name] > LIMITS_V2[name]) {
      throw new DesignError('GENERATION_BUDGET', `Layout ${name} exceeds the ${LIMITS_V2[name]} limit. Reduce dimensions or increase pitch.`, 'pitch');
    }
  }
}

export function validateParametersV2(value: unknown): ParametersV2 {
  const p = exactObject(value, PARAMETER_NAMES_V2);
  for (const name of NUMERIC_NAMES_V2) {
    const number = p[name], rule = NUMERIC_RULES_V2[name];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < rule.min || number > rule.max ||
        (name === 'seed' && !Number.isInteger(number))) {
      throw new DesignError('PARAMETER', `${rule.label} must be ${name === 'seed' ? 'an integer' : 'a number'} from ${rule.min} to ${rule.max}.`, name);
    }
  }
  if (!OUTLINES.some(v => v === p.outline)) throw new DesignError('PARAMETER', 'Choose a supported outline.', 'outline');
  if (!LAYOUTS.some(v => v === p.layout)) throw new DesignError('PARAMETER', 'Choose a supported layout.', 'layout');
  for (const name of ['straightBoundary', 'orientationMark'] as const) {
    if (typeof p[name] !== 'boolean') throw new DesignError('PARAMETER', `${name} must be true or false.`, name);
  }
  // All fields have now been independently checked; return a fresh plain snapshot.
  return { ...p } as ParametersV2;
}
