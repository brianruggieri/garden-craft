/**
 * Centralized authentication resolution
 *
 * Resolves authentication credentials from multiple sources in priority order:
 * 1. Explicit auth object passed in request (apiKey or oauthAccessToken)
 * 2. OAuth token store (server-side session tokens)
 * 3. Environment variables (provider-specific API keys)
 *
 * This ensures consistent auth behavior across all endpoints and providers.
 */

interface AuthObject {
  apiKey?: string;
  oauthAccessToken?: string;
}

interface TokenEntry {
  accessToken: string;
  tokenType?: string | null;
  scopes?: string | null;
  hasRefreshToken?: boolean;
  receivedAt?: number;
  expiresAt?: number | null;
}

interface ResolveAuthOptions {
  providerId: string;
  auth?: AuthObject;
  tokenStore?: Map<string, TokenEntry>;
}

interface HasAuthOptions {
  providerId: string;
  auth?: AuthObject;
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve authentication for a provider request
 *
 * @param options - Resolution options
 * @param options.providerId - Provider identifier ('openai', 'anthropic', 'gemini', 'local')
 * @param options.auth - Explicit auth from request { apiKey?, oauthAccessToken? }
 * @param options.tokenStore - OAuth token store (Map<providerId, tokenEntry>)
 * @returns Resolved auth object or undefined if no auth available
 */
export function resolveAuth({
  providerId,
  auth,
  tokenStore,
}: ResolveAuthOptions): AuthObject | undefined {
  // Priority 1: Explicit auth from request
  if (auth) {
    if (auth.apiKey || auth.oauthAccessToken) {
      return auth;
    }
  }

  // Priority 2: OAuth token store (server-side session)
  if (tokenStore) {
    const tokenEntry = tokenStore.get(String(providerId).toLowerCase());
    if (tokenEntry?.accessToken) {
      return {
        oauthAccessToken: tokenEntry.accessToken,
      };
    }
  }

  // Priority 3: No auth object returned - providers will check env vars as fallback
  return undefined;
}

/**
 * Validate that authentication is available for a provider
 *
 * @param options - Validation options
 * @param options.providerId - Provider identifier
 * @param options.auth - Resolved auth object
 * @param options.env - Environment variables
 * @returns True if auth is available
 */
export function hasAuth({
  providerId,
  auth,
  env = process.env,
}: HasAuthOptions): boolean {
  // Check resolved auth object
  if (auth?.apiKey || auth?.oauthAccessToken) {
    return true;
  }

  // Check environment variables as fallback
  const envKeys: Record<string, string[] | null> = {
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    local: null, // Local provider doesn't need auth
  };

  const keys = envKeys[String(providerId).toLowerCase()];
  if (!keys) return true; // Unknown provider or no auth needed

  return keys.some((key) => Boolean(env[key]));
}

export default {
  resolveAuth,
  hasAuth,
};
