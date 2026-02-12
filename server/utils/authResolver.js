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

/**
 * Resolve authentication for a provider request
 *
 * @param {Object} options
 * @param {string} options.providerId - Provider identifier ('openai', 'anthropic', 'gemini', 'local')
 * @param {Object} options.auth - Explicit auth from request { apiKey?, oauthAccessToken? }
 * @param {Map} options.tokenStore - OAuth token store (Map<providerId, tokenEntry>)
 * @returns {Object|undefined} Resolved auth object or undefined if no auth available
 */
export function resolveAuth({ providerId, auth, tokenStore }) {
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
 * @param {Object} options
 * @param {string} options.providerId - Provider identifier
 * @param {Object} options.auth - Resolved auth object
 * @param {Object} options.env - Environment variables
 * @returns {boolean} True if auth is available
 */
export function hasAuth({ providerId, auth, env = process.env }) {
  // Check resolved auth object
  if (auth?.apiKey || auth?.oauthAccessToken) {
    return true;
  }

  // Check environment variables as fallback
  const envKeys = {
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
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
