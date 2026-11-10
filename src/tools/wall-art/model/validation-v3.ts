/** Strict v3 parameter boundary before bounded layout enumeration and native work. */
import { exactObject } from './validation.ts';
import { DesignError } from './budget.ts';
import { LAYOUTS, OUTLINES, type ParametersV2 } from './parameters-v2.ts';
import { BOOLEAN_NAMES_V3, NUMERIC_NAMES_V3, NUMERIC_RULES_V3, PARAMETER_NAMES_V3,
  SURFACE_FAMILIES, type ParametersV3 } from './parameters-v3.ts';

export function validateParametersV3(value: unknown): ParametersV3 {
  const p = exactObject(value, PARAMETER_NAMES_V3);
  for (const name of NUMERIC_NAMES_V3) {
    const number = p[name], rule = NUMERIC_RULES_V3[name];
    const integer = name === 'seed' || name === 'surfaceSeed' || name === 'spiralArms';
    if (typeof number !== 'number' || !Number.isFinite(number) || number < rule.min || number > rule.max ||
        (integer && !Number.isInteger(number))) {
      throw new DesignError('PARAMETER', `${rule.label} must be ${integer ? 'an integer' : 'a number'} from ${rule.min} to ${rule.max}.`, name);
    }
  }
  for (const name of BOOLEAN_NAMES_V3) {
    if (typeof p[name] !== 'boolean') throw new DesignError('PARAMETER', `${name} must be true or false.`, name);
  }
  if (!OUTLINES.some(v => v === p.outline)) throw new DesignError('PARAMETER', 'Choose a supported outline.', 'outline');
  if (!LAYOUTS.some(v => v === p.layout)) throw new DesignError('PARAMETER', 'Choose a supported layout.', 'layout');
  if (!SURFACE_FAMILIES.some(v => v === p.family)) throw new DesignError('PARAMETER', 'Choose a supported surface family.', 'family');
  if (!p.plinthEnabled && p.minimumRelief === 0 && p.depth === 0) {
    throw new DesignError('FEATURE_SIZE', 'A part without a plinth needs nonzero relief.', 'minimumRelief');
  }
  // Shape-dependent minima, clipping and actual work counters belong to the native
  // path. Parameter ranges alone cannot certify a printable part or fitting budget.
  return { ...p } as ParametersV3;
}

/** Validated footprint projection for existing lattice/partition helpers only.
 * Zero v2 relief is a placeholder; never send this projection to a part builder. */
export function layoutParametersV3(input: unknown): ParametersV2 {
  const p = validateParametersV3(input);
  return { width: p.width, height: p.height, pitch: p.pitch, gap: p.gap,
    baseThickness: p.baseThickness, reliefHeight: 0, topRatio: p.topRatio, seed: p.seed,
    outline: p.outline, layout: p.layout, straightBoundary: p.straightBoundary,
    engravingDepth: p.engravingDepth, numeralRatio: p.numeralRatio, orientationMark: p.orientationMark };
}
