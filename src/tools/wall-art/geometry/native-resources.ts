/** Reverse-order cleanup for mixed OCCT and Replicad wrappers in one native job. */
export type NativeResource = { delete(): void } | { [Symbol.dispose](): void };
export type OwnNative = <T extends NativeResource>(resource: T) => T;
export function nativeResources() {
  const resources: NativeResource[] = [];
  return {
    own<T extends NativeResource>(resource: T): T { resources.push(resource); return resource; },
    dispose() {
      for (const resource of resources.reverse()) {
        if (Symbol.dispose in resource) resource[Symbol.dispose](); else resource.delete();
      }
      resources.length = 0;
    },
  };
}
