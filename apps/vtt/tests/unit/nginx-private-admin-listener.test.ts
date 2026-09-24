import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  describeLocation,
  type Directive,
  gatewayServers,
  listenPorts,
  namedLocations,
  proxiedHosts,
  selectLocation,
  serverLocations,
  serverOnPort,
  serverProxiedHosts,
  vttFile,
  walkDirectives,
} from './support/nginxConfig';

/**
 * The private listener on :8081 for admin.internal.nexusvtt.com
 * (apps/docs/platform/private-admin-control-plane.md, Phase 2; contract in
 * apps/docs/platform/control-api-adr.md). It serves the Codex Admin UI build
 * from its own root, a liveness probe, and exactly one upstream: control-api,
 * under /control-api/ only. It must never reach doc-api, the VTT backend, the
 * asset server or any other internal API, and must be unreachable from the
 * public :80 server whatever the Host header.
 *
 * Like the Phase 0 test, this asserts policy against the parsed config rather
 * than string snapshots. scripts/ci/gateway-route-matrix.sh exercises the same
 * policy against a running nginx.
 */
const PUBLIC_PORT = 80;
const PRIVATE_PORT = 8081;
const ADMIN_UI_ROOT = '/usr/share/nginx/admin-ui';
const CONTROL_API = 'control-api';
const CONTROL_API_UPSTREAM = 'http://control-api:4000';

const EXPECTED_CSP: Record<string, string[]> = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
};

const REQUIRED_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': '$admin_cache_control',
};

/**
 * Every directive the private server may use. Anything new (fastcgi_pass,
 * auth_request, alias, include, error_page, rewrite, ...) fails here and
 * forces a deliberate review of this allowlist. proxy_pass is allowed only in
 * the /control-api/ location (asserted below).
 */
const ALLOWED_PRIVATE_DIRECTIVES = new Set([
  'listen',
  'server_name',
  'server_tokens',
  'set_real_ip_from',
  'real_ip_header',
  'resolver',
  'root',
  'add_header',
  'set',
  'if',
  'return',
  'location',
  'try_files',
  'access_log',
  'default_type',
  'proxy_pass',
  'proxy_http_version',
  'proxy_set_header',
  'proxy_hide_header',
  'proxy_request_buffering',
  'proxy_read_timeout',
  'proxy_send_timeout',
  'client_max_body_size',
]);

const privateServer = () => serverOnPort(PRIVATE_PORT);
const publicServer = () => serverOnPort(PUBLIC_PORT);
const privateLocations = () => serverLocations(privateServer());
const controlApiLocation = () =>
  selectLocation(privateLocations(), '/control-api/v1/me');
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

/** Value a `set $name` gives inside a location body (or undefined). */
const setValue = (body: Directive[], name: string) =>
  body.find((d) => d.name === 'set' && d.args[0] === name)?.args[1];

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

  it('uses only allowlisted directives', () => {
    const names = [...walkDirectives(privateServer().block ?? [])].map(
      (d) => d.name,
    );
    const unexpected = names.filter(
      (name) => !ALLOWED_PRIVATE_DIRECTIVES.has(name),
    );
    expect(unexpected).toEqual([]);
    expect(names).not.toContain('auth_request');
  });

  it('proxies to exactly one upstream, control-api, and only under /control-api/', () => {
    expect(serverProxiedHosts(privateServer())).toEqual([CONTROL_API]);

    const proxying = [
      ...privateLocations(),
      ...namedLocations(privateServer()),
    ].filter((l) => l.body.some((d) => d.name.endsWith('_pass')));
    expect(proxying.map(describeLocation)).toEqual([
      'location ^~ /control-api/',
    ]);

    // Nothing outside a location may proxy either.
    const serverLevel = (privateServer().block ?? []).filter(
      (d) => d.name !== 'location',
    );
    const nested = [...walkDirectives(serverLevel)].map((d) => d.name);
    expect(nested.filter((name) => name.endsWith('_pass'))).toEqual([]);
  });

  it.each([
    '/api/admin/x',
    '/api/documents/bulk',
    '/codex-api/api/search/quick',
    '/codex-admin/',
    '/ws',
    '/socket.io/',
    '/auth/session-check',
    '/assets/index.js',
    '/',
    '/documents',
    '/control-api',
    '/Control-Api/v1/me',
  ])('does not proxy %s', (uri) => {
    const location = selectLocation(privateLocations(), uri);
    expect(proxiedHosts(location), `${uri} -> ${describeLocation(location)}`).toEqual(
      [],
    );
  });

  it('forwards /control-api/ unchanged to control-api:4000 through the resolver', () => {
    const location = controlApiLocation();
    expect(describeLocation(location)).toBe('location ^~ /control-api/');
    expect(proxiedHosts(location)).toEqual([CONTROL_API]);
    // Variable upstream, no URI part: nginx starts without control-api and
    // forwards the client's request URI as-is.
    const proxyPass = location.body.find((d) => d.name === 'proxy_pass');
    expect(proxyPass?.args).toEqual(['$control_api']);
    expect(setValue(location.body, '$control_api')).toBe(CONTROL_API_UPSTREAM);
    expect(directiveArg(privateServer(), 'resolver')).toBe('127.0.0.11');
  });

  it('sets the client address, scheme, request id and cookie for control-api', () => {
    const headers = new Map(
      controlApiLocation()
        .body.filter((d) => d.name === 'proxy_set_header')
        .map((d) => [d.args[0], d.args[1]]),
    );
    expect(headers.get('Host')).toBe('$host');
    // Overwritten, never appended: a client-sent X-Forwarded-For is dropped.
    expect(headers.get('X-Forwarded-For')).toBe('$remote_addr');
    expect(headers.get('X-Forwarded-Proto')).toBe('https');
    expect(headers.get('X-Request-Id')).toBe('$request_id');
    expect(headers.get('Cookie')).toBe('$http_cookie');
  });

  it('accepts bulk uploads up to the control-api cap and streams them', () => {
    const body = controlApiLocation().body;
    expect(body).toContainEqual({ name: 'client_max_body_size', args: ['200m'] });
    expect(body).toContainEqual({ name: 'proxy_request_buffering', args: ['off'] });
    // Everywhere else keeps nginx's small default.
    const elsewhere = [...walkDirectives(privateServer().block ?? [])].filter(
      (d) => d.name === 'client_max_body_size',
    );
    expect(elsewhere).toHaveLength(1);
  });

  it('serves the Admin UI from its own root, disjoint from the VTT root', () => {
    const privateRoot = directiveArg(privateServer(), 'root');
    const publicRoot = directiveArg(publicServer(), 'root');
    expect(privateRoot).toBe(ADMIN_UI_ROOT);
    expect(publicRoot).toBeDefined();
    expect(isInside(privateRoot as string, publicRoot as string)).toBe(false);
    expect(isInside(publicRoot as string, privateRoot as string)).toBe(false);
    // Only the server-level root: no location may re-point it.
    const roots = [...walkDirectives(privateServer().block ?? [])].filter(
      (d) => d.name === 'root' || d.name === 'alias',
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
    expect(csp?.[0]).not.toContain('unsafe-');
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

  it('caches only hashed assets; everything else, including a missing asset, is no-store', () => {
    const server = privateServer();
    expect(setValue(server.block ?? [], '$admin_cache_control')).toBe('no-store');

    const assets = selectLocation(privateLocations(), '/assets/index-abc.js');
    expect(describeLocation(assets)).toBe('location ^~ /assets/');
    expect(setValue(assets.body, '$admin_cache_control')).toBe(
      'public, max-age=31536000, immutable',
    );
    const tryFiles = assets.body.find((d) => d.name === 'try_files');
    expect(tryFiles?.args).toEqual(['$uri', '@admin_asset_missing']);

    const [missing] = namedLocations(server);
    expect(missing.pattern).toBe('@admin_asset_missing');
    expect(setValue(missing.body, '$admin_cache_control')).toBe('no-store');
    expect(missing.body).toContainEqual({ name: 'return', args: ['404'] });

    // No other location may widen caching.
    const others = privateLocations().filter(
      (l) => describeLocation(l) !== describeLocation(assets),
    );
    expect(others).toHaveLength(privateLocations().length - 1);
    for (const location of others) {
      expect(
        setValue(location.body, '$admin_cache_control'),
        describeLocation(location),
      ).toBeUndefined();
    }
  });

  it('has exactly the liveness, control-api, assets, reserved and SPA locations', () => {
    const described = privateLocations().map(describeLocation);
    const reserved = described.filter((d) => d.startsWith('location ~* '));
    expect(reserved).toHaveLength(1);
    expect(described.filter((d) => !reserved.includes(d)).sort()).toEqual(
      [
        'location = /healthz',
        // Stops nginx's automatic 301 from /control-api to /control-api/.
        'location = /control-api',
        'location ^~ /control-api/',
        'location ^~ /assets/',
        'location /',
      ].sort(),
    );
    expect(namedLocations(privateServer()).map((l) => l.pattern)).toEqual([
      '@admin_asset_missing',
    ]);
  });

  it.each(['/', '/documents', '/reader/abc-123', '/data-quality', '/index.html'])(
    'serves the Admin UI SPA for %s',
    (uri) => {
      const location = selectLocation(privateLocations(), uri);
      expect(describeLocation(location)).toBe('location /');
      expect(location.body.find((d) => d.name === 'try_files')?.args).toEqual([
        '$uri',
        '/index.html',
      ]);
    },
  );

  it('answers liveness with a bare 200, GET/HEAD only and no detail', () => {
    const healthz = selectLocation(privateLocations(), '/healthz');
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
    const guard = healthz.body.find((d) => d.name === 'if');
    expect(guard?.args).toEqual(['($request_method', '!~', '^(GET|HEAD)$)']);
    expect(guard?.block).toEqual([{ name: 'return', args: ['405'] }]);
  });

  it.each([
    '/api',
    '/api/',
    '/api/admin/x',
    '/api/admin/users',
    '/api/documents/bulk',
    '/API/ADMIN/users',
    '/auth/session-check',
    '/control-api',
    '/Control-Api/v1/me',
    '/codex-api/api/search/quick',
    '/codex-admin',
    '/codex-admin/',
    '/codex-admin;x/',
    '/codex-ws',
    '/codex-dm/',
    '/codex/',
    '/ws',
    '/socket.io/',
    '/library',
    '/library-assets/x',
    '/forge/',
    '/generator-hub/',
    '/health',
    '/healthz/',
    '/metrics',
  ])('returns 404 for %s', (uri) => {
    const location = selectLocation(privateLocations(), uri);
    expect(location.body, `${uri} -> ${describeLocation(location)}`).toEqual([
      { name: 'return', args: ['404'] },
    ]);
  });
});

describe('public server (:80) never serves the private root', () => {
  it('has no root or alias pointing at the Admin UI root', () => {
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

  it('never proxies to control-api', () => {
    expect(serverProxiedHosts(publicServer())).not.toContain(CONTROL_API);
  });
});

describe('frontend image', () => {
  const dockerfile = () =>
    readFileSync(vttFile('docker', 'frontend.Dockerfile'), 'utf8');

  const productionStage = () => {
    const source = dockerfile();
    const start = source.search(/^FROM\s+\S+\s+AS\s+production\s*$/im);
    expect(start).toBeGreaterThanOrEqual(0);
    return source
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

  it('copies the Admin UI build, and nothing else, into the private root', () => {
    const privateRoot = directiveArg(privateServer(), 'root') as string;
    const intoPrivateRoot = productionStage().filter((copy) =>
      isInside(copy.destination, privateRoot),
    );
    expect(intoPrivateRoot).toEqual([
      {
        from: 'codex-admin-builder',
        source: '/workspace/apps/codex/services/admin-ui/dist',
        destination: privateRoot,
      },
    ]);
  });

  it('no longer ships the Admin UI or the placeholder under the public root', () => {
    const publicRoot = directiveArg(publicServer(), 'root') as string;
    const adminCopies = productionStage().filter(
      (copy) =>
        copy.from === 'codex-admin-builder' ||
        copy.source.includes('admin-placeholder'),
    );
    for (const copy of adminCopies) {
      expect(isInside(copy.destination, publicRoot), copy.destination).toBe(
        false,
      );
    }
    expect(existsSync(vttFile('docker', 'admin-placeholder'))).toBe(false);
  });

  it('builds the Admin UI for the root path it is served from', () => {
    const source = dockerfile();
    const start = source.search(/^FROM\s+\S+\s+AS\s+codex-admin-builder\s*$/im);
    const end = source.indexOf('\nFROM ', start + 1);
    const stage = source.slice(start, end);
    expect(stage).toMatch(/^ENV ADMIN_UI_BASE=\/\s*$/m);
    expect(stage.indexOf('ADMIN_UI_BASE')).toBeLessThan(
      stage.indexOf('npm run build --workspace=admin-ui'),
    );
  });
});
