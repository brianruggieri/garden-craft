const DEFAULT_SCOPE = "openid profile email";

function normalizeUrl(value) {
  if (!value) return null;
  return String(value).trim().replace(/\/+$/, "");
}

function parseScopes(value, fallback = DEFAULT_SCOPE) {
  if (Array.isArray(value)) return value;
  const raw = (value || fallback || "").trim();
  if (!raw) return [];
  return raw.split(/[,\s]+/g).filter(Boolean);
}

function buildRedirectUri(providerId, base) {
  const root = normalizeUrl(base);
  if (!root) return null;
  return `${root}/oauth/${providerId}/callback`;
}

function ensureConfig(provider, { allowIncomplete = false } = {}) {
  if (allowIncomplete) return provider;
  if (!provider.clientId) return null;
  if (!provider.authorizeUrl) return null;
  if (!provider.tokenUrl) return null;
  if (!provider.redirectUri) return null;
  return provider;
}

export function loadOAuthProviders(
  env = process.env,
  {
    baseUrl,
    redirectBaseUrl,
    allowIncomplete = false,
    postAuthRedirect,
  } = {},
) {
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
        env.GEMINI_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || null,
      scopes: parseScopes(env.GEMINI_OAUTH_SCOPES || env.GOOGLE_OAUTH_SCOPES),
      redirectUri:
        env.GEMINI_OAUTH_REDIRECT_URI ||
        env.GOOGLE_OAUTH_REDIRECT_URI ||
        buildRedirectUri("gemini", redirectBase),
      tokenAuthMethod: env.GEMINI_OAUTH_TOKEN_AUTH_METHOD || "post",
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
      clientId: env.OPENAI_OAUTH_CLIENT_ID || null,
      clientSecret: env.OPENAI_OAUTH_CLIENT_SECRET || null,
      scopes: parseScopes(env.OPENAI_OAUTH_SCOPES),
      redirectUri:
        env.OPENAI_OAUTH_REDIRECT_URI ||
        buildRedirectUri("openai", redirectBase),
      tokenAuthMethod: env.OPENAI_OAUTH_TOKEN_AUTH_METHOD || "post",
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
      tokenAuthMethod: env.ANTHROPIC_OAUTH_TOKEN_AUTH_METHOD || "post",
      extraAuthParams: {},
      extraTokenParams: {},
      postAuthRedirect,
      baseUrl: base,
    },
    { allowIncomplete },
  );

  return [gemini, openai, anthropic].filter(Boolean);
}

export default {
  loadOAuthProviders,
};
