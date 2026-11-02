/** Draft text is separate from accepted numeric parameters. Empty input is never zero. */
import { PARAMETER_NAMES, type ParameterName, type Parameters } from '../model/parameters.ts';
import { validateParameters } from '../model/validation.ts';
import { DesignError } from '../model/budget.ts';
export type Drafts = Record<ParameterName, string>;
export function toDrafts(parameters: Parameters): Drafts {
  return Object.fromEntries(PARAMETER_NAMES.map(name => [name, String(parameters[name])])) as Drafts;
}
export function parseDrafts(drafts: Drafts): Parameters {
  const values = {} as Parameters;
  for (const name of PARAMETER_NAMES) {
    if (!drafts[name].trim()) throw new DesignError('REQUIRED', 'Enter a number.', name);
    values[name] = Number(drafts[name]);
  }
  return validateParameters(values);
}
