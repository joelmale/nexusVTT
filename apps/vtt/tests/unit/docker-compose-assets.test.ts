import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoFile = (...parts: string[]) => resolve(__dirname, '..', '..', ...parts);

describe('production frontend asset routing', () => {
  it('does not mask the built /assets directory with the persistent asset volume', () => {
    const compose = readFileSync(
      repoFile('docker', 'docker-compose.yml'),
      'utf8',
    );

    expect(compose).not.toContain('/usr/share/nginx/html/assets');
  });
});
