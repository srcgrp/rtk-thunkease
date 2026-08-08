import { describe, expect, it } from 'vitest';

import { deepMerge } from './deepMerge';

describe('deepMerge', () => {
  it('merges plain objects key by key, rightmost winning', () => {
    expect(deepMerge({ a: 1, b: { c: 1, d: 1 } }, { b: { d: 2, e: 2 } })).toEqual({
      a: 1,
      b: { c: 1, d: 2, e: 2 }
    });
  });

  it('replaces arrays instead of merging them index-wise', () => {
    expect(deepMerge({ items: [1, 2, 3] }, { items: [9] })).toEqual({ items: [9] });
  });

  it('lets an explicit undefined seed a missing key but never clobber a value', () => {
    expect(deepMerge({ a: 1 }, { a: undefined, b: undefined })).toEqual({ a: 1, b: undefined });
    expect('b' in deepMerge({}, { b: undefined })).toBe(true);
  });

  it('skips undefined sources', () => {
    expect(deepMerge(undefined, { a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('shares no references with its sources', () => {
    const source = { nested: { list: [{ deep: 1 }] } };
    const merged = deepMerge<typeof source>(source);

    expect(merged).toEqual(source);
    expect(merged.nested).not.toBe(source.nested);
    expect(merged.nested.list).not.toBe(source.nested.list);
    expect(merged.nested.list[0]).not.toBe(source.nested.list[0]);
  });

  it('passes class instances through by reference rather than merging them', () => {
    const date = new Date('2020-01-01');
    const merged = deepMerge<{ at: Date }>({ at: date });

    expect(merged.at).toBe(date);
  });
});
