import * as client from 'openid-client';

export interface LoginChecks {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface VerifiedClaims {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  /** ID token `auth_time` (seconds since the epoch) when present and numeric. */
  authTime: number | null;
}

export interface BeginLoginOptions {
  /**
   * Step-up re-authentication: asks the IdP to re-authenticate the user now
   * (`max_age=0`) instead of reusing an existing IdP session. Google ignores
   * `prompt=login`, so `max_age=0` plus the `auth_time` check is the lever.
   */
  stepUp?: boolean;
}

export interface IdentityProvider {
  /** Creates fresh state, nonce, and PKCE verifier plus the redirect URL. */
  beginLogin(options?: BeginLoginOptions): Promise<{ url: URL; checks: LoginChecks }>;
  /**
   * Exchanges the authorization code (PKCE) and validates the ID token's
   * issuer, audience, expiry, state, and nonce. Throws on any mismatch.
   */
  completeLogin(callbackUrl: URL, checks: LoginChecks): Promise<VerifiedClaims>;
}

export class OpenIdProvider implements IdentityProvider {
  private configuration: Promise<client.Configuration> | null = null;

  constructor(
    private readonly loadConfiguration: () => Promise<client.Configuration>,
    private readonly redirectUri: string,
  ) {}

  /** Google discovery is lazy so startup and readiness never depend on Google. */
  static google(options: { clientId: string; clientSecret: string; redirectUri: string; issuer: string }): OpenIdProvider {
    return new OpenIdProvider(
      () =>
        client.discovery(new URL(options.issuer), options.clientId, {
          client_secret: options.clientSecret,
          redirect_uris: [options.redirectUri],
          response_types: ['code'],
        }),
      options.redirectUri,
    );
  }

  private config(): Promise<client.Configuration> {
    if (!this.configuration) {
      this.configuration = this.loadConfiguration().then((configuration) => {
        // Also verify the ID token's JWS signature against the IdP's JWKS,
        // not only TLS to the token endpoint.
        client.enableNonRepudiationChecks(configuration);
        return configuration;
      }).catch((error: unknown) => {
        // Do not cache a failed discovery; the next login retries.
        this.configuration = null;
        throw error;
      });
    }
    return this.configuration;
  }

  async beginLogin(options: BeginLoginOptions = {}): Promise<{ url: URL; checks: LoginChecks }> {
    const configuration = await this.config();
    const checks: LoginChecks = {
      state: client.randomState(),
      nonce: client.randomNonce(),
      codeVerifier: client.randomPKCECodeVerifier(),
    };
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state: checks.state,
      nonce: checks.nonce,
      code_challenge: await client.calculatePKCECodeChallenge(checks.codeVerifier),
      code_challenge_method: 'S256',
      // Normal logins let the user pick an account; step-up forces a fresh
      // authentication and the callback requires a matching `auth_time`.
      ...(options.stepUp ? { max_age: '0' } : { prompt: 'select_account' }),
    });
    return { url, checks };
  }

  async completeLogin(callbackUrl: URL, checks: LoginChecks): Promise<VerifiedClaims> {
    const configuration = await this.config();
    const tokens = await client.authorizationCodeGrant(configuration, callbackUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new Error('ID token has no subject');
    }
    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      authTime: typeof claims.auth_time === 'number' && Number.isFinite(claims.auth_time) ? claims.auth_time : null,
    };
  }
}
