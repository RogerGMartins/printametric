/** Versioned editable definitions only. Geometry is always regenerated and validated. */
import { PARAMETER_NAMES, type Parameters } from './parameters.ts';
import { DesignError, LIMITS } from './budget.ts';
import { exactObject, validateParameters } from './validation.ts';

const envelopeKeys = ['format', 'formatVersion', 'modelSchemaVersion', 'generatorVersion', 'seed', 'parameters'];
const geometryKeys = PARAMETER_NAMES.filter(name => name !== 'seed');

export function validateDefinition(value: unknown): Parameters {
  const object = exactObject(value, envelopeKeys);
  if (object.format !== 'printametric-wall-art' || object.formatVersion !== 1 ||
      object.modelSchemaVersion !== 1 || object.generatorVersion !== 1) {
    throw new DesignError('VERSION', 'Only wall-art format 1, model schema 1 and generator 1 are supported.');
  }
  const parameters = exactObject(object.parameters, geometryKeys);
  return validateParameters({ ...parameters, seed: object.seed });
}

export function parseDesign(bytes: Uint8Array): Parameters {
  if (bytes.byteLength > LIMITS.fileBytes) throw new DesignError('FILE_SIZE', 'The design file exceeds 1 MiB.');
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new DesignError('JSON', 'The file must contain complete UTF-8 JSON.'); }
  const inspect = (node: unknown, depth: number): void => {
    if (depth > LIMITS.depth) throw new DesignError('DEPTH', 'The file exceeds the nesting limit of 16.');
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new DesignError('UNSAFE_KEY', 'The file contains an unsupported object key.');
      inspect(child, depth + 1);
    }
  };
  inspect(value, 0);
  return validateDefinition(value);
}

export function serializeDesign(value: Parameters): Uint8Array<ArrayBuffer> {
  const { seed, ...parameters } = validateParameters(value);
  return new TextEncoder().encode(JSON.stringify({ format: 'printametric-wall-art', formatVersion: 1,
    modelSchemaVersion: 1, generatorVersion: 1, seed, parameters }, null, 2) + '\n');
}
