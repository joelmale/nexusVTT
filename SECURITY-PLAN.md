# Security Remediation Plan

Generated from 1,163 GitHub Code Scanning alerts (CodeQL + Dependabot).  
Last reviewed: 2026-06-11

---

## Alert Breakdown

The headline number is large because it conflates four distinct categories:

| Category | Count | Urgency |
|---|---|---|
| Code-quality / dead-code (non-security) | ~897 | Low — tech debt |
| Genuine security issues in app code | ~100 | High — fix these |
| OS-level CVEs in Docker base images | ~60 | Medium — base image bump |
| Third-party bundled generator scripts | ~36 | Assess — vendor code |

The phases below work through these in priority order.

---

## Phase 1 — Critical app-code security (do this sprint)

These are real vulnerabilities in code we own and can fix today.

### 1.1 XSS via `dangerouslySetInnerHTML` — 4 alerts HIGH

**Files:**
- `src/components/Scene/PropRenderer.tsx:207`
- `src/components/Props/PropCreationPanel.tsx:584`
- `src/components/Props/PropPanel.tsx:264`
- `src/components/Generator/GeneratorPanel.tsx:595`

User-supplied content is being injected into the DOM without sanitisation. An attacker who can set a prop name/description can run arbitrary JavaScript in any player's session.

**Fix:** Replace `dangerouslySetInnerHTML` with a sanitise-then-set pattern using the `DOMPurify` library (already a common React pattern). For any field that does not need HTML at all, use plain text nodes instead.

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```ts
import DOMPurify from 'dompurify';
// Replace: dangerouslySetInnerHTML={{ __html: userContent }}
// With:    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }}
// Or:      <span>{userContent}</span>  // if HTML is not needed at all
```

---

### 1.2 Unvalidated URL redirect — 4 alerts HIGH

**Files:** same 4 files as 1.1 (co-located with XSS hits)

A user-controlled value is used as an `href` or `src` without validating the scheme. Allows `javascript:` URLs and open redirects.

**Fix:** Validate scheme before use.

```ts
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}
```

---

### 1.3 Path injection in asset serving — 1 alert HIGH

**File:** `server/index.ts:1236`

A user-supplied value is used to construct a filesystem path without sanitisation. Could allow directory traversal (e.g. `../../etc/passwd`).

**Fix:** Resolve the path and assert it stays within the intended assets root.

```ts
import path from 'path';

const ASSETS_ROOT = path.resolve('./static-assets/assets');

function safeAssetPath(userInput: string): string {
  const resolved = path.resolve(ASSETS_ROOT, userInput);
  if (!resolved.startsWith(ASSETS_ROOT + path.sep)) {
    throw new Error('Path traversal attempt rejected');
  }
  return resolved;
}
```

---

### 1.4 Missing CSRF protection — 1 alert HIGH

**File:** `server/index.ts:290`

State-mutating routes (POST/PUT/DELETE) have no CSRF token validation. A malicious third-party page could trigger requests on behalf of a logged-in user.

**Fix:** Add `csurf` middleware (or its modern equivalent `csrf-csrf`) to all non-GET routes. The session is already cookie-based so double-submit or synchronised-token patterns both apply.

```bash
npm install csrf-csrf
```

```ts
import { doubleCsrf } from 'csrf-csrf';
const { generateToken, doubleCsrfProtection } = doubleCsrf({ getSecret: () => process.env.SESSION_SECRET! });
app.use(doubleCsrfProtection);  // applies to POST/PUT/DELETE automatically
// Expose token to client via: app.get('/api/csrf-token', (req, res) => res.json({ token: generateToken(req, res) }))
```

---

### 1.5 Insecure randomness used for security tokens — 9 alerts HIGH

**Files:**
- `src/services/websocket.ts:118,119,456` — connection/update IDs
- `src/stores/gameStore.ts:3688,3690` — room/session codes
- `src/components/LinearWelcomePage.tsx:89` — likely a nonce or ID
- `src/services/sessionPersistence.ts:109,111,370` — persistence keys

`Math.random()` is not cryptographically secure. Any value used as a token, nonce, or secret must use `crypto.randomUUID()` or `crypto.getRandomValues()`.

**Fix:** Replace `Math.random()`-based ID generation:

```ts
// Instead of: Math.random().toString(36).substr(2, 9)
// Use:        crypto.randomUUID()                 (browser + Node 19+)
// Or:         crypto.getRandomValues(new Uint8Array(16))  (typed array)
```

Note: the jitter fix we added to `websocket.ts` this session intentionally uses `Math.random()` for randomising a delay — that is not security-sensitive and does not need changing.

---

### 1.6 User-controlled security bypass — 13 alerts HIGH

**Files:**
- `server/routes/documents.ts` — 7 alerts
- `server/index.ts` — 6 alerts

User-supplied values flow into access-control checks without validation, allowing bypasses. Examples: a user passes their own `userId` in a request body and the server uses it without comparing to `req.user.id`.

**Fix:** Never trust client-supplied identity. Always derive the acting user from the verified session:

```ts
// Wrong:
const userId = req.body.userId;
if (document.ownerId === userId) { /* grant access */ }

// Right:
const userId = req.user!.id;  // always from passport session
if (document.ownerId === userId) { /* grant access */ }
```

Audit every route in `documents.ts` and `index.ts` for any identity or permission field sourced from `req.body`, `req.query`, or `req.params` rather than `req.user`.

---

## Phase 2 — High security issues (next sprint)

### 2.1 Missing rate limiting — 28 alerts HIGH

**Files:** `server/index.ts` (20 alerts), `server/routes/documents.ts` (8 alerts)

No route has rate limiting. Auth endpoints are particularly exposed — brute-force login, guest user creation spam, and dice-roll flooding are all possible.

**Fix:** Apply `express-rate-limit` at three levels.

```bash
npm install express-rate-limit
```

```ts
import rateLimit from 'express-rate-limit';

// Strict: auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });
app.use('/auth', authLimiter);

// Moderate: API
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api', apiLimiter);

// Loose: static/health
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });
app.use('/', generalLimiter);
```

Consider storing rate-limit state in Redis (via `rate-limit-redis`) so limits work correctly across the 3 backend replicas.

---

### 2.2 Missing WebSocket origin check — 5 alerts HIGH

**Files:** `public/world-map-generator/Perilous.js`, `public/one-page-dungeon/Dungeon.js`, `public/city-generator/mfcg.js`, `public/dwellings-generator/Dwellings.js`, `public/cave-generator/Cave.js`

These bundled generator scripts use `postMessage` without validating the `event.origin`. A malicious page in another tab could send commands to the generators.

**Fix:** All `postMessage` listeners in these files need an origin check:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return; // add this guard
  // ... existing handler
});
```

Since these are vendored/third-party files, note the version and check if upstream has patched this before modifying locally.

---

### 2.3 Log injection — 16 alerts MEDIUM

**File:** `src/services/websocket.ts` (10 alerts), other files

User-controlled data (e.g. room codes, usernames) is interpolated directly into `console.log` calls. In environments where logs are forwarded to a SIEM, this can poison log entries or inject fake log lines.

**Fix:** Sanitise values logged from external sources by stripping newlines:

```ts
const safe = (s: unknown) => String(s).replace(/[\r\n]/g, ' ');
console.log(`User ${safe(username)} joined room ${safe(roomCode)}`);
```

---

### 2.4 Tainted format string — 1 alert HIGH

**File:** `src/services/tokenAssets.ts`

A user-controlled string reaches a formatting function that may interpret format specifiers.

**Fix:** Review `tokenAssets.ts` and ensure user-supplied asset names/paths are treated as data, not format strings. Never pass user input as the first argument to functions that support `%s`/`%d` style formatting.

---

### 2.5 ReDoS (polynomial regex) — 1 alert HIGH

**File:** `server/index.ts`

A regular expression applied to user-supplied input has polynomial worst-case matching behaviour. A crafted string can stall the event loop.

**Fix:** Audit the flagged regex, test it against ReDoS checkers (e.g. [vuln-regex-detector](https://github.com/davisjam/vuln-regex-detector)), and rewrite to linear complexity — often by removing nested quantifiers or using a string search instead.

---

## Phase 3 — Docker base image CVEs (next fortnight)

About 60 alerts are OS-level CVEs (OpenSSL, libxml2) duplicated across the `frontend`, `backend`, and `postgres` images. The scanner reports each CVE per image, inflating the count.

**Distinct CVEs:**
- `CVE-2026-45447` — OpenSSL heap use-after-free (HIGH)
- `CVE-2026-6732` — libxml2 DoS (HIGH, frontend image only)
- `CVE-2026-45445`, `CVE-2026-42764` — OpenSSL AES/QUIC issues (MEDIUM)
- 10+ further OpenSSL low/medium issues

**Fix:** Pin base images to a patched Alpine version. The current `node:25-alpine` and `nginx:alpine` will pick up fixes when Alpine pushes updated OpenSSL/libxml2 packages — simply rebuilding with `--no-cache` is often enough after an upstream patch lands.

```dockerfile
# backend.Dockerfile / frontend.Dockerfile
FROM node:25-alpine   # bump to node:25-alpine3.22 or latest patched tag
```

```bash
# Rebuild without cache to pull latest Alpine packages
docker build --no-cache -f docker/backend.Dockerfile .
```

Add a scheduled monthly CI job that rebuilds images to catch OS-level patches automatically.

**Also:** `picomatch CVE-2026-33671` is in `npm`'s own bundled dependencies (`/usr/local/lib/node_modules/npm/...`), not in the project's `node_modules`. It will be fixed by upgrading the Node.js base image.

---

## Phase 4 — Bundled generator script issues (assess & decide)

26 `js/remote-property-injection` and 5 `js/code-injection` alerts are in vendored third-party files:

- `public/world-map-generator/Perilous.js`
- `public/one-page-dungeon/Dungeon.js`
- `public/city-generator/mfcg.js`
- `public/dwellings-generator/Dwellings.js`
- `public/cave-generator/Cave.js`

These are open-source map/dungeon generators bundled as static files. They run in the browser, not on the server, and are loaded in sandboxed iframes.

**Options (pick one):**

| Option | Effort | Risk reduction |
|---|---|---|
| Add `sandbox` attribute to iframes loading these | Low | High — browser enforces isolation |
| Fork and patch each generator | High | Full control |
| Add CodeQL `.github/codeql-config.yml` ignore for `public/` | Low | Suppresses noise, doesn't fix |
| Replace with actively maintained equivalents | Very high | Best long term |

**Recommended:** Start with the iframe `sandbox` attribute (if not already present), then file issues upstream on the generators. Suppressing the alerts in CodeQL config without mitigation is not recommended.

---

## Phase 5 — Code quality / tech debt (~897 alerts)

These are not security vulnerabilities but indicate code quality issues that make the codebase harder to maintain and can mask real bugs.

| Rule | Count | What it means |
|---|---|---|
| `js/comparison-between-incompatible-types` | 519 | Comparing values that can never match (e.g. `string === number`) — usually dead branches or incorrect type assumptions |
| `js/useless-comparison-test` | 140 | Condition always true or always false |
| `js/useless-assignment-to-local` | 105 | Variable written but never read |
| `js/use-before-declaration` | 88 | Variable used before its `let`/`const` declaration (hoisting issue) |
| `js/trivial-conditional` | 50 | `if (true)` / `if (false)` style dead code |
| `js/redundant-assignment` | 35 | Value overwritten before being read |

**Approach:** Do not attempt to fix all 897 at once. Instead:
1. Enable the ESLint rules that overlap (`no-unused-vars`, `no-constant-condition`, `@typescript-eslint/no-unnecessary-condition`) — many will auto-fix
2. Run `npm run lint -- --fix` after enabling rules
3. Review remaining hits file-by-file during normal feature work

The `js/comparison-between-incompatible-types` count of 519 is suspiciously large for a TypeScript project. This likely indicates the CodeQL scan is running without full TypeScript type information. Check `.github/workflows/security.yml` — if the build step isn't compiling TypeScript before CodeQL analysis, the scanner falls back to JS-mode and generates false positives. Running `npm run build` before the CodeQL `autobuild` step will dramatically reduce this category.

---

## Recommended Execution Order

```
Week 1:  Phase 1 (XSS, CSRF, path injection, insecure random, auth bypass)
Week 2:  Phase 2 (rate limiting, origin checks, log injection)
Week 3:  Phase 3 (base image rebuild) + Phase 4 assessment
Ongoing: Phase 5 during regular sprint work
```

## Tracking Progress

Run the following to get a live count of open alerts by severity:

```bash
gh api repos/joelmale/nexusVTT/code-scanning/alerts \
  --paginate -q '.[] | select(.state=="open") | .rule.security_severity_level' \
  | sort | uniq -c
```
