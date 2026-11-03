/** Strict external boundary, shared by the editor, files and worker. No CAD imports. */
import { PARAMETER_NAMES, PARAMETER_RULES, type Parameters } from './parameters.ts';
import { DesignError, estimateDesign, LIMITS } from './budget.ts';

export function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new DesignError('OBJECT', 'Expected a plain design object.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== keys.length ||
      keys.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key]!, 'value'))) {
    throw new DesignError('FIELDS', 'The design has missing, unknown or unsupported fields.');
  }
  return value as Record<string, unknown>;
}

export function validateParameters(value: unknown, cap = LIMITS.parts): Parameters {
  const object = exactObject(value, PARAMETER_NAMES);
  const result = {} as Parameters;
  for (const name of PARAMETER_NAMES) {
    const number = object[name], rule = PARAMETER_RULES[name];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < rule.min || number > rule.max ||
        (name === 'seed' && !Number.isInteger(number))) {
      throw new DesignError('PARAMETER', `${rule.label} must be ${name === 'seed' ? 'an integer' : 'a number'} from ${rule.min} to ${rule.max}${rule.unit ? ` ${rule.unit}` : ''}.`, name);
    }
    result[name] = number;
  }
  estimateDesign(result, cap);
  return result;
}
