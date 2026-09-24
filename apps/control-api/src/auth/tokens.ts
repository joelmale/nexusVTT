import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'nexus-control-api', purpose, 32));
}

/**
 * Keys derived from CONTROL_SESSION_SECRET. The session cookie is
 * `<random id>.<hmac>`; only sha256(<random id>) is stored in PostgreSQL. The
 * short-lived login-state cookie (state, nonce, PKCE verifier) is encrypted
 * with AES-256-GCM so the verifier is never readable in transit or at rest.
 */
export class CookieCrypto {
  private readonly signingKey: Buffer;
  private readonly encryptionKey: Buffer;

  constructor(secret: string) {
    this.signingKey = deriveKey(secret, 'session-cookie-signature');
    this.encryptionKey = deriveKey(secret, 'login-state-encryption');
  }

  private sign(value: string): string {
    return createHmac('sha256', this.signingKey).update(value, 'utf8').digest('base64url');
  }

  /** Returns the cookie value and the database key for a new session. */
  newSessionId(): { cookieValue: string; idHash: string } {
    const raw = randomToken(32);
    return { cookieValue: `${raw}.${this.sign(raw)}`, idHash: sha256Hex(raw) };
  }

  /** Verifies the signature and returns the database key, or null. */
  sessionHashFromCookie(cookieValue: string | undefined): string | null {
    if (!cookieValue || cookieValue.length > 200) return null;
    const dot = cookieValue.indexOf('.');
    if (dot <= 0) return null;
    const raw = cookieValue.slice(0, dot);
    const signature = cookieValue.slice(dot + 1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
    return safeEqual(signature, this.sign(raw)) ? sha256Hex(raw) : null;
  }

  seal(payload: object): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
  }

  open(sealed: string | undefined): unknown {
    if (!sealed || sealed.length > 2048) return null;
    const parts = sealed.split('.');
    if (parts.length !== 3) return null;
    try {
      const [iv, tag, body] = parts.map((part) => Buffer.from(part, 'base64url')) as [Buffer, Buffer, Buffer];
      if (iv.length !== 12 || tag.length !== 16) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
      return JSON.parse(plain) as unknown;
    } catch {
      return null;
    }
  }
}
