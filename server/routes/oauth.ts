import { Router } from "express";
import { createOAuthRouter } from "../oauth/index";
import { loadOAuthProviders } from "../oauth/providers";

interface TokenEntry {
  accessToken: string;
  tokenType?: string | null;
  scopes?: string | null;
  hasRefreshToken?: boolean;
  receivedAt?: number;
  expiresAt?: number | null;
}

interface OAuthRoutesOptions {
  env?: NodeJS.ProcessEnv;
  baseUrl: string;
  redirectBaseUrl?: string;
  postAuthRedirect?: string;
}

export function createOAuthRoutes({
  env = process.env,
  baseUrl,
  redirectBaseUrl,
  postAuthRedirect,
}: OAuthRoutesOptions): { router: Router; tokenStore: Map<string, TokenEntry> } {
  // In-memory token store (single-instance, dev-friendly).
  const tokenStore = new Map<string, TokenEntry>();

  // Load OAuth provider configurations
  const oauthProviders = loadOAuthProviders(env, {
    baseUrl,
    redirectBaseUrl,
    allowIncomplete: true,
    postAuthRedirect,
  });

  /**
   * OAuth router with success/error hooks.
   */
  const oauthRouter = createOAuthRouter({
    providers: oauthProviders,
    onSuccess: async (req: any, { providerId, token }: any) => {
      const receivedAt = Date.now();
      const expiresInMs =
        typeof token?.expires_in === "number" ? token.expires_in * 1000 : null;

      tokenStore.set(String(providerId).toLowerCase(), {
        accessToken: token?.access_token || null,
        tokenType: token?.token_type || null,
        scopes: token?.scope || null,
        hasRefreshToken: typeof token?.refresh_token === "string",
        receivedAt,
        expiresAt: expiresInMs ? receivedAt + expiresInMs : null,
      });
    },
    onError: async (req: any, err: any) => {
      console.error("OAuth error during provider flow");
    },
  });

  const router = Router();

  /**
   * OAuth flow endpoints (PKCE, device flow, etc.)
   */
  router.get("/oauth/:provider/start", oauthRouter.start);
  router.get("/oauth/:provider/callback", oauthRouter.callback);
  router.get("/oauth/:provider/status", oauthRouter.status);

  /**
   * Device Authorization (RFC 8628) endpoints for headless / remote flows
   */
  router.post("/oauth/:provider/device/start", oauthRouter.deviceStart);
  router.post("/oauth/:provider/device/poll", oauthRouter.devicePoll);
  router.get("/oauth/:provider/device/poll", oauthRouter.devicePoll);

  /**
   * Check if provider is connected
   */
  router.get("/oauth/:provider/connected", (req, res) => {
    const providerId = String(req.params.provider || "").toLowerCase();
    const entry = tokenStore.get(providerId);
    const now = Date.now();
    const connected = Boolean(
      entry && (!entry.expiresAt || entry.expiresAt > now),
    );
    if (!connected && entry?.expiresAt && entry.expiresAt <= now) {
      tokenStore.delete(providerId);
    }
    res.json({
      provider: providerId,
      connected,
      expiresAt: entry?.expiresAt || null,
    });
  });

  /**
   * Get token metadata (no sensitive data)
   */
  router.get("/oauth/:provider/token", (req, res) => {
    const providerId = String(req.params.provider || "").toLowerCase();
    const entry = tokenStore.get(providerId);
    if (!entry) {
      res.status(404).json({ error: "No token stored." });
      return;
    }
    res.json({
      provider: providerId,
      receivedAt: entry.receivedAt,
      expiresAt: entry.expiresAt || null,
      tokenType: entry.tokenType || null,
      hasRefreshToken: Boolean(entry.hasRefreshToken),
    });
  });

  /**
   * Disconnect a provider (dev-only)
   */
  router.post("/oauth/:provider/disconnect", (req, res) => {
    const providerId = String(req.params.provider || "").toLowerCase();
    const existed = tokenStore.has(providerId);
    tokenStore.delete(providerId);
    res.json({ provider: providerId, disconnected: existed });
  });

  return { router, tokenStore };
}

export default {
  createOAuthRoutes,
};
