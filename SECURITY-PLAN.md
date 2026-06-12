# Security Remediation Plan

Generated from 1,163 GitHub Code Scanning alerts (CodeQL + Dependabot).  
Last reviewed: 2026-06-11

---

## Out of Scope

All files under `public/` are vendored third-party generator scripts
(`world-map-generator`, `one-page-dungeon`, `city-generator`,
`dwellings-generator`, `cave-generator`). These will not be modified —
patching them risks breaking the generators and upstream updates would
clobber any local changes. Alerts in these files are accepted as vendor
risk.

**Suppressed alert categories (public/):**
- 26 × `js/remote-property-injection`
- 5 × `js/code-injection`
- 5 × `js/missing-origin-check`

---

## True Alert Breakdown

| Category | Count | Urgency |
|---|---|---|
| Code quality / dead code (non-security) | ~897 | Low — tech debt |
| Security issues in app code | ~70 | Phased below |
| OS-level CVEs in Docker base images | ~60 | Medium — base image rebuild |
| Vendored `public/` generators (out of scope) | ~36 | Accepted / skip |

---

## Phase 1 — Fix now (low breaking-change risk, real security impact)

These fixes are safe to ship without broad frontend/API changes.

---

### 1.1 Unvalidated URL in `src` / `href` attributes — 4 alerts HIGH
**Breaking change risk: LOW** (with the right allowlist)

**Files:**
- `src/components/Scene/PropRenderer.tsx:207` — SVG `<image href={prop.image}>`
- `src/components/Props/PropPanel.tsx:264` — `<img src={prop.image}>`
- `src/components/Props/PropCreationPanel.tsx:584` — `<img src={previewImage}>`
- `src/components/Generator/GeneratorPanel.tsx:595` — `<img src={generatedMap}>`

The scanner flags user-controlled values flowing into URL attributes without
scheme validation. A `javascript:` URL in a prop image field could execute
code in the DM's browser.

The `GeneratorPanel` hit is a false positive — `generatedMap` is a data URL
produced internally by the app, not user input. It can be dismissed.

For the prop image fields, the existing assets are `https://` URLs or
relative paths from the asset library. A safe-URL helper must allow all
three valid schemes to avoid regressions:

```ts
// src/utils/safeUrl.ts
const ALLOWED_SCHEMES = ['https:', 'http:', 'data:'];

export function safeImageUrl(url: string | undefined): string {
  if (!url) return '';
  // Relative paths (start with / or .) are always safe
  if (url.startsWith('/') || url.startsWith('.') || url.startsWith('blob:')) return url;
  try {
    const { protocol } = new URL(url);
    return ALLOWED_SCHEMES.includes(protocol) ? url : '';
  } catch {
    return ''; // malformed URL — drop it
  }
}
```

Replace bare `src={prop.image}` and `href={prop.image}` with
`src={safeImageUrl(prop.image)}` in the three prop components.

---

### 1.2 Path injection in custom token upload — 1 alert HIGH
**Breaking change risk: LOW**

**File:** `server/index.ts:1236`

`tokenId` (user-supplied) and `name` are used to build a file path. The
existing code already sanitises `name` with `/[^a-z0-9]/gi → '_'`, so
path traversal via the name is blocked. However `tokenId` is not sanitised
before being appended to the filename. Add an explicit path-bounds check as
defence-in-depth:

```ts
import path from 'path';

const TOKENS_ROOT = path.resolve(customTokensDir);
const filepath = path.join(TOKENS_ROOT, filename);

// Reject if the resolved path escapes the tokens directory
if (!filepath.startsWith(TOKENS_ROOT + path.sep)) {
  return res.status(400).json({ error: 'Invalid token path' });
}
```

This is additive — no existing behaviour changes for valid inputs.

---

### 1.3 Log injection — 16 alerts MEDIUM
**Breaking change risk: VERY LOW**

**File:** `src/services/websocket.ts` (primary)

User-controlled values (room codes, usernames, error messages) are
interpolated directly into `console.log`. In production log aggregation
pipelines, a crafted value containing `\n` can inject fake log lines.

Fix: strip newlines from any external-origin value before logging.

```ts
const sanitizeLog = (s: unknown): string =>
  String(s).replace(/[\r\n\t]/g, ' ').slice(0, 200);
```

Apply `sanitizeLog()` around any variable that originates from WebSocket
messages, URL params, or user input in log statements. This has zero impact
on runtime behaviour — only on what gets written to logs.

---

### 1.4 Insecure randomness — audit result: mostly false positives
**Breaking change risk: N/A for most; LOW for the one real case**

The scanner flags 9 uses of `Math.random()`. On inspection, most are
genuinely not security-sensitive:

| Location | Use | Risk |
|---|---|---|
| `websocket.ts:423` | Jitter on reconnect delay | None — delay randomisation |
| `gameStore.ts:3912–3965` | NPC ability scores, random names/race/class | None — game flavour |
| `LinearWelcomePage.tsx:499–502` | CSS animation positions and durations | None — cosmetic |
| `sessionPersistence.ts:109,111,370` | Session cookie data construction | Needs verification |

The only case that may matter is `sessionPersistence.ts` — if
`Math.random()` is used to generate a browser ID or session nonce, replace
it with `crypto.randomUUID()`. If it is used only for expiry timestamps or
UI values, no change is needed.

Verify with: `sed -n '105,120p' src/services/sessionPersistence.ts`

**Action:** Dismiss the gameStore, websocket jitter, and LinearWelcomePage
alerts as false positives. Audit sessionPersistence and replace any
security-token generation with `crypto.randomUUID()`.

---

### 1.5 User-controlled security bypass in `documents.ts` — likely false positive
**Breaking change risk: N/A**

**File:** `server/routes/documents.ts` (7 alerts)

The scanner flagged access-control checks as potentially bypassable. On
inspection, `documents.ts` uses a `getUserId(req)` helper that correctly
reads from `req.user` (passport session) or `req.session.guestUser` — never
from `req.body` or `req.params`. The `userId` flowing into `hasDocumentAccess()`
comes from the session, not user input.

**Action:** Verify by grepping for any route that reads an identity or
ownership field from `req.body`:
```bash
grep -n "req\.body\.\(userId\|ownerId\|id\)" server/routes/documents.ts
```
If nothing is found, dismiss these alerts as false positives in GitHub's
code scanning UI (mark as "Used in tests" or "False positive").

The 6 alerts in `server/index.ts` for the same rule should be audited
similarly — look for any `req.body` value that flows into a permission check.

---

## Phase 2 — Next sprint (moderate change, needs testing)

---

### 2.1 Missing rate limiting — 28 alerts HIGH
**Breaking change risk: MEDIUM**

**Files:** `server/index.ts` (20), `server/routes/documents.ts` (8)

No API or auth endpoint has rate limiting. With 3 backend replicas, rate
limits must be stored in Redis (not in-process) or each replica would enforce
limits independently, allowing 3× the intended rate.

```bash
npm install express-rate-limit rate-limit-redis
```

```ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

// Auth endpoints — strict
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
});
app.use('/auth', authLimiter);

// API — moderate (start generous, tighten after observing traffic)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,  // 200 req/min per IP — adjust after observing real usage
  store: new RedisStore({ ... }),
});
app.use('/api', apiLimiter);
```

**Caution:** The character sync on Dashboard and the campaign load on
startup can generate bursts of API calls. Start with a conservative limit
(200/min) and monitor before tightening. The `/api/characters` endpoint in
particular fires on mount — set a generous limit initially.

---

### 2.2 Missing CSRF protection — 1 alert HIGH
**Breaking change risk: HIGH — do not ship without frontend changes**

**File:** `server/index.ts:290`

State-mutating routes lack CSRF token validation. This is a real gap but
the fix touches both the server and every POST/PUT/DELETE call in the
frontend.

**Implementation path (do in this order):**

1. Add `csrf-csrf` to server:
   ```bash
   npm install csrf-csrf
   ```
2. Expose a CSRF token endpoint:
   ```ts
   app.get('/api/csrf-token', (req, res) => res.json({ token: generateToken(req, res) }));
   ```
3. Exclude OAuth callback routes and WebSocket upgrade from CSRF middleware.
4. Update the frontend: fetch the token on app load and include it as
   `X-CSRF-Token` header in all `fetch()` calls that mutate state.
5. Test the full OAuth flow before deploying — the callback redirect from
   Google/Discord does not include a CSRF token and must be whitelisted.

**Risk if skipped:** An attacker with knowledge of the API can perform
CSRF attacks against logged-in users. In a VTT context this is limited —
an attacker would need the victim to visit a malicious page while logged
in, and the damage is limited to game data. Prioritise behind the
rate-limiting fix.

---

## Phase 3 — Docker base image CVEs (next fortnight)

~60 alerts are OS-level CVEs duplicated across the three container images.
The same CVE appears 4 times (once per image × 2 replicas in some cases).

**Distinct vulnerabilities requiring action:**

| CVE | Severity | Component | Fix |
|---|---|---|---|
| CVE-2026-45447 | HIGH | OpenSSL — heap UAF in PKCS7_verify | Rebuild with patched Alpine |
| CVE-2026-6732 | HIGH | libxml2 DoS (frontend image only) | Rebuild nginx:alpine after upstream patch |
| CVE-2026-45445 | MEDIUM | OpenSSL AES-OCB | Rebuild with patched Alpine |
| CVE-2026-42764 | MEDIUM | OpenSSL QUIC null-deref | Rebuild with patched Alpine |
| CVE-2026-34182/3 | MEDIUM | OpenSSL CMS/QUIC | Rebuild with patched Alpine |

**Fix:** Rebuilding the images after Alpine patches are available resolves
all of these. Add `--no-cache` to CI build to ensure latest OS packages:

```yaml
# .github/workflows/build-and-push.yml
- uses: docker/build-push-action@v7
  with:
    no-cache: true   # always pull latest Alpine packages
```

Add a monthly scheduled CI job to rebuild images even without code changes:

```yaml
on:
  schedule:
    - cron: '0 3 1 * *'  # 1st of each month at 03:00 UTC
```

**Note:** `picomatch CVE-2026-33671` and the `brace-expansion` CVEs are in
npm's own bundled tooling (`/usr/local/lib/node_modules/npm/...`), not in
the project's `node_modules`. These are fixed by upgrading the Node.js base
image version.

---

## Phase 4 — Code quality / tech debt (~897 alerts, ongoing)

These are not security vulnerabilities. They indicate dead code, unreachable
branches, and TypeScript type mismatches that make the codebase harder to
maintain.

| Rule | Count | What it means |
|---|---|---|
| `js/comparison-between-incompatible-types` | 519 | Value compared to something it can never equal |
| `js/useless-comparison-test` | 140 | Condition always true or always false |
| `js/useless-assignment-to-local` | 105 | Variable written but never read |
| `js/use-before-declaration` | 88 | Variable used before its `let`/`const` |
| `js/trivial-conditional` | 50 | Dead `if (true)` / `if (false)` |
| `js/redundant-assignment` | 35 | Value overwritten before being read |

**Important:** The 519 `js/comparison-between-incompatible-types` count is
almost certainly inflated. CodeQL's JS engine generates false positives at
scale on TypeScript projects when the build step is not run before analysis.
Check `.github/workflows/security.yml` — if CodeQL's `autobuild` step does
not compile TypeScript first, add:

```yaml
- run: npm run build   # compile TS so CodeQL has full type information
  before:             # add before the CodeQL analyze step
```

This single change is likely to reduce the total alert count by 300–400.

**Approach for the remainder:** do not batch-fix these. Enable the
overlapping ESLint rules and let them surface during normal feature work:

```json
// .eslintrc (additions)
"no-unused-vars": "warn",
"no-constant-condition": "warn",
"@typescript-eslint/no-unnecessary-condition": "warn"
```

---

## Recommended Execution Order

```
Week 1:  Phase 1 — URL validation, path bounds check, log sanitisation,
         insecure-random audit, false-positive dismissals
         Also: add TypeScript build step to CodeQL workflow (Phase 4 pre-req)

Week 2:  Phase 2.1 — Rate limiting (with Redis store)

Week 3:  Phase 2.2 — CSRF (requires coordinated frontend + server change)

Ongoing: Phase 3 — rebuild images monthly via scheduled CI
         Phase 4 — tackle during regular sprint work
```

---

## Live Alert Count

```bash
gh api repos/joelmale/nexusVTT/code-scanning/alerts \
  --paginate -q '.[] | select(.state=="open") | .rule.security_severity_level' \
  | sort | uniq -c
```
