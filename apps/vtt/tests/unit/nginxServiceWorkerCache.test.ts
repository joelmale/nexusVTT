import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production service worker cache policy', () => {
  const nginxConfig = readFileSync(
    resolve(__dirname, '../../docker/nginx.conf'),
    'utf8',
  );
  const serviceWorkerLocation =
    /location = \/sw\.js \{([\s\S]*?)\n\s*\}/.exec(nginxConfig)?.[1] ?? '';

  it('prevents browsers and CDNs from retaining stale workers', () => {
    expect(serviceWorkerLocation).toContain('expires off;');
    expect(serviceWorkerLocation).toContain(
      'Cache-Control "no-store, no-cache, must-revalidate, max-age=0"',
    );
    expect(serviceWorkerLocation).toContain(
      'Cloudflare-CDN-Cache-Control "no-store"',
    );
    expect(serviceWorkerLocation).toContain('CDN-Cache-Control "no-store"');
  });
});
