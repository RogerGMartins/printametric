/** P0 checkpoint parameters, not a registered saved-file/generator version.
 * Lengths are millimeters. Curvature numbers remain provisional through P2. */
import { DEFAULT_PARAMETERS_V2, NUMERIC_RULES_V2, type ParametersV2 } from './parameters-v2.ts';

export const SURFACE_FAMILIES = ['wave', 'dunes', 'ring', 'dome', 'spiral', 'ridges', 'random'] as const;
export type SurfaceFamily = typeof SURFACE_FAMILIES[number];
export type ParametersV3 = Omit<ParametersV2, 'reliefHeight'> & {
  minimumRelief: number; stepBlend: number; planarTops: boolean; concavity: number;
  plinthEnabled: boolean; family: SurfaceFamily; depth: number; density: number;
  rotation: number; phase: number; spiralArms: number; surfaceSeed: number;
};

// Explicit keys prevent a later v2 field from silently changing this contract.
export const NUMERIC_RULES_V3 = {
  width: NUMERIC_RULES_V2.width, height: NUMERIC_RULES_V2.height,
  pitch: NUMERIC_RULES_V2.pitch, gap: NUMERIC_RULES_V2.gap,
  baseThickness: NUMERIC_RULES_V2.baseThickness,
  topRatio: { ...NUMERIC_RULES_V2.topRatio, label: 'Top size' },
  seed: { ...NUMERIC_RULES_V2.seed, label: 'Layout seed' },
  engravingDepth: NUMERIC_RULES_V2.engravingDepth, numeralRatio: NUMERIC_RULES_V2.numeralRatio,
  minimumRelief: { label: 'Minimum relief', min: 0, max: 120, step: 1, unit: 'mm' },
  stepBlend: { label: 'Top blend', min: 0, max: 1, step: 0.01, unit: 'ratio' },
  concavity: { label: 'Side curvature (provisional)', min: 1, max: 4, step: 0.1, unit: '' },
  depth: { label: 'Surface amplitude', min: 0, max: 200, step: 1, unit: 'mm' },
  density: { label: 'Pattern density', min: 0.2, max: 12, step: 0.1, unit: '' },
  rotation: { label: 'Surface rotation', min: 0, max: 360, step: 1, unit: 'degrees' },
  phase: { label: 'Surface phase', min: 0, max: 1, step: 0.01, unit: 'cycle' },
  spiralArms: { label: 'Spiral arms', min: 1, max: 16, step: 1, unit: '' },
  surfaceSeed: { label: 'Surface seed', min: 1, max: 9999, step: 1, unit: '' },
} as const;
export type NumericNameV3 = keyof typeof NUMERIC_RULES_V3;
export const NUMERIC_NAMES_V3 = Object.keys(NUMERIC_RULES_V3) as NumericNameV3[];
export const BOOLEAN_NAMES_V3 = ['straightBoundary', 'orientationMark', 'planarTops', 'plinthEnabled'] as const;
export const PARAMETER_NAMES_V3 = [...NUMERIC_NAMES_V3, ...BOOLEAN_NAMES_V3, 'outline', 'layout', 'family'] as const;
const { reliefHeight: minimumRelief, ...inherited } = DEFAULT_PARAMETERS_V2;
export const DEFAULT_PARAMETERS_V3: Readonly<ParametersV3> = Object.freeze({
  ...inherited, minimumRelief, stepBlend: 1, planarTops: false, concavity: 2.2,
  plinthEnabled: true, family: 'wave', depth: 30, density: 2, rotation: 0,
  phase: 0, spiralArms: 5, surfaceSeed: 1,
});
