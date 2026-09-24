import { describe, expect, it } from 'vitest';
import { diffJson, type JsonPatchOperation } from './jsonPatch';

/** Tiny RFC 6902 applier used only to prove diffs round-trip. */
function applyPatch(document: unknown, operations: JsonPatchOperation[]): unknown {
  let root = structuredClone(document);
  for (const operation of operations) {
    if (operation.path === '') {
      root = structuredClone((operation as { value: unknown }).value);
      continue;
    }
    const segments = operation.path
      .slice(1)
      .split('/')
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    const last = segments.pop() as string;
    let parent = root as Record<string, unknown> | unknown[];
    for (const segment of segments) {
      parent = (parent as Record<string, unknown>)[segment] as Record<string, unknown>;
    }
    if (Array.isArray(parent)) {
      const index = Number(last);
      if (operation.op === 'add') parent.splice(index, 0, operation.value);
      else if (operation.op === 'remove') parent.splice(index, 1);
      else parent[index] = operation.value;
    } else if (operation.op === 'remove') {
      delete parent[last];
    } else {
      parent[last] = operation.value;
    }
  }
  return root;
}

describe('diffJson', () => {
  it('returns no operations for equal documents', () => {
    expect(diffJson({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([]);
  });

  it('emits add, remove and replace with escaped pointers', () => {
    expect(diffJson({ a: 1, 'x/y': 1, gone: true }, { a: 2, 'x/y': 2, 'n~ew': 3 })).toEqual([
      { op: 'replace', path: '/a', value: 2 },
      { op: 'remove', path: '/gone' },
      { op: 'add', path: '/n~0ew', value: 3 },
      { op: 'replace', path: '/x~1y', value: 2 },
    ]);
  });

  it('diffs arrays by index and removes trailing items from the end', () => {
    const operations = diffJson({ list: [1, 2, 3, 4] }, { list: [1, 5] });
    expect(operations).toEqual([
      { op: 'replace', path: '/list/1', value: 5 },
      { op: 'remove', path: '/list/3' },
      { op: 'remove', path: '/list/2' },
    ]);
  });

  it.each([
    [{ a: 1 }, { a: { nested: [1, 2] } }],
    [{ list: [1] }, { list: [1, 2, 3] }],
    [{ list: [{ n: 1 }, { n: 2 }] }, { list: [{ n: 3 }] }],
    [[1, 2], { replaced: true }],
    [{ level: 3, classes: ['wizard'] }, { level: 4, classes: ['sorcerer', 'wizard'], ritual: true }],
  ])('round-trips %j -> %j', (from, to) => {
    expect(applyPatch(from, diffJson(from, to))).toEqual(to);
  });
});
