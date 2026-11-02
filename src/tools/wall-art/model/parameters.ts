/** Model schema 1 / generator 1. All lengths are millimeters; steps are UI hints. */
export const PARAMETER_RULES = {
  width: { label: 'Panel width', min: 80, max: 500, step: 10, unit: 'mm' },
  height: { label: 'Panel height', min: 80, max: 500, step: 10, unit: 'mm' },
  pitch: { label: 'Cell pitch', min: 50, max: 200, step: 1, unit: 'mm' },
  gap: { label: 'Gap', min: 2.5, max: 6, step: 0.1, unit: 'mm' },
  baseThickness: { label: 'Base thickness', min: 10, max: 40, step: 0.2, unit: 'mm' },
  reliefHeight: { label: 'Relief height', min: 0, max: 120, step: 1, unit: 'mm' },
  topRatio: { label: 'Top width ratio', min: 0.1, max: 1, step: 0.01, unit: 'ratio' },
  seed: { label: 'Seed', min: 1, max: 9999, step: 1, unit: '' },
} as const;
export type ParameterName = keyof typeof PARAMETER_RULES;
export type Parameters = Record<ParameterName, number>;
export const PARAMETER_NAMES = Object.keys(PARAMETER_RULES) as ParameterName[];
export const DEFAULT_PARAMETERS: Readonly<Parameters> = Object.freeze({
  width: 500, height: 500, pitch: 50, gap: 2.5, baseThickness: 10,
  reliefHeight: 20, topRatio: 0.12, seed: 1,
});

/** A canonical, inspectable digest, not a security hash. Order is versioned. */
export function parameterDigest(parameters: Parameters): string {
  return `wa-1-1:${PARAMETER_NAMES.map(name => parameters[name]).join(',')}`;
}
