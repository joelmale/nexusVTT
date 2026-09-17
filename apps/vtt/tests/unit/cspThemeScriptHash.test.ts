import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * index.html inlines a theme pre-warming script. It has to be inline -- it runs
 * before first paint to avoid a flash of unstyled content -- so nginx cannot
 * allow it via `script-src 'self'`. The production CSP therefore whitelists it
 * by sha256.
 *
 * That coupling is invisible and fails silently: edit the script, the hash stops
 * matching, the browser blocks it, and the only symptom is the layout shift
 * coming back. This test makes the mismatch a build failure instead.
 *
 * If it fails, the script legitimately changed. Copy the `expected` hash from
 * the failure message into the script-src directive in docker/nginx.conf.
 */
const repoFile = (...parts: string[]) => resolve(__dirname, '../..', ...parts);

/**
 * Match every <script> element and keep the ones with no `src`, i.e. the inline
 * ones the CSP has to account for.
 *
 * Deliberately not /<script>...<\/script>/: that only matches a bare lowercase
 * tag with no attributes, so `<SCRIPT>`, `<script >` or
 * `<script type="text/javascript">` would slip past and a newly added inline
 * script could go unhashed while this file still reported "exactly one".
 * CodeQL flags the narrow form as js/bad-tag-filter for the same reason.
 */
const SCRIPT_ELEMENT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

function inlineScriptBodies(html: string): string[] {
  return [...html.matchAll(SCRIPT_ELEMENT)]
    .filter((match) => !/\bsrc\s*=/i.test(match[1]))
    .map((match) => match[2]);
}


/**
 * Hash against LF endings. The image is built from a Linux checkout, so that is
 * what the browser actually receives and hashes; a Windows working copy has
 * CRLF and would otherwise compute a different, wrong value here.
 */
function normalizeEol(value: string): string {
  return value.split('\r\n').join('\n');
}

function sha256Base64(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64');
}

describe('production CSP hash for the inline theme script', () => {
  const html = readFileSync(repoFile('index.html'), 'utf8');
  const nginxConf = readFileSync(repoFile('docker', 'nginx.conf'), 'utf8');

  it('index.html still has exactly one inline script', () => {
    // More than one means someone added an inline script that the CSP does not
    // know about; it will be blocked in production without any local warning.
    expect(inlineScriptBodies(html)).toHaveLength(1);
  });

  it('its hash is present in the nginx script-src directive', () => {
    const [body] = inlineScriptBodies(html);
    const expected = `sha256-${sha256Base64(normalizeEol(body))}`;

    expect(
      nginxConf.includes(expected),
      `The inline theme script in index.html hashes to:\n\n  ${expected}\n\n` +
        `but docker/nginx.conf does not contain it, so production CSP will ` +
        `block the script and the flash of unstyled content will return. ` +
        `Update the script-src directive with the hash above.`,
    ).toBe(true);
  });

  it('keeps blob: workers allowed, which the 3D dice engine needs', () => {
    // dice-box/Babylon spawns its physics worker from a blob URL. Without an
    // explicit worker-src, CSP falls back to script-src 'self' and blocks it.
    expect(nginxConf).toMatch(/worker-src[^;"]*blob:/);
  });

  it('relaxes inline scripts for the generator hub only', () => {
    // The vendored generators bootstrap via an inline lime.embed() call, so
    // that path needs 'unsafe-inline' -- but the app itself must not have it.
    const hubBlock = nginxConf.slice(
      nginxConf.indexOf('location /generator-hub/'),
    );
    const hubCsp = hubBlock.slice(0, hubBlock.indexOf('}'));
    expect(hubCsp).toContain("'unsafe-inline'");

    const appCsp = nginxConf.slice(0, nginxConf.indexOf('location /assets'));
    const appScriptSrc = /script-src([^;"]*)/.exec(appCsp)?.[1] ?? '';
    expect(appScriptSrc).not.toContain("'unsafe-inline'");
  });
});
