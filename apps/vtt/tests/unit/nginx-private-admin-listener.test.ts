import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  describeLocation,
  type Directive,
  gatewayServers,
  listenPorts,
  selectLocation,
  serverLocations,
  serverOnPort,
  vttFile,
  walkDirectives,
} from './support/nginxConfig';

/**
 * Phase 1 of apps/docs/platform/private-admin-control-plane.md: the gateway
 * gains a private listener on :8081 for admin.internal.nexusvtt.com. Until
 * control-api authentication exists (Phase 2) it may serve only a static
 * placeholder and a liveness probe, must proxy to nothing, and must be
 * unreachable from the public :80 server whatever the Host header.
 *
 * Like the Phase 0 test, this asserts policy against the parsed config rather
 * than string snapshots. scripts/ci/gateway-route-matrix.sh exercises the same
 * policy against a running nginx.
 */
const PUBLIC_PORT = 80;
const PRIVATE_PORT = 8081;
const PLACEHOLDER_SOURCE = vttFile('docker', 'admin-placeholder');

const EXPECTED_CSP: Record<string, string[]> = {
  'default-src': ["'none'"],
  'img-src': ["'self'"],
  'style-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
};

const REQUIRED_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

/**
 * Every directive the private server may use. Anything new (proxy_pass,
 * fastcgi_pass, auth_request, alias, include, error_page, rewrite, ...) fails
 * here and forces a deliberate review of this allowlist.
 */
const ALLOWED_PRIVATE_DIRECTIVES = new Set([
  'listen',
  'server_name',
  'server_tokens',
  'root',
  'add_header',
  'if',
  'return',
  'location',
  'try_files',
  'access_log',
  'default_type',
]);

const privateServer = () => serverOnPort(PRIVATE_PORT);
const publicServer = () => serverOnPort(PUBLIC_PORT);
const directiveArg = (server: Directive, name: string) =>
  server.block?.find((d) => d.name === name)?.args[0];

const isInside = (child: string, parent: string) => {
  const relative = posix.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !posix.isAbsolute(relative))
  );
};

function parseCsp(value: string): Record<string, string[]> {
  return Object.fromEntries(
    value
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

describe('private admin listener (:8081)', () => {
  it('is a separate server block that shares no port with the public server', () => {
    expect(listenPorts(privateServer())).toEqual([PRIVATE_PORT, PRIVATE_PORT]);
    expect(listenPorts(publicServer())).not.toContain(PRIVATE_PORT);
    // nginx selects the server by listen socket before server_name, so as long
    // as :80 has exactly one server, no Host header can reach the private one.
    const onPublicPort = gatewayServers().filter((server) =>
      listenPorts(server).includes(PUBLIC_PORT),
    );
    expect(onPublicPort).toEqual([publicServer()]);
  });

  it('uses only allowlisted directives and proxies to nothing', () => {
    const names = [...walkDirectives(privateServer().block ?? [])].map(
      (d) => d.name,
    );
    const unexpected = names.filter(
      (name) => !ALLOWED_PRIVATE_DIRECTIVES.has(name),
    );
    expect(unexpected).toEqual([]);
    expect(
      names.some((name) => name.endsWith('_pass') || name === 'auth_request'),
    ).toBe(false);
  });

  it('serves from its own root, disjoint from the VTT root', () => {
    const privateRoot = directiveArg(privateServer(), 'root');
    const publicRoot = directiveArg(publicServer(), 'root');
    expect(privateRoot).toBe('/usr/share/nginx/admin-placeholder');
    expect(publicRoot).toBeDefined();
    expect(isInside(privateRoot as string, publicRoot as string)).toBe(false);
    expect(isInside(publicRoot as string, privateRoot as string)).toBe(false);
    // Only the server-level root: no location may re-point it.
    const roots = [...walkDirectives(privateServer().block ?? [])].filter(
      (d) => d.name === 'root',
    );
    expect(roots).toHaveLength(1);
  });

  it('declares the strict headers once, with `always`, where every response inherits them', () => {
    const server = privateServer();
    const headers = new Map(
      (server.block ?? [])
        .filter((d) => d.name === 'add_header')
        .map((d) => [d.args[0], d.args.slice(1)]),
    );

    const csp = headers.get('Content-Security-Policy');
    expect(csp?.[1]).toBe('always');
    expect(parseCsp(csp?.[0] ?? '')).toEqual(EXPECTED_CSP);
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(headers.get(name), name).toEqual([value, 'always']);
    }

    // add_header in a location or `if` drops everything the server declares,
    // which would strip these headers from that location's 200s and 404s.
    const nested = (server.block ?? [])
      .filter((d) => d.block)
      .flatMap((d) => [...walkDirectives(d.block ?? [])])
      .filter((d) => d.name === 'add_header');
    expect(nested).toEqual([]);
  });

  it('rejects every method except GET and HEAD', () => {
    const guard = privateServer().block?.find((d) => d.name === 'if');
    expect(guard?.args.slice(0, 2)).toEqual(['($request_method', '!~']);
    const pattern = new RegExp(guard?.args[2].replace(/\)$/, '') ?? '(?!)');
    for (const method of ['GET', 'HEAD'])
      expect(pattern.test(method), method).toBe(true);
    for (const method of [
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
      'GETX',
    ]) {
      expect(pattern.test(method), method).toBe(false);
    }
    expect(guard?.block).toEqual([{ name: 'return', args: ['405'] }]);
  });

  it('has exactly the placeholder, stylesheet, liveness and 404 locations', () => {
    expect(
      serverLocations(privateServer()).map(describeLocation).sort(),
    ).toEqual(
      [
        'location = /',
        'location = /healthz',
        'location = /placeholder.css',
        'location /',
      ].sort(),
    );
  });

  it('serves the placeholder page only from files in its own root', () => {
    const locations = serverLocations(privateServer());
    const home = selectLocation(locations, '/');
    const tryFiles = home.body.find((d) => d.name === 'try_files');
    expect(tryFiles?.args).toEqual(['/index.html', '=404']);
    expect(existsSync(`${PLACEHOLDER_SOURCE}/index.html`)).toBe(true);

    const stylesheet = selectLocation(locations, '/placeholder.css');
    expect(stylesheet.modifier).toBe('=');
    expect(stylesheet.body).toEqual([]);
    expect(existsSync(`${PLACEHOLDER_SOURCE}/placeholder.css`)).toBe(true);
  });

  it('answers liveness with a bare 200 and no detail', () => {
    const healthz = selectLocation(
      serverLocations(privateServer()),
      '/healthz',
    );
    expect(healthz.modifier).toBe('=');
    expect(healthz.body).toContainEqual({
      name: 'return',
      args: ['200', 'ok\n'],
    });
    expect(healthz.body).toContainEqual({
      name: 'default_type',
      args: ['text/plain'],
    });
    expect(healthz.body).toContainEqual({ name: 'access_log', args: ['off'] });
  });

  it.each([
    '/index.html',
    '/codex-admin',
    '/codex-admin/',
    '/codex-admin/index.html',
    '/api/admin/users',
    '/api/documents/bulk',
    '/api/campaigns',
    '/api',
    '/auth/session-check',
    '/control-api/status',
    '/codex-api/api/search/quick',
    '/codex-ws',
    '/codex-dm/',
    '/ws',
    '/socket.io/',
    '/assets/logo.png',
    '/library-assets/x',
    '/forge/',
    '/generator-hub/',
    '/health',
    '/healthz/',
    '/metrics',
    '/sw.js',
    '/config.js',
    '/favicon.ico',
  ])('returns 404 for %s', (uri) => {
    const location = selectLocation(serverLocations(privateServer()), uri);
    expect(location.body, `${uri} -> ${describeLocation(location)}`).toEqual([
      { name: 'return', args: ['404'] },
    ]);
  });
});

describe('public server (:80) never serves the private root', () => {
  it('has no root or alias pointing at the admin placeholder', () => {
    const privateRoot = directiveArg(privateServer(), 'root') as string;
    const paths = [...walkDirectives(publicServer().block ?? [])]
      .filter((d) => d.name === 'root' || d.name === 'alias')
      .map((d) => d.args[0]);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(isInside(path, privateRoot), path).toBe(false);
      expect(isInside(privateRoot, path), path).toBe(false);
    }
  });
});

describe('frontend image', () => {
  const productionStage = () => {
    const dockerfile = readFileSync(
      vttFile('docker', 'frontend.Dockerfile'),
      'utf8',
    );
    const start = dockerfile.search(/^FROM\s+\S+\s+AS\s+production\s*$/im);
    expect(start).toBeGreaterThanOrEqual(0);
    return dockerfile
      .slice(start)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('COPY '))
      .map((line) => {
        const parts = line.split(/\s+/).slice(1);
        const from = parts
          .find((p) => p.startsWith('--from='))
          ?.slice('--from='.length);
        const [source, destination] = parts.filter((p) => !p.startsWith('--'));
        return { from, source, destination };
      });
  };

  it('copies the placeholder, and nothing else, into the private root', () => {
    const privateRoot = directiveArg(privateServer(), 'root') as string;
    const intoPrivateRoot = productionStage().filter((copy) =>
      isInside(copy.destination, privateRoot),
    );
    expect(intoPrivateRoot).toEqual([
      {
        from: undefined,
        source: 'apps/vtt/docker/admin-placeholder',
        destination: privateRoot,
      },
    ]);
    expect(existsSync(PLACEHOLDER_SOURCE)).toBe(true);
  });

  it('still bundles the Codex Admin UI under the public root for Phase 2', () => {
    expect(productionStage()).toContainEqual({
      from: 'codex-admin-builder',
      source: '/workspace/apps/codex/services/admin-ui/dist',
      destination: '/usr/share/nginx/html/codex-admin',
    });
  });
});

describe('placeholder page', () => {
  const html = () => readFileSync(`${PLACEHOLDER_SOURCE}/index.html`, 'utf8');

  it('contains no script, inline style or event handler', () => {
    expect(html()).not.toMatch(/<script/i);
    expect(html()).not.toMatch(/<style/i);
    expect(html()).not.toMatch(/\sstyle\s*=/i);
    expect(html()).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('references only same-origin resources the private listener serves', () => {
    const references = [
      ...html().matchAll(/\s(?:href|src)\s*=\s*"([^"]*)"/gi),
    ].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    const locations = serverLocations(privateServer());
    for (const reference of references) {
      expect(reference, reference).toMatch(/^\/[^/]/);
      const location = selectLocation(locations, reference);
      expect(
        location.modifier,
        `${reference} -> ${describeLocation(location)}`,
      ).toBe('=');
      expect(existsSync(`${PLACEHOLDER_SOURCE}${reference}`), reference).toBe(
        true,
      );
    }
  });
});
