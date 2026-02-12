import { config } from "dotenv";
import express from "express";
import { getProvider, listProviders } from "./providers/index.js";
import { createOAuthRouter } from "./oauth/index.js";
import { loadOAuthProviders } from "./oauth/providers.js";
import { createMcpSseRouter } from "./mcp/sseRouter.js";
import { getPlantCatalog } from "./plantCatalogRepo.js";
import { createOptimizeHandler } from "./routes/optimize.js";
import { validateOptimize } from "./middleware/validation.js";

// Load .env file if it exists
config();

const app = express();
const port = Number(process.env.PORT || 8787);

// CORS and JSON middleware
app.use(express.json({ limit: "500kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

/**
 * In-memory token store (single-instance, dev-friendly).
 * For production, replace with a durable, per-user, encrypted store.
 *
 * Security notes:
 * - This store keeps tokens only in memory for local/dev use.
 * - We intentionally avoid logging token contents anywhere.
 * - The stored shape intentionally separates raw token material from public metadata.
 */
const oauthTokenStore = new Map();

// Load OAuth provider configurations
const oauthProviders = loadOAuthProviders(process.env, {
  baseUrl: process.env.BASE_URL || `http://localhost:${port}`,
  redirectBaseUrl: process.env.OAUTH_REDIRECT_BASE_URL,
  allowIncomplete: true,
  postAuthRedirect: process.env.OAUTH_POST_AUTH_REDIRECT || "/",
});

/**
 * OAuth router with success/error hooks.
 */
const oauthRouter = createOAuthRouter({
  providers: oauthProviders,
  onSuccess: async (req, { providerId, token }) => {
    const receivedAt = Date.now();
    const expiresInMs =
      typeof token?.expires_in === "number" ? token.expires_in * 1000 : null;

    oauthTokenStore.set(String(providerId).toLowerCase(), {
      accessToken: token?.access_token || null,
      tokenType: token?.token_type || null,
      scopes: token?.scope || null,
      hasRefreshToken: typeof token?.refresh_token === "string",
      receivedAt,
      expiresAt: expiresInMs ? receivedAt + expiresInMs : null,
    });
  },
  onError: async (req, err) => {
    console.error("OAuth error during provider flow");
  },
});

// ============================================================================
// HEALTH & METADATA ENDPOINTS
// ============================================================================

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * Provider list for UI selection
 */
app.get("/api/providers", (req, res) => {
  res.json({
    providers: listProviders(),
  });
});

/**
 * Plant catalog for client UI
 */
app.get("/api/catalog", async (req, res) => {
  try {
    const catalog = await getPlantCatalog();
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: "Failed to load plant catalog" });
  }
});

// ============================================================================
// OAUTH ENDPOINTS
// ============================================================================

/**
 * OAuth flow endpoints (PKCE, device flow, etc.)
 */
app.get("/oauth/:provider/start", oauthRouter.start);
app.get("/oauth/:provider/callback", oauthRouter.callback);
app.get("/oauth/:provider/status", oauthRouter.status);

/**
 * Device Authorization (RFC 8628) endpoints for headless / remote flows
 */
app.post("/oauth/:provider/device/start", oauthRouter.deviceStart);
app.post("/oauth/:provider/device/poll", oauthRouter.devicePoll);
app.get("/oauth/:provider/device/poll", oauthRouter.devicePoll);

/**
 * Check if provider is connected
 */
app.get("/oauth/:provider/connected", (req, res) => {
  const providerId = String(req.params.provider || "").toLowerCase();
  const entry = oauthTokenStore.get(providerId);
  const now = Date.now();
  const connected = Boolean(
    entry && (!entry.expiresAt || entry.expiresAt > now),
  );
  if (!connected && entry?.expiresAt && entry.expiresAt <= now) {
    oauthTokenStore.delete(providerId);
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
app.get("/oauth/:provider/token", (req, res) => {
  const providerId = String(req.params.provider || "").toLowerCase();
  const entry = oauthTokenStore.get(providerId);
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
app.post("/oauth/:provider/disconnect", (req, res) => {
  const providerId = String(req.params.provider || "").toLowerCase();
  const existed = oauthTokenStore.has(providerId);
  oauthTokenStore.delete(providerId);
  res.json({ provider: providerId, disconnected: existed });
});

// ============================================================================
// OPTIMIZATION ENDPOINT (MAIN API)
// ============================================================================

/**
 * POST /api/optimize
 *
 * Main garden layout optimization endpoint.
 * Uses provider registry with structured output validation.
 * Validates incoming request body before processing.
 */
app.post(
  "/api/optimize",
  validateOptimize,
  createOptimizeHandler(oauthTokenStore),
);

// ============================================================================
// MCP (Model Context Protocol) ENDPOINTS
// ============================================================================

/**
 * MCP OAuth discovery endpoint
 */
app.get("/mcp/oauth_config", (req, res) => {
  const base = process.env.BASE_URL || `http://localhost:${port}`;
  res.json({
    oauth: {
      authorization_url: `${base}/oauth/{provider}/start`,
      token_url: `${base}/oauth/{provider}/token`,
      device_authorization_url: `${base}/oauth/{provider}/device/start`,
      revoke_url: `${base}/oauth/{provider}/disconnect`,
    },
  });
});

/**
 * Root-level OAuth config for MCP probes
 */
app.get("/oauth_config", (req, res) => {
  const base = process.env.BASE_URL || `http://localhost:${port}`;
  res.json({
    oauth: {
      authorization_url: `${base}/oauth/{provider}/start`,
      token_url: `${base}/oauth/{provider}/token`,
      device_authorization_url: `${base}/oauth/{provider}/device/start`,
      revoke_url: `${base}/oauth/{provider}/disconnect`,
    },
    sse: {
      url: `${base}/mcp/sse`,
    },
  });
});

/**
 * MCP SSE (Server-Sent Events) router
 */
const enableMcpSse = process.env.ENABLE_MCP_SSE !== "false";
if (enableMcpSse) {
  const mcpRouter = createMcpSseRouter({
    allowDevPush: process.env.ENABLE_MCP_PUSH !== "false",
  });
  app.use(mcpRouter);
}

// ============================================================================
// WELL-KNOWN & DISCOVERY ENDPOINTS (DEV-ONLY)
// ============================================================================

/**
 * Build discovery object from request
 */
const buildDiscovery = (req) => {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");
  const hostBase = process.env.BASE_URL || `${proto}://${host}`;

  return {
    issuer: hostBase,
    authorization_endpoint: `${hostBase}/oauth/{provider}/start`,
    token_endpoint: `${hostBase}/oauth/{provider}/token`,
    device_authorization_endpoint: `${hostBase}/oauth/{provider}/device/start`,
    revocation_endpoint: `${hostBase}/oauth/{provider}/disconnect`,
    device_poll_endpoint: `${hostBase}/oauth/{provider}/device/poll`,
    sse: { url: `${hostBase}/mcp/sse` },
  };
};

/**
 * Well-known discovery paths
 */
const wellKnownPaths = [
  "/.well-known/openid-configuration",
  "/mcp/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server",
  "/mcp/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/mcp/.well-known/oauth-protected-resource",
];

for (const p of wellKnownPaths) {
  app.get(p, (req, res) => {
    res.json(buildDiscovery(req));
  });
}

/**
 * Dev-only: Accept POST to base paths for probes
 */
app.post("/mcp", express.json(), (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/", express.json(), (req, res) => {
  res.json({ ok: true, path: "/", timestamp: new Date().toISOString() });
});

/**
 * Root GET handler
 */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Garden Craft AI server",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(port, "0.0.0.0", () => {
  const effectiveBase = process.env.BASE_URL || `http://localhost:${port}`;
  console.log(
    `Garden Craft AI server running on ${effectiveBase} (local port ${port})`,
  );
  console.log("MCP SSE enabled:", enableMcpSse ? "yes" : "no");
});
