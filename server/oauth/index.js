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
      deviceUrl: provider.deviceUrl || null,
      scopes: provider.scopes,
    });
  }

  /**
   * Device Authorization (RFC 8628) helpers
   *
   * Exposes two lightweight handlers that work with providers that support the device
   * flow (for headless or remote environments). The handlers intentionally keep token
   * material off the response payloads; tokens are passed to `onSuccess` and stored
   * via the hosting application (the router itself never echoes tokens back to callers).
   *
   * Endpoints (to be wired by the server):
   * - POST /oauth/:provider/device/start   -> handleDeviceStart
   * - GET  /oauth/:provider/device/poll    -> handleDevicePoll?key=<key>
   *
   * Security notes:
   * - Device codes and tokens are treated as sensitive and are not returned in responses.
   * - The server stores transient device states in the provided `store` (MemoryStore by default).
   * - The `onSuccess` callback receives token objects so the hosting server may persist them
   *   to its secure token store (in-memory Map for dev; replace with durable encrypted store
   *   for production).
   */

  async function handleDeviceStart(req, res) {
    const providerId = String(req.params.provider || "").toLowerCase();
    const provider = providerMap.get(providerId);
    if (!provider) {
      res.status(404).json({ error: "Unknown provider." });
      return;
    }

    if (!provider.deviceUrl) {
      res
        .status(501)
        .json({ error: "Device flow not supported for this provider." });
      return;
    }

    try {
      const params = new URLSearchParams({
        client_id: provider.clientId,
        scope: Array.isArray(provider.scopes)
          ? provider.scopes.join(" ")
          : provider.scopes || "",
      });

      // If provider requires client_secret on device request (rare), attach it.
      if (provider.clientSecret && provider.tokenAuthMethod === "post") {
        params.set("client_secret", provider.clientSecret);
      }

      const tokenRes = await fetchFn(provider.deviceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text().catch(() => "");
        res
          .status(502)
          .json({
            error: `Device authorization request failed: ${tokenRes.status}`,
            details: text,
          });
        return;
      }

      const body = await tokenRes.json().catch(() => null);
      if (!body || !body.device_code) {
        res
          .status(502)
          .json({
            error: "Invalid device authorization response from provider.",
          });
        return;
      }

      // Create a local short key to reference this device flow in subsequent polls.
      const key = base64url(crypto.randomBytes(12));
      const expiresAt =
        typeof body.expires_in === "number"
          ? Date.now() + body.expires_in * 1000
          : null;

      // Store minimal information required to poll the token endpoint later.
      store.set(
        `device:${key}`,
        {
          providerId,
          deviceCode: body.device_code,
          userCode: body.user_code || null,
          verificationUri:
            body.verification_uri || body.verification_uri_complete || null,
          verificationUriComplete: body.verification_uri_complete || null,
          interval: typeof body.interval === "number" ? body.interval : 5,
          expiresAt,
        },
        body.expires_in ? body.expires_in * 1000 : undefined,
      );

      // Return verification information to the caller. Do NOT return device_code.
      res.json({
        provider: providerId,
        key,
        userCode: body.user_code || null,
        verificationUri: body.verification_uri || null,
        verificationUriComplete: body.verification_uri_complete || null,
        expiresIn: body.expires_in || null,
        interval: body.interval || 5,
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Device start failed." });
    }
  }

  async function handleDevicePoll(req, res) {
    // Accept either query param or body param `key`
    const key = String(
      (req.query && req.query.key) || (req.body && req.body.key) || "",
    ).trim();
    if (!key) {
      res.status(400).json({ error: "Missing key parameter." });
      return;
    }

    const entry = store.get(`device:${key}`);
    if (!entry) {
      res.status(404).json({ error: "Device flow not found or expired." });
      return;
    }

    const provider = providerMap.get(entry.providerId);
    if (!provider) {
      store.delete(`device:${key}`);
      res.status(404).json({ error: "Unknown provider for device flow." });
      return;
    }

    // Check expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(`device:${key}`);
      res.status(410).json({ error: "Device code expired." });
      return;
    }

    try {
      const params = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: entry.deviceCode,
        client_id: provider.clientId,
      });

      // If provider requires client_secret on token polling (post), attach it.
      if (provider.clientSecret && provider.tokenAuthMethod === "post") {
        params.set("client_secret", provider.clientSecret);
      }

      const tokenRes = await fetchFn(provider.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      // Many device flows return 200 with an error JSON - parse body to inspect
      const tokenBody = await tokenRes.json().catch(() => null);

      if (!tokenRes.ok) {
        // If non-200, surface a generic error with any provider text for debugging
        const text = tokenBody || (await tokenRes.text().catch(() => ""));
        res.status(502).json({ error: "Token polling failed", details: text });
        return;
      }

      if (tokenBody && tokenBody.error) {
        // Common device flow errors
        const e = tokenBody.error;
        if (e === "authorization_pending") {
          res.json({ status: "pending" });
          return;
        }
        if (e === "slow_down") {
          res.status(429).json({ status: "slow_down" });
          return;
        }
        if (e === "expired_token") {
          store.delete(`device:${key}`);
          res.status(410).json({ status: "expired" });
          return;
        }
        if (e === "access_denied") {
          store.delete(`device:${key}`);
          res.status(403).json({ status: "denied" });
          return;
        }
        // Unknown provider error
        res
          .status(400)
          .json({ error: e, description: tokenBody.error_description || null });
        return;
      }

      // Success: provider returned tokens. Do NOT echo tokens in the response.
      // Instead, call onSuccess hook so the hosting server can persist/store securely.
      await onSuccess?.(req, { providerId: provider.id, token: tokenBody });

      // Clean up the device flow entry
      store.delete(`device:${key}`);

      // Return a minimal connected status (no sensitive token material)
      res.json({
        status: "connected",
        provider: provider.id,
        receivedAt: Date.now(),
        expiresIn: tokenBody?.expires_in || null,
      });
      return;
    } catch (err) {
      res.status(500).json({ error: err?.message || "Device poll failed." });
      return;
    }
  }

  return {
    start: handleStart,
    callback: handleCallback,
    status: handleStatus,
    deviceStart: handleDeviceStart,
    devicePoll: handleDevicePoll,
    store,
    providers: providerMap,
  };
}

export { MemoryStore };
