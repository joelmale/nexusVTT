/**
 * Minimal RFC 6902 diff used to compare two revisions of a rules entity.
 * Objects are compared key by key; arrays index by index (trailing removals
 * are emitted from the end so the patch applies in order).
 */

export type JsonPatchOperation =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown };

function escapePointerSegment(segment: string | number): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => key in right && sameJson(left[key], right[key]))
    );
  }
  return false;
}

function diffInto(
  from: unknown,
  to: unknown,
  path: string,
  operations: JsonPatchOperation[],
): void {
  if (sameJson(from, to)) return;

  if (isPlainObject(from) && isPlainObject(to)) {
    const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
    for (const key of [...keys].sort()) {
      const childPath = `${path}/${escapePointerSegment(key)}`;
      const hasFrom = from[key] !== undefined;
      const hasTo = to[key] !== undefined;
      if (hasFrom && !hasTo) operations.push({ op: 'remove', path: childPath });
      else if (!hasFrom && hasTo) operations.push({ op: 'add', path: childPath, value: to[key] });
      else if (hasFrom && hasTo) diffInto(from[key], to[key], childPath, operations);
    }
    return;
  }

  if (Array.isArray(from) && Array.isArray(to)) {
    const shared = Math.min(from.length, to.length);
    for (let index = 0; index < shared; index += 1) {
      diffInto(from[index], to[index], `${path}/${index}`, operations);
    }
    for (let index = shared; index < to.length; index += 1) {
      operations.push({ op: 'add', path: `${path}/${index}`, value: to[index] });
    }
    for (let index = from.length - 1; index >= shared; index -= 1) {
      operations.push({ op: 'remove', path: `${path}/${index}` });
    }
    return;
  }

  operations.push({ op: 'replace', path, value: to });
}

/** Produce the RFC 6902 operations that transform `from` into `to`. */
export function diffJson(from: unknown, to: unknown): JsonPatchOperation[] {
  const operations: JsonPatchOperation[] = [];
  diffInto(from, to, '', operations);
  return operations;
}
