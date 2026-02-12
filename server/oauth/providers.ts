const DEFAULT_SCOPE = "openid profile email";

export interface OAuthProvider {
  id: string;
  name: string;
  // Make common fields optional/null-able so provider lists can be created
  // even when some environment variables are not present.
  supportsOAuth?: boolean;
  authorizeUrl?: string | null;
  tokenUrl?: string | null;
  deviceUrl?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  scopes?: string[];
  redirectUri?: string | null;
  tokenAuthMethod?: "basic" | "post";
  extraAuthParams?: Record<string, string>;
  extraTokenParams?: Record<string, string>;
  postAuthRedirect?: string;
  baseUrl?: string | null;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).trim().replace(/\/+$/, "");
}

function parseScopes(
  value: string | string[] | undefined,
  fallback: string = DEFAULT_SCOPE,
): string[] {
  if (Array.isArray(value)) return value;
  const raw = (value || fallback || "").trim();
  if (!raw) return [];
  return raw.split(/[,\s]+/g).filter(Boolean);
}

function buildRedirectUri(
  providerId: string,
  base: string | null,
): string | null {
  const root = normalizeUrl(base);
  if (!root) return null;
  return `${root}/oauth/${providerId}/callback`;
}

interface EnsureConfigOptions {
  allowIncomplete?: boolean;
}

function ensureConfig(
  provider: Partial<OAuthProvider>,
  { allowIncomplete = false }: EnsureConfigOptions = {},
): OAuthProvider | null {
  if (allowIncomplete) return provider as OAuthProvider;
  if (!provider.clientId) return null;
  if (!provider.authorizeUrl) return null;
  if (!provider.tokenUrl) return null;
  if (!provider.redirectUri) return null;
  return provider as OAuthProvider;
}

export interface LoadOAuthProvidersOptions {
  baseUrl?: string;
  redirectBaseUrl?: string;
  allowIncomplete?: boolean;
  postAuthRedirect?: string;
}

export function loadOAuthProviders(
  env: NodeJS.ProcessEnv = process.env,
  {
    baseUrl,
    redirectBaseUrl,
    allowIncomplete = false,
    postAuthRedirect,
  }: LoadOAuthProvidersOptions = {},
): OAuthProvider[] {
  const base = normalizeUrl(baseUrl);
  const redirectBase = normalizeUrl(redirectBaseUrl || base);

  const gemini = ensureConfig(
    {
      id: "gemini",
      name: "Google Gemini",
      supportsOAuth: true,
      authorizeUrl:
        env.GEMINI_OAUTH_AUTHORIZE_URL ||
        env.GOOGLE_OAUTH_AUTHORIZE_URL ||
        null,
      tokenUrl:
        env.GEMINI_OAUTH_TOKEN_URL || env.GOOGLE_OAUTH_TOKEN_URL || null,
      clientId:
        env.GEMINI_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || null,
      clientSecret:
        env.GEMINI_OAUTH_CLIENT_SECRET ||
        env.GOOGLE_OAUTH_CLIENT_SECRET ||
        null,
      scopes: parseScopes(env.GEMINI_OAUTH_SCOPES || env.GOOGLE_OAUTH_SCOPES),
      redirectUri:
        env.GEMINI_OAUTH_REDIRECT_URI ||
        env.GOOGLE_OAUTH_REDIRECT_URI ||
        buildRedirectUri("gemini", redirectBase),
      tokenAuthMethod:
        (env.GEMINI_OAUTH_TOKEN_AUTH_METHOD as "basic" | "post") || "post",
      extraAuthParams: {},
      extraTokenParams: {},
      postAuthRedirect,
      baseUrl: base,
    },
    { allowIncomplete },
  );

  const openai = ensureConfig(
    {
      id: "openai",
      name: "OpenAI",
      supportsOAuth: true,
      authorizeUrl: env.OPENAI_OAUTH_AUTHORIZE_URL || null,
      tokenUrl: env.OPENAI_OAUTH_TOKEN_URL || null,
      deviceUrl: env.OPENAI_OAUTH_DEVICE_URL || null,
      clientId: env.OPENAI_OAUTH_CLIENT_ID || null,
      clientSecret: env.OPENAI_OAUTH_CLIENT_SECRET || null,
      scopes: parseScopes(env.OPENAI_OAUTH_SCOPES),
      redirectUri:
        env.OPENAI_OAUTH_REDIRECT_URI ||
        buildRedirectUri("openai", redirectBase),
      tokenAuthMethod:
        (env.OPENAI_OAUTH_TOKEN_AUTH_METHOD as "basic" | "post") || "post",
      extraAuthParams: {},
      extraTokenParams: {},
      postAuthRedirect,
      baseUrl: base,
    },
    { allowIncomplete },
  );

  const anthropic = ensureConfig(
    {
      id: "anthropic",
      name: "Anthropic",
      supportsOAuth: true,
      authorizeUrl: env.ANTHROPIC_OAUTH_AUTHORIZE_URL || null,
      tokenUrl: env.ANTHROPIC_OAUTH_TOKEN_URL || null,
      clientId: env.ANTHROPIC_OAUTH_CLIENT_ID || null,
      clientSecret: env.ANTHROPIC_OAUTH_CLIENT_SECRET || null,
      scopes: parseScopes(env.ANTHROPIC_OAUTH_SCOPES),
      redirectUri:
        env.ANTHROPIC_OAUTH_REDIRECT_URI ||
        buildRedirectUri("anthropic", redirectBase),
      tokenAuthMethod:
        (env.ANTHROPIC_OAUTH_TOKEN_AUTH_METHOD as "basic" | "post") || "post",
      extraAuthParams: {},
      extraTokenParams: {},
      postAuthRedirect,
      baseUrl: base,
    },
    { allowIncomplete },
  );

  return [gemini, openai, anthropic].filter(
    (p): p is OAuthProvider => p !== null,
  );
}

export default {
  loadOAuthProviders,
};
