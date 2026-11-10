/** Exact supported version pairs. This tool-local tag does not enter shared exporters. */
import { parameterDigest, type Parameters } from './parameters.ts';
import { PARAMETER_NAMES_V2, type ParametersV2 } from './parameters-v2.ts';
import { PARAMETER_NAMES_V3, type ParametersV3 } from './parameters-v3.ts';
import { validateParametersV3 } from './validation-v3.ts';
import { validateParameters } from './validation.ts';
import { validateParametersV2 } from './validation-v2.ts';
import { DesignError } from './budget.ts';
import { exactObject } from './validation.ts';

export type DesignDefinition = { modelSchemaVersion: 1; generatorVersion: 1; parameters: Parameters }
  | { modelSchemaVersion: 2; generatorVersion: 2; parameters: ParametersV2 }
  | { modelSchemaVersion: 3; generatorVersion: 3; parameters: ParametersV3 };

export function validateDesignDefinition(value: unknown): DesignDefinition {
  const d = exactObject(value, ['modelSchemaVersion', 'generatorVersion', 'parameters']);
  if (d.modelSchemaVersion === 1 && d.generatorVersion === 1) return { modelSchemaVersion: 1, generatorVersion: 1, parameters: validateParameters(d.parameters) };
  if (d.modelSchemaVersion === 2 && d.generatorVersion === 2) return { modelSchemaVersion: 2, generatorVersion: 2, parameters: validateParametersV2(d.parameters) };
  if (d.modelSchemaVersion === 3 && d.generatorVersion === 3) {
    const parameters = validateParametersV3(d.parameters);
    return { modelSchemaVersion: 3, generatorVersion: 3, parameters };
  }
  throw new DesignError('VERSION', 'Only wall-art model/generator pairs 1/1, 2/2 and 3/3 are supported.');
}

export function definitionDigest(definition: DesignDefinition): string {
  const d = validateDesignDefinition(definition);
  if (d.generatorVersion === 1) return parameterDigest(d.parameters);
  if (d.generatorVersion === 2) return `wa-2-2:${PARAMETER_NAMES_V2.map(name => d.parameters[name]).join(',')}`;
  return `wa-3-3:${PARAMETER_NAMES_V3.map(name => d.parameters[name]).join(',')}`;
}
