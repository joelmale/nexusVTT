import type { Permission } from '../permissions.js';

/**
 * Shared allowlist machinery for every upstream control-api proxies to
 * (Codex doc-api, the rules registry, the asset service). Each upstream owns
 * one explicit table of `ProxyRoute`s; anything not listed is a 404 and never
 * contacts the upstream.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type BodyRule =
  | { kind: 'none' }
  /** `optional`: an empty body is forwarded as no body instead of rejected. */
  | { kind: 'json'; maxBytes: number; optional?: boolean }
  | { kind: 'stream'; maxBytes: number; contentTypes: readonly string[] };

/** Request headers that may be forwarded (each is validated). */
export type ForwardHeader = 'range' | 'if-match' | 'if-none-match';

/**
 * Where the authenticated administrator's identity replaces a client-supplied
 * value in a JSON body before it is forwarded.
 * - `userId`: top-level `userId`.
 * - `documents.uploadedBy`: `uploadedBy` on every element of `documents[]`.
 */
export type ActorStamp = 'userId' | 'documents.uploadedBy';

export interface ProxyRoute {
  method: HttpMethod;
  /** Path below the upstream base; `:name` segments must match PATH_PARAM. */
  path: string;
  /** Any-of: the caller needs at least one of these permissions. */
  permission: readonly Permission[];
  /** Requires a Google login within the last 10 minutes. */
  recentAuth: boolean;
  /** Mutations are audited with the upstream outcome. Denials are always audited. */
  audited: boolean;
  /** Audit action name. */
  action: string;
  resourceType: string;
  /** Allowed query keys and the pattern each value must match. */
  query: Readonly<Record<string, RegExp>>;
  body: BodyRule;
  /** Top-level JSON body keys whose (identifier) values are copied to the audit summary. */
  auditBodyKeys?: readonly string[];
  /** Extra request headers forwarded upstream (validated). */
  forwardHeaders?: readonly ForwardHeader[];
  /** Overwrite actor fields in the JSON body with the session's user ID. */
  stampActor?: ActorStamp;
  /**
   * `inlineDocument`: a document opened in a browser tab (PDF); its CSP still
   * forbids scripts but allows the same-origin PDF viewer embed.
   * `image`: an image rendered by the Admin UI; only PNG/JPEG/WebP content
   * types pass, served inline with nosniff.
   */
  response?: 'json' | 'inlineDocument' | 'image';
  /** Served by a control-api handler instead of a plain forward. */
  handler?: string;
  timeoutMs?: number;
}

export const PATH_PARAM = /^[A-Za-z0-9_-]{1,128}$/;

export const INT = /^\d{1,6}$/;
export const BOOL = /^(true|false)$/;
/** Free text without control characters. */
export const TEXT = /^\P{Cc}{0,256}$/u;
export const ID = /^[A-Za-z0-9_-]{1,128}$/;
export const DATE = /^[0-9TZ:.+-]{1,40}$/;
export const SORT_ORDER = /^(asc|desc)$/;
export const KB = 1024;
export const MB = 1024 * KB;

export const NONE: BodyRule = { kind: 'none' };
export const json = (maxBytes: number, optional = false): BodyRule => ({ kind: 'json', maxBytes, ...(optional ? { optional } : {}) });

interface CompiledRoute {
  route: ProxyRoute;
  segments: readonly ({ literal: string } | { param: string })[];
}

export interface RouteMatch {
  route: ProxyRoute;
  params: Record<string, string>;
  /** Validated upstream path below the upstream base. */
  upstreamPath: string;
}

export type LookupResult =
  | { kind: 'match'; match: RouteMatch }
  | { kind: 'not_found' };

export class RouteTable {
  private readonly compiled: CompiledRoute[];

  constructor(routes: readonly ProxyRoute[]) {
    const seen = new Set<string>();
    this.compiled = routes.map((route) => {
      const key = `${route.method} ${route.path.replace(/:[^/]+/g, ':')}`;
      if (seen.has(key)) throw new Error(`Duplicate allowlist entry: ${key}`);
      seen.add(key);
      return {
        route,
        segments: route.path.split('/').map((segment) =>
          segment.startsWith(':') ? { param: segment.slice(1) } : { literal: segment },
        ),
      };
    });
  }

  get routes(): readonly ProxyRoute[] {
    return this.compiled.map(({ route }) => route);
  }

  /**
   * `rawPath` is the undecoded path after the proxy prefix. Matching the raw
   * form means `%2F`, `%2e%2e`, `..`, `.` and empty segments can never match
   * a param or literal, so they fall through to 404. Literal segments win
   * over parameters regardless of table order.
   */
  lookup(method: string, rawPath: string): LookupResult {
    const parts = rawPath.split('/');
    let best: { match: RouteMatch; literals: number } | null = null;
    for (const { route, segments } of this.compiled) {
      if (route.method !== method || segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      let literals = 0;
      for (let i = 0; i < segments.length && ok; i++) {
        const segment = segments[i]!;
        const part = parts[i]!;
        if ('literal' in segment) {
          ok = part === segment.literal;
          literals += 1;
        } else if (PATH_PARAM.test(part)) {
          params[segment.param] = part;
        } else {
          ok = false;
        }
      }
      if (ok && (!best || literals > best.literals)) {
        best = { match: { route, params, upstreamPath: parts.join('/') }, literals };
      }
    }
    return best ? { kind: 'match', match: best.match } : { kind: 'not_found' };
  }
}
