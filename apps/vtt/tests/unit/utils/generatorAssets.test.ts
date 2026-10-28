import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fromHere = (path: string) => new URL(path, import.meta.url);

describe('generator assets', () => {
  it('vendors the One-Page Dungeon generator only inside the generator hub', () => {
    // A second copy under public/ drifted from the hub's and was never served;
    // the hub mount (/generator-hub/) is the only supported entry point.
    expect(existsSync(fromHere('../../../public/one-page-dungeon'))).toBe(
      false,
    );
    expect(
      existsSync(
        fromHere(
          '../../../apps/generator-hub/public/one-page-dungeon/index.html',
        ),
      ),
    ).toBe(true);
  });
});
