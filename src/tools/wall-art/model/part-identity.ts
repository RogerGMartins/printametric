/** Version-independent lattice/component keys; never infer correspondence from array order. */
import { DesignError } from './budget.ts';
import { LIMITS_V2 } from './validation-v2.ts';
import type { BaseContour, ExcludedContour } from '../geometry/layout-metadata.ts';

type Identity = { id: string; mapNumber: number; cellKey?: string };

export function partTopologyKey(part: { id: string; cellKey?: string }): string {
  const legacy = /^wa-g1-r(0|[1-9]\d*)-c(0|[1-9]\d*)$/.exec(part.id);
  if (legacy) {
    if (![legacy[1], legacy[2]].every(value => Number.isSafeInteger(Number(value)))) throw new DesignError('IDENTITY', 'Invalid legacy lattice index.');
    return `s:${legacy[1]},${legacy[2]}:c0:i0`;
  }
  const match = /^wa-g[23]-(.+):c(0|[1-9]\d*):i(0|[1-9]\d*)$/.exec(part.id);
  if (!match || !part.cellKey || part.cellKey.length > 128 || match[1] !== part.cellKey ||
    ![match[2], match[3]].every(value => Number.isSafeInteger(Number(value))))
    throw new DesignError('IDENTITY', 'The part identity does not match its lattice/component key.');
  return `${part.cellKey}:c${match[2]}:i${match[3]}`;
}

/** Reuse immutable native partition data; only the returned record receives a v3 ID. */
export function surfaceContourIdentity<T extends BaseContour | ExcludedContour>(source: T): T {
  return { ...source, id: `wa-g3-${partTopologyKey(source)}` };
}

export function upgradePartCorrespondence(source: readonly Identity[], target: readonly Identity[]) {
  if (!source.length || source.length !== target.length || source.length > LIMITS_V2.parts)
    throw new DesignError('IDENTITY', 'Upgrade correspondence requires the same bounded set of retained parts.');
  const index = (parts: readonly Identity[]) => {
    const keys = new Map<string, Identity>(), numbers = new Set<number>();
    for (const part of parts) {
      const key = partTopologyKey(part);
      if (keys.has(key) || numbers.has(part.mapNumber) || !Number.isInteger(part.mapNumber) || part.mapNumber < 1 || part.mapNumber > LIMITS_V2.parts)
        throw new DesignError('IDENTITY', 'Upgrade parts have duplicate or invalid identities/numbers.');
      keys.set(key, part); numbers.add(part.mapNumber);
    }
    return keys;
  };
  const old = index(source), next = index(target);
  return [...old].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, previous]) => {
    const candidate = next.get(key);
    if (!candidate || !candidate.id.startsWith('wa-g3-')) throw new DesignError('IDENTITY', 'The upgrade changed a retained lattice/component identity.');
    return { key, sourceId: previous.id, targetId: candidate.id, sourceNumber: previous.mapNumber, targetNumber: candidate.mapNumber };
  });
}
