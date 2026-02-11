import crypto from "crypto";
import { URLSearchParams } from "url";

/**
 * Generic OAuth helper endpoints for AI providers.
 *
 * This module is provider-agnostic: each provider definition supplies:
 * - authorizeUrl
 * - tokenUrl
 * - clientId
 * - clientSecret (optional for PKCE-only)
 * - scopes
 * - redirectUri
 * - extraAuthParams
 * - extraTokenParams
 * - tokenAuthMethod: "basic" | "post"
 *
 * It exposes a minimal in-memory state store and routes for:
 * - GET  /oauth/:provider/start
 * - GET  /oauth/:provider/callback
 * - GET  /oauth/:provider/status
 *
 * NOTE: For production, replace MemoryStore with a durable store.
 */

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

class MemoryStore {
  constructor() {
    this._map = new Map();
  }
  set(key, value, ttlMs = DEFAULT_STATE_TTL_MS) {
    const expiresAt = Date.now() + ttlMs;
    this._map.set(key, { value, expiresAt });
  }
  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return null;
    }
    return entry.value;
  }
  delete(key) {
    this._map.delete(key);
  }
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createVerifier() {
  return base64url(crypto.randomBytes(32));
}

function createChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64url(hash);
}

function buildAuthUrl({
  authorizeUrl,
  clientId,
  redirectUri,
  scopes = [],
  state,
  codeChallenge,
  extraAuthParams = {},
}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: Array.isArray(scopes) ? scopes.join(" ") : scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    ...extraAuthParams,
  });

  return `${authorizeUrl}?${params.toString()}`;
}

async function exchangeToken({
  tokenUrl,
  code,
  clientId,
  clientSecret,
  redirectUri,
  codeVerifier,
  tokenAuthMethod = "basic",
  extraTokenParams = {},
  fetchFn,
}) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    ...extraTokenParams,
  });

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (tokenAuthMethod === "basic" && clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  } else if (tokenAuthMethod === "post" && clientSecret) {
    params.set("client_secret", clientSecret);
  }

  const res = await fetchFn(tokenUrl, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

function createProviderRegistry(providers = []) {
  const map = new Map();
  providers.forEach((p) => {
    if (!p || !p.id) return;
    map.set(String(p.id).toLowerCase(), p);
  });
  return map;
}

export function createOAuthRouter({
  providers = [],
  store = new MemoryStore(),
  fetchFn = fetch,
  onSuccess,
  onError,
} = {}) {
  const providerMap = createProviderRegistry(providers);

  async function handleStart(req, res) {
    const providerId = String(req.params.provider || "").toLowerCase();
    const provider = providerMap.get(providerId);
    if (!provider) {
      res.status(404).json({ error: "Unknown provider." });
      return;
    }

    const state = base64url(crypto.randomBytes(24));
    const verifier = createVerifier();
    const challenge = createChallenge(verifier);

    const redirectTarget =
      (req.query && req.query.redirect) || provider.postAuthRedirect || "/";

    store.set(`state:${state}`, {
      providerId,
      verifier,
      redirectTarget,
    });

    const url = buildAuthUrl({
      authorizeUrl: provider.authorizeUrl,
      clientId: provider.clientId,
      redirectUri: provider.redirectUri,
      scopes: provider.scopes,
      state,
      codeChallenge: challenge,
      extraAuthParams: provider.extraAuthParams,
    });

    res.redirect(url);
  }

  async function handleCallback(req, res) {
    const { code, state, error, error_description } = req.query || {};
    if (error) {
      onError?.(req, { error, error_description });
      res.status(400).json({ error, error_description });
      return;
    }

    const cached = store.get(`state:${state}`);
    if (!cached) {
      res.status(400).json({ error: "Invalid or expired state." });
      return;
    }

    store.delete(`state:${state}`);

    const provider = providerMap.get(cached.providerId);
    if (!provider) {
      res.status(404).json({ error: "Unknown provider." });
      return;
    }

    try {
      const token = await exchangeToken({
        tokenUrl: provider.tokenUrl,
        code,
        clientId: provider.clientId,
        clientSecret: provider.clientSecret,
        redirectUri: provider.redirectUri,
        codeVerifier: cached.verifier,
        tokenAuthMethod: provider.tokenAuthMethod,
        extraTokenParams: provider.extraTokenParams,
        fetchFn,
      });

      await onSuccess?.(req, { providerId: provider.id, token });

      const redirectTo = cached.redirectTarget || "/";
      res.redirect(redirectTo);
    } catch (err) {
      onError?.(req, err);
      res.status(500).json({ error: err.message || "Token exchange failed." });
    }
  }

  async function handleStatus(req, res) {
    const providerId = String(req.params.provider || "").toLowerCase();
    const provider = providerMap.get(providerId);
    if (!provider) {
      res.status(404).json({ error: "Unknown provider." });
      return;
    }

    res.json({
      provider: provider.id,
      supportsOAuth: Boolean(provider.supportsOAuth ?? true),
      authorizeUrl: provider.authorizeUrl,
      tokenUrl: provider.tokenUrl,
      scopes: provider.scopes,
    });
  }

  return {
    start: handleStart,
    callback: handleCallback,
    status: handleStatus,
    store,
    providers: providerMap,
  };
}

export { MemoryStore };
