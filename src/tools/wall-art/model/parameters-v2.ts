/** Model schema 2 / generator 2. Lengths are millimeters; inactive keys stay present. */
import { DEFAULT_PARAMETERS, PARAMETER_RULES, type Parameters } from './parameters.ts';

export const OUTLINES = ['rectangle', 'ellipse', 'hexagon', 'arch'] as const;
export const LAYOUTS = ['irregular', 'hexagonal', 'square', 'triangular', 'radial'] as const;
export type Outline = typeof OUTLINES[number];
export type Layout = typeof LAYOUTS[number];
export const NUMERIC_RULES_V2 = {
  ...PARAMETER_RULES,
  width: { ...PARAMETER_RULES.width, max: 2000 },
  height: { ...PARAMETER_RULES.height, max: 2000 },
  engravingDepth: { label: 'Engraving depth', min: 0, max: 3, step: 0.05, unit: 'mm' },
  numeralRatio: { label: 'Numeral height ratio', min: 0.1, max: 0.6, step: 0.01, unit: 'ratio' },
} as const;
export type NumericNameV2 = keyof typeof NUMERIC_RULES_V2;
export const NUMERIC_NAMES_V2 = Object.keys(NUMERIC_RULES_V2) as NumericNameV2[];
export type ParametersV2 = Parameters & { outline: Outline; layout: Layout;
  straightBoundary: boolean; engravingDepth: number; numeralRatio: number; orientationMark: boolean };
export const PARAMETER_NAMES_V2 = [...NUMERIC_NAMES_V2, 'outline', 'layout', 'straightBoundary', 'orientationMark'] as const;
export const DEFAULT_PARAMETERS_V2: Readonly<ParametersV2> = Object.freeze({ ...DEFAULT_PARAMETERS,
  outline: 'rectangle', layout: 'square', straightBoundary: true,
  engravingDepth: 1, numeralRatio: 0.34, orientationMark: true });
export const SIZE_SHORTCUTS = [[300, 300], [500, 500], [800, 600], [1000, 1000]] as const;
