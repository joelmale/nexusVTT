import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

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
const repoFile = (...parts: string[]) => resolve(__dirname, '..', '..', ...parts);

interface Directive {
  name: string;
  args: string[];
  block?: Directive[];
}

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i += 1;
    } else if (char === '#') {
      while (i < source.length && source[i] !== '\n') i += 1;
    } else if (char === '{' || char === '}' || char === ';') {
      tokens.push(char);
      i += 1;
    } else if (char === '"' || char === "'") {
      let value = '';
      i += 1;
      while (i < source.length && source[i] !== char) {
        if (source[i] === '\\') i += 1;
        value += source[i];
        i += 1;
      }
      i += 1;
      tokens.push(value);
    } else {
      let value = '';
      while (i < source.length && !/[\s{};]/.test(source[i])) {
        value += source[i];
        i += 1;
      }
      tokens.push(value);
    }
  }
  return tokens;
}

function parse(tokens: string[], start = 0): { directives: Directive[]; end: number } {
  const directives: Directive[] = [];
  let i = start;
  while (i < tokens.length && tokens[i] !== '}') {
    const name = tokens[i];
    const args: string[] = [];
    i += 1;
    while (tokens[i] !== ';' && tokens[i] !== '{') {
      args.push(tokens[i]);
      i += 1;
    }
    if (tokens[i] === '{') {
      const inner = parse(tokens, i + 1);
      directives.push({ name, args, block: inner.directives });
      i = inner.end + 1;
    } else {
      directives.push({ name, args });
      i += 1;
    }
  }
  return { directives, end: i };
}

interface Location {
  modifier: '' | '=' | '^~' | '~' | '~*';
  pattern: string;
  body: Directive[];
}

function publicServerLocations(): Location[] {
  const { directives } = parse(
    tokenize(readFileSync(repoFile('docker', 'nginx.conf'), 'utf8')),
  );
  const http = directives.find((d) => d.name === 'http');
  const servers = http?.block?.filter((d) => d.name === 'server') ?? [];
  // Phase 1 adds a private vhost; the public one is the catch-all server_name.
  const publicServer = servers.find((server) =>
    server.block?.some((d) => d.name === 'server_name' && d.args.includes('_')),
  );
  if (!publicServer?.block) throw new Error('public server block not found');
  return publicServer.block
    .filter((d) => d.name === 'location')
    .map((d) => {
      const [first, second] = d.args;
      const modifier = d.args.length === 2 ? (first as Location['modifier']) : '';
      return {
        modifier,
        pattern: d.args.length === 2 ? second : first,
        body: d.block ?? [],
      };
    });
}

/** nginx location selection for non-nested, non-named locations. */
function selectLocation(locations: Location[], uri: string): Location {
  const exact = locations.find((l) => l.modifier === '=' && l.pattern === uri);
  if (exact) return exact;
  const prefixes = locations
    .filter((l) => (l.modifier === '' || l.modifier === '^~') && uri.startsWith(l.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length);
  const longest = prefixes[0];
  if (longest?.modifier !== '^~') {
    const regex = locations.find(
      (l) =>
        (l.modifier === '~' || l.modifier === '~*') &&
        new RegExp(l.pattern, l.modifier === '~*' ? 'i' : '').test(uri),
    );
    if (regex) return regex;
  }
  if (!longest) throw new Error(`no location matches ${uri}`);
  return longest;
}

function describeLocation(location: Location): string {
  return `location ${location.modifier} ${location.pattern}`.replace(/\s+/g, ' ');
}

/** Upstream hosts this location proxies to, with `set` variables resolved. */
function proxiedHosts(location: Location): string[] {
  const variables = new Map<string, string>();
  for (const d of location.body) {
    if (d.name === 'set') variables.set(d.args[0], d.args[1]);
  }
  return location.body
    .filter((d) => d.name === 'proxy_pass')
    .map((d) =>
      d.args[0].replace(/\$[A-Za-z_]+/g, (name) => variables.get(name) ?? name),
    )
    .map((target) => target.match(/^https?:\/\/([^/:$]+)/)?.[1] ?? target);
}

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
