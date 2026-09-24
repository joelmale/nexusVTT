import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A minimal parser for apps/vtt/docker/nginx.conf plus a replay of nginx's
 * location-selection algorithm. Gateway policy tests use it to assert what a
 * request URI actually reaches instead of snapshotting config strings, so
 * reordering or reformatting the config does not break them but a policy
 * regression does.
 */
export const vttFile = (...parts: string[]) =>
  resolve(__dirname, '..', '..', '..', ...parts);

export interface Directive {
  name: string;
  args: string[];
  block?: Directive[];
}

const ESCAPES: Record<string, string> = { t: '\t', r: '\r', n: '\n' };

export function tokenize(source: string): string[] {
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
        if (source[i] === '\\') {
          // nginx decodes \t, \r and \n inside quotes; other escapes are literal.
          i += 1;
          value += ESCAPES[source[i]] ?? source[i];
        } else {
          value += source[i];
        }
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

export function parse(
  tokens: string[],
  start = 0,
): { directives: Directive[]; end: number } {
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

/** Every `server` block in the gateway's `http` context. */
export function gatewayServers(): Directive[] {
  const { directives } = parse(
    tokenize(readFileSync(vttFile('docker', 'nginx.conf'), 'utf8')),
  );
  const http = directives.find((d) => d.name === 'http');
  return http?.block?.filter((d) => d.name === 'server') ?? [];
}

/** Ports a server block listens on (`listen 80`, `listen [::]:8081 ...`). */
export function listenPorts(server: Directive): number[] {
  return (server.block ?? [])
    .filter((d) => d.name === 'listen')
    .map((d) => Number(d.args[0].match(/(\d+)$/)?.[1]));
}

/** The single server block listening on `port`; throws if absent or ambiguous. */
export function serverOnPort(port: number): Directive {
  const matches = gatewayServers().filter((server) =>
    listenPorts(server).includes(port),
  );
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one server block on :${port}, found ${matches.length}`,
    );
  }
  return matches[0];
}

export interface Location {
  modifier: '' | '=' | '^~' | '~' | '~*';
  pattern: string;
  body: Directive[];
}

export function serverLocations(server: Directive): Location[] {
  return (server.block ?? [])
    .filter((d) => d.name === 'location')
    .map((d) => {
      const [first, second] = d.args;
      const modifier =
        d.args.length === 2 ? (first as Location['modifier']) : '';
      return {
        modifier,
        pattern: d.args.length === 2 ? second : first,
        body: d.block ?? [],
      };
    });
}

/** nginx location selection for non-nested, non-named locations. */
export function selectLocation(locations: Location[], uri: string): Location {
  const exact = locations.find((l) => l.modifier === '=' && l.pattern === uri);
  if (exact) return exact;
  const prefixes = locations
    .filter(
      (l) =>
        (l.modifier === '' || l.modifier === '^~') && uri.startsWith(l.pattern),
    )
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

export function describeLocation(location: Location): string {
  return `location ${location.modifier} ${location.pattern}`.replace(
    /\s+/g,
    ' ',
  );
}

/** Upstream hosts this location proxies to, with `set` variables resolved. */
export function proxiedHosts(location: Location): string[] {
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

/** Depth-first walk over a directive tree (locations, `if`, `limit_except`, ...). */
export function* walkDirectives(directives: Directive[]): Generator<Directive> {
  for (const directive of directives) {
    yield directive;
    if (directive.block) yield* walkDirectives(directive.block);
  }
}
