/** A candidate only: the caller must generate, preview and explicitly confirm it. */
import { validateParameters } from './validation.ts';
import type { DesignDefinition } from './definition.ts';

export function proposeUpgrade(parameters: unknown): Extract<DesignDefinition, { generatorVersion: 2 }> {
  return { modelSchemaVersion: 2, generatorVersion: 2, parameters: {
    ...validateParameters(parameters), outline: 'rectangle', layout: 'square', straightBoundary: true,
    engravingDepth: 0, numeralRatio: 0.34, orientationMark: false,
  } };
}
