/** Parameter proposals only: generation and one explicit confirmation own acceptance. */
import { DEFAULT_PARAMETERS_V3 } from './parameters-v3.ts';
import { validateDesignDefinition, type DesignDefinition } from './definition.ts';
import { proposeUpgrade } from './migrate-v1.ts';
import { DesignError } from './budget.ts';

export function proposeUpgradeV3(input: unknown): Extract<DesignDefinition, { generatorVersion: 3 }> {
  const source = validateDesignDefinition(input);
  if (source.generatorVersion === 3) throw new DesignError('VERSION', 'This design already uses generator 3.');
  const { reliefHeight, ...parameters } = source.generatorVersion === 1
    ? proposeUpgrade(source.parameters).parameters : source.parameters;
  const candidate = { ...DEFAULT_PARAMETERS_V3, ...parameters, minimumRelief: reliefHeight,
    depth: 0, concavity: 1, plinthEnabled: true };
  const validated = validateDesignDefinition({ modelSchemaVersion: 3, generatorVersion: 3, parameters: candidate });
  if (validated.generatorVersion !== 3) throw new DesignError('VERSION', 'Invalid upgrade target.');
  return validated;
}
