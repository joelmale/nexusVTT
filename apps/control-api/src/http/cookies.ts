import type { Request, Response } from 'express';

export const SESSION_COOKIE = '__Host-nexus_admin';
/** Short-lived login state (state, nonce, PKCE verifier). */
export const LOGIN_COOKIE = '__Host-nexus_admin_login';

/**
 * Minimal RFC 6265 cookie-header parser. The first occurrence of a name wins,
 * matching how browsers order more specific cookies first.
 */
export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    if (name && !cookies.has(name)) cookies.set(name, value);
  }
  return cookies;
}

export function readCookie(req: Request, name: string): string | undefined {
  return parseCookies(req.headers.cookie).get(name);
}

interface CookieOptions {
  maxAgeSeconds: number;
  sameSite: 'Strict' | 'Lax';
}

/**
 * `__Host-` cookies must be Secure, Path=/ and carry no Domain; setting them
 * explicitly here keeps every attribute visible and testable.
 */
export function setHostCookie(res: Response, name: string, value: string, options: CookieOptions): void {
  const maxAge = Math.max(0, Math.floor(options.maxAgeSeconds));
  res.append(
    'Set-Cookie',
    `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=${options.sameSite}`,
  );
}

export function clearHostCookie(res: Response, name: string, sameSite: 'Strict' | 'Lax'): void {
  setHostCookie(res, name, '', { maxAgeSeconds: 0, sameSite });
}
