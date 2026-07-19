# Network Architecture & Session/Cookie Configuration

## Overview

Nexus VTT uses a **reverse proxy architecture** with nginx sitting in front of both the React frontend (static files) and the Express backend (API + WebSocket server). All communication happens over the same domain (`app.nexusvtt.com`) to avoid CORS issues and simplify session management.

---

## Network Architecture

### Production Stack (Docker Swarm)

```
                    ┌─────────────────────────┐
                    │   Internet (HTTPS)      │
                    │  app.nexusvtt.com       │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   Reverse Proxy         │
                    │   (Traefik/etc)         │
                    │   - SSL Termination     │
                    │   - Port 443 → 80       │
                    └───────────┬─────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │        nginx (Frontend Service)           │
        │  Serves: Static files + Reverse Proxy     │
        │  Port: 80 (internal)                      │
        └───────────┬─────────────┬─────────────────┘
                    │             │
        ┌───────────┘             └──────────┐
        │                                    │
        ▼                                    ▼
┌───────────────┐                  ┌──────────────────┐
│  Static Files │                  │  Backend Server  │
│  - index.html │                  │  (Express + WS)  │
│  - *.js, *.css│                  │  Port: 5000      │
│  - assets/    │                  └────────┬─────────┘
└───────────────┘                           │
                                            │
                        ┌───────────────────┼───────────────┐
                        │                   │               │
                        ▼                   ▼               ▼
                ┌──────────────┐    ┌─────────────┐  ┌──────────┐
                │  PostgreSQL  │    │   Redis     │  │  Other   │
                │  Port: 5432  │    │  Port: 6379 │  │ Services │
                └──────────────┘    └─────────────┘  └──────────┘
```

### Service Discovery (Docker Swarm)

All services communicate using **Docker Swarm's internal DNS**:

- Service names from `docker-compose.yml` become DNS entries
- Example: `postgres` resolves to the PostgreSQL service IP
- Stack prefix (`nexusvtt_`) is only for container names, not DNS

**Key Point:** Use service names from the compose file, not stack-prefixed names!

```yaml
# docker-compose.yml
services:
  postgres:    # ← Use this name in DATABASE_URL
    ...
  redis:       # ← Use this name in REDIS_URL
    ...
  backend:     # ← nginx proxies to this
    ...
```

---

## nginx Reverse Proxy Configuration

### Location Blocks

nginx routes requests based on URL path:

```nginx
location /ws {
    # WebSocket connections
    proxy_pass http://nexusvtt_backend:5000;
}

location /api {
    # REST API calls
    proxy_pass http://nexusvtt_backend:5000;
}

location /auth {
    # OAuth and authentication
    proxy_pass http://nexusvtt_backend:5000;
}

location / {
    # Static files (React SPA)
    try_files $uri $uri/ /index.html;
}
```

### Request Flow Examples

**Frontend Asset Request:**
```
GET https://app.nexusvtt.com/assets/logo.png
→ nginx serves from /usr/share/nginx/html/assets/logo.png
```

**API Request:**
```
GET https://app.nexusvtt.com/api/campaigns
→ nginx proxies to http://nexusvtt_backend:5000/api/campaigns
→ Backend handles request
→ nginx returns response to browser
```

**WebSocket Connection:**
```
WSS wss://app.nexusvtt.com/ws
→ nginx upgrades to WebSocket
→ Proxies to ws://nexusvtt_backend:5000/ws
→ Persistent connection maintained
```

---

## Session & Cookie Architecture

### Session Flow

Nexus VTT uses **server-side sessions** stored in PostgreSQL via `express-session` and `connect-pg-simple`.

```
┌──────────────────────────────────────────────────────────┐
│                    Session Lifecycle                      │
└──────────────────────────────────────────────────────────┘

1. User Login (OAuth or Guest)
   ┌────────┐      POST /api/guest-users      ┌─────────┐
   │Browser │ ──────────────────────────────► │ Backend │
   └────────┘                                  └────┬────┘
                                                    │
                                    ┌───────────────▼────────┐
                                    │ Create user in DB      │
                                    │ Generate session ID    │
                                    │ Store in PostgreSQL    │
                                    └───────────┬────────────┘
                                                │
   ┌────────┐  Set-Cookie: connect.sid=xyz    │
   │Browser │ ◄────────────────────────────────┘
   └────────┘

2. Browser Stores Cookie
   ┌──────────────────────────────────┐
   │  Browser Cookie Storage          │
   │  Domain: app.nexusvtt.com        │
   │  Name: connect.sid               │
   │  Value: s%3A<session-id>.<sig>   │
   │  Path: /                         │
   │  Secure: true (HTTPS only)       │
   │  HttpOnly: true                  │
   │  SameSite: Lax                   │
   └──────────────────────────────────┘

3. Subsequent Requests Include Cookie
   ┌────────┐  GET /api/campaigns             ┌─────────┐
   │Browser │  Cookie: connect.sid=xyz  ────► │ Backend │
   └────────┘                                  └────┬────┘
                                                    │
                                    ┌───────────────▼────────┐
                                    │ Read session ID        │
                                    │ Query PostgreSQL       │
                                    │ Load session data      │
                                    │ Identify user          │
                                    └────────────────────────┘
```

### Cookie Configuration

**Backend (Express):**

```typescript
// server/index.ts
session({
  store: sessionStore,              // PostgreSQL session store
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,                   // HTTPS only in production
    httpOnly: true,                 // No JavaScript access
    sameSite: 'lax',               // CSRF protection
    path: '/',                      // Valid for entire domain
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
})
```

**nginx (Proxy Configuration):**

```nginx
# Critical: Forward cookies in BOTH directions

location /api {
    proxy_pass http://nexusvtt_backend:5000;

    # Browser → Backend: Forward Cookie header
    proxy_set_header Cookie $http_cookie;

    # Backend → Browser: Forward Set-Cookie header
    proxy_pass_header Set-Cookie;

    # Ensure cookie path is correct
    proxy_cookie_path / /;
}

location /auth {
    # Same cookie configuration
    proxy_set_header Cookie $http_cookie;
    proxy_pass_header Set-Cookie;
    proxy_cookie_path / /;
}

location /ws {
    # WebSocket ALSO needs cookies for session
    proxy_set_header Cookie $http_cookie;
    # (Set-Cookie not needed for WS, but Cookie is!)
}
```

---

## Why Cookie Forwarding is Critical

### Without Cookie Forwarding

```
Browser                  nginx                  Backend
  │                        │                       │
  │  GET /api/me           │                       │
  │  Cookie: sid=123   ──► │  GET /api/me          │
  │                        │  (no Cookie!)     ──► │
  │                        │                       │ ❌ No session
  │                        │                       │ ❌ 401 Unauthorized
  │                        │  ◄────────────────────┤
  │  ◄─────────────────────┤                       │
  │  401 Unauthorized      │                       │
```

### With Cookie Forwarding

```
Browser                  nginx                  Backend
  │                        │                       │
  │  GET /api/me           │                       │
  │  Cookie: sid=123   ──► │  GET /api/me          │
  │                        │  Cookie: sid=123  ──► │
  │                        │                       │ ✅ Read session
  │                        │                       │ ✅ Identify user
  │                        │  ◄────────────────────┤
  │                        │  200 OK               │
  │  ◄─────────────────────┤  {user data}          │
  │  200 OK                │                       │
  │  {user data}           │                       │
```

---

## Session Types

### 1. OAuth Sessions (Google, Discord)

```typescript
// Stored via Passport.js
req.session.passport = {
  user: {
    id: 'uuid',
    email: 'user@example.com',
    name: 'User Name',
    avatarUrl: 'https://...',
    provider: 'google'
  }
}
```

**Flow:**
1. User clicks "Login with Google"
2. Redirected to Google OAuth
3. Google redirects to `/auth/google/callback`
4. Backend creates user in database
5. Passport serializes user to session
6. `Set-Cookie: connect.sid=...` sent to browser
7. All future requests include cookie
8. `req.isAuthenticated()` returns true

### 2. Guest Sessions

```typescript
// Stored directly in session
req.session.guestUser = {
  id: 'uuid',
  name: 'Guest Name',
  provider: 'guest'
}
```

**Flow:**
1. User enters name, clicks "Start as Guest DM"
2. Frontend calls `POST /api/guest-users`
3. Backend creates user in database
4. Backend stores in session
5. `Set-Cookie: connect.sid=...` sent to browser
6. WebSocket connection includes cookie
7. Backend reads session from cookie
8. Backend uses guest user ID from session

---

## WebSocket Session Handling

### The Challenge

WebSocket connections start as HTTP upgrade requests, so they need special handling:

```javascript
// WebSocket upgrade request
GET /ws HTTP/1.1
Host: app.nexusvtt.com
Upgrade: websocket
Connection: Upgrade
Cookie: connect.sid=s%3A...  // ← Must be included!
```

### Backend Session Reading

```typescript
// server/index.ts - handleConnection()
private async handleConnection(ws: WebSocket, req: RequestWithSession) {
  const user = req.session?.passport?.user;
  const guestUser = req.session?.guestUser;

  // Priority: OAuth user > Guest user > Generate new UUID
  let uuid = user?.id || guestUser?.id || uuidv4();
  let displayName = user?.name || guestUser?.name || 'Guest';

  // Create connection object with user identity
  const connection: Connection = {
    id: uuid,
    ws: ws,
    name: displayName,
    // ...
  };
}
```

**Critical:** If the Cookie header is missing:
- `req.session` is a new empty session
- `guestUser` is undefined
- Backend generates a **new random UUID**
- This UUID doesn't exist in the database
- Creating campaigns/sessions fails with foreign key violations

---

## Common Issues & Solutions

### Issue 1: "User not authenticated" after OAuth login

**Symptom:**
- OAuth succeeds
- Redirects to dashboard
- Immediately redirects back to lobby
- Console: `GET /auth/me 401 (Unauthorized)`

**Cause:** Session cookie not forwarded through nginx proxy

**Solution:** Add cookie headers to nginx `/auth` and `/api` locations:
```nginx
proxy_set_header Cookie $http_cookie;
proxy_pass_header Set-Cookie;
```

---

### Issue 2: "Failed to create session" for guest DM

**Symptom:**
- WebSocket connects successfully
- Server error: "Failed to create session"
- PostgreSQL: Foreign key constraint violation on `campaigns.dmId`

**Cause:** Session cookie not forwarded to WebSocket upgrade request

**Solution:** Add cookie header to nginx `/ws` location:
```nginx
proxy_set_header Cookie $http_cookie;
```

---

### Issue 3: Sessions expire immediately

**Symptom:**
- Login works
- After refresh, logged out again
- Session doesn't persist

**Possible Causes:**
1. **SESSION_SECRET not set** - Sessions can't be decrypted
2. **PostgreSQL session store failing** - Can't persist sessions
3. **Cookie domain mismatch** - Cookie not sent with requests
4. **Secure flag in HTTP** - Cookie requires HTTPS

**Solution:**
- Set `SESSION_SECRET` environment variable
- Verify PostgreSQL connection
- Check cookie domain matches site domain
- Ensure `secure: true` only in production (with HTTPS)

---

## Environment Variables Reference

### Required for Sessions

```bash
# Session secret - MUST be set in production
SESSION_SECRET=<generate with: openssl rand -base64 32>

# Database for session storage
DATABASE_URL=postgresql://nexus:password@postgres:5432/nexus

# Production mode (enables secure cookies)
NODE_ENV=production
```

### Session Store Table

Sessions are stored in PostgreSQL via `connect-pg-simple`:

```sql
-- Auto-created by connect-pg-simple
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
```

Automatic cleanup of expired sessions happens via PostgreSQL:
```sql
DELETE FROM session WHERE expire < NOW();
```

---

## Security Considerations

### Cookie Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `HttpOnly` | `true` | Prevents JavaScript from accessing cookie (XSS protection) |
| `Secure` | `true` (prod) | Only send over HTTPS (prevents MITM) |
| `SameSite` | `Lax` | CSRF protection (allows navigation, blocks cross-site forms) |
| `Path` | `/` | Cookie sent with all requests to domain |
| `Domain` | (not set) | Defaults to current domain only |

### Trust Proxy

Backend must trust nginx proxy to read correct client IP and protocol:

```typescript
// server/index.ts
app.set('trust proxy', 1);
```

This allows Express to:
- Read `X-Forwarded-Proto` (http vs https)
- Set `secure` cookie flag based on original protocol
- Read `X-Forwarded-For` for real client IP

### Session Storage

**Why PostgreSQL?**
- Persistent across server restarts
- Shared across multiple backend replicas
- Automatic expiration via TTL
- ACID guarantees for session data

**Why not Redis for session records?**
- PostgreSQL is already the durable authority for users and campaigns.
- Redis is reserved for cross-replica WebSocket fanout, renewable presence,
  and host leases; losing Redis does not erase authenticated sessions.
- One durable store avoids split ownership of session identity and game data.

---

## Testing Session/Cookie Functionality

### 1. Check Cookie is Set

**Chrome DevTools:**
1. F12 → Application tab
2. Cookies → https://app.nexusvtt.com
3. Look for `connect.sid`
4. Verify attributes:
   - Path: `/`
   - Secure: ✓ (if HTTPS)
   - HttpOnly: ✓
   - SameSite: `Lax`

### 2. Verify Cookie is Sent

**Network tab:**
1. Make a request to `/api/me`
2. Check Request Headers
3. Should see: `Cookie: connect.sid=s%3A...`

### 3. Check Backend Receives Cookie

**Backend logs:**
```typescript
// Add temporary logging
console.log('Session:', req.session);
console.log('User:', req.session?.passport?.user);
console.log('Guest:', req.session?.guestUser);
```

Should show session data if cookie forwarding works.

### 4. Verify WebSocket Has Cookie

**Browser console:**
```javascript
// Check WebSocket headers (before connection)
const ws = new WebSocket('wss://app.nexusvtt.com/ws');

// In browser DevTools → Network → WS → Headers
// Should see Cookie: connect.sid=...
```

---

## Architecture Benefits

### Single Domain (app.nexusvtt.com)

✅ **No CORS issues** - Same origin for all requests
✅ **Simpler cookie management** - One domain, one cookie
✅ **Better security** - No cross-domain cookie sharing
✅ **Easier SSL** - One certificate, one domain

### nginx Reverse Proxy

✅ **Load balancing** - Can route to multiple backend replicas
✅ **SSL termination** - nginx handles HTTPS, backend uses HTTP
✅ **Static file serving** - nginx serves assets efficiently
✅ **Caching** - Can cache API responses at proxy level
✅ **Rate limiting** - Can implement at proxy level

### Server-Side Sessions

✅ **More secure** - Sensitive data never sent to client
✅ **Smaller cookies** - Just session ID, not full user data
✅ **Server control** - Can invalidate sessions server-side
✅ **Supports large data** - No cookie size limits

---

## Related Documentation

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment guide
- [CLAUDE.md](../CLAUDE.md) - Full architecture overview
- [server/schema.sql](../server/schema.sql) - Database schema
- [docker/nginx.conf](../docker/nginx.conf) - nginx configuration
