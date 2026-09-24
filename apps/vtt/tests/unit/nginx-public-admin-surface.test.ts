import { describe, expect, it } from 'vitest';

import {
  describeLocation,
  type Location,
  proxiedHosts,
  selectLocation,
  serverLocations,
  serverOnPort,
} from './support/nginxConfig';

/**
 * Phase 0 of apps/docs/platform/private-admin-control-plane.md: the public
 * gateway must not let a browser reach doc-api (AUTH_DISABLED=true) except
 * through the explicit, authenticated, read-only DM UI allowlist.
 *
 * Rather than snapshotting strings, this parses docker/nginx.conf into its
 * location blocks and replays nginx's location-selection algorithm for sample
 * request URIs, so reordering or reformatting the config does not break the
 * test but a policy regression does.
 */
// The public proxy host (app.nexusvtt.com) targets :80. The Phase 1 private
// listener is a separate server block on :8081; see
// nginx-private-admin-listener.test.ts.
const publicServerLocations = (): Location[] => serverLocations(serverOnPort(80));

const isDenied = (location: Location) =>
  location.body.some((d) => d.name === 'return' && d.args[0] === '404') &&
  !location.body.some((d) => d.name === 'proxy_pass' || d.name === 'try_files');

describe('public gateway admin-surface containment', () => {
  const locations = publicServerLocations();

  it('lets only the authenticated GET allowlist proxy to doc-api', () => {
    const docApiLocations = locations.filter((l) => proxiedHosts(l).includes('doc-api'));
    expect(docApiLocations.map(describeLocation)).toHaveLength(1);

    const [allowlist] = docApiLocations;
    expect(allowlist.modifier).toBe('~');
    expect(allowlist.pattern.startsWith('^/codex-api')).toBe(true);
    expect(allowlist.pattern.endsWith('$')).toBe(true);

    const limitExcept = allowlist.body.find((d) => d.name === 'limit_except');
    expect(limitExcept?.args).toEqual(['GET']);
    expect(limitExcept?.block).toEqual([{ name: 'deny', args: ['all'] }]);

    const authRequest = allowlist.body.find((d) => d.name === 'auth_request');
    expect(authRequest).toBeDefined();
    const authTarget = locations.find(
      (l) => l.modifier === '=' && l.pattern === authRequest?.args[0],
    );
    expect(authTarget?.body.some((d) => d.name === 'internal')).toBe(true);
    expect(proxiedHosts(authTarget as Location)).toEqual(['backend']);
    expect(
      authTarget?.body.some(
        (d) => d.name === 'proxy_pass_request_body' && d.args[0] === 'off',
      ),
    ).toBe(true);
  });

  it('has no generic /codex-api/ proxy', () => {
    const codexApiPrefixes = locations.filter(
      (l) => l.modifier !== '~' && l.modifier !== '~*' && l.pattern.startsWith('/codex-api'),
    );
    for (const location of codexApiPrefixes) {
      expect(isDenied(location), describeLocation(location)).toBe(true);
    }
  });

  it.each([
    '/codex-admin',
    '/codex-admin/',
    '/codex-admin/index.html',
    '/codex-admin/assets/index.js',
    '/api/admin/users',
    '/api/admin/elasticsearch/reindex',
    '/api/documents/bulk',
    '/api/documents/bulk/upload',
    '/api/documents/7f1c2d9e-0000-4000-8000-000000000000/process',
    '/api/deduplication/duplicates',
    '/api/processing/queue',
    '/api/references/abc',
    '/api/annotations/abc',
    '/codex-api/',
    '/codex-api/health',
    '/codex-api/api/admin/users',
    '/codex-api/api/documents',
    '/codex-api/api/documents/bulk/upload',
    '/codex-api/api/documents/abc/process',
    '/codex-api/api/structured-data/abc',
    '/codex-api/api/search',
    '/codex-api/api/deduplication/duplicates',
  ])('denies %s with an explicit 404', (uri) => {
    const location = selectLocation(locations, uri);
    expect(isDenied(location), `${uri} -> ${describeLocation(location)}`).toBe(true);
  });

  it.each([
    '/codex-api/api/search/quick',
    '/codex-api/api/structured-data',
    '/codex-api/api/documents/7f1c2d9e-0000-4000-8000-000000000000',
    '/codex-api/api/documents/7f1c2d9e-0000-4000-8000-000000000000/content',
  ])('routes DM UI read %s through the authenticated allowlist', (uri) => {
    const location = selectLocation(locations, uri);
    expect(proxiedHosts(location), `${uri} -> ${describeLocation(location)}`).toEqual([
      'doc-api',
    ]);
    expect(location.body.some((d) => d.name === 'auth_request')).toBe(true);
  });

  it.each([
    '/api/documents/7f1c2d9e-0000-4000-8000-000000000000',
    '/api/documents/7f1c2d9e-0000-4000-8000-000000000000/content',
    '/api/documents/7f1c2d9e-0000-4000-8000-000000000000/structured-data',
    '/api/search/quick',
    '/api/structured-data',
    '/api/campaigns',
    '/auth/session-check',
  ])('keeps VTT backend route %s on the backend', (uri) => {
    const location = selectLocation(locations, uri);
    expect(proxiedHosts(location), `${uri} -> ${describeLocation(location)}`).toEqual([
      'backend',
    ]);
  });

  it('keeps the inherited security headers on deny and allowlist locations', () => {
    // add_header in a location drops every header the server block sets.
    const policyLocations = locations.filter(
      (l) => isDenied(l) || proxiedHosts(l).includes('doc-api'),
    );
    expect(policyLocations.length).toBeGreaterThan(0);
    for (const location of policyLocations) {
      expect(
        location.body.some((d) => d.name === 'add_header'),
        describeLocation(location),
      ).toBe(false);
    }
  });
});
