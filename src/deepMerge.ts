function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = clone(value[key]);
  return out;
}

/**
 * Recursively merges `sources` into a new object, left to right.
 *
 * Plain objects merge key by key; everything else (arrays, class instances,
 * primitives) is replaced by the rightmost value. Sources are never mutated and
 * their nested objects are cloned, so the result shares no references with them
 * — important because Redux Toolkit freezes state in development.
 */
export function deepMerge<T extends object>(...sources: Array<object | undefined>): T {
  const target: Record<string, unknown> = {};

  for (const source of sources) {
    if (!source) continue;

    for (const key of Object.keys(source)) {
      const nextValue = (source as Record<string, unknown>)[key];
      const currentValue = target[key];

      // An explicit `undefined` seeds a missing key but never clobbers a value.
      if (nextValue === undefined) {
        if (!(key in target)) target[key] = undefined;
        continue;
      }

      target[key] =
        isPlainObject(currentValue) && isPlainObject(nextValue)
          ? deepMerge(currentValue, nextValue)
          : clone(nextValue);
    }
  }

  return target as T;
}
