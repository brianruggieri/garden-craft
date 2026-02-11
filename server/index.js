import express from "express";
import { getProvider, listProviders } from "./providers/index.js";
import { createOAuthRouter } from "./oauth/index.js";
import { loadOAuthProviders } from "./oauth/providers.js";

const app = express();
const port = Number(process.env.PORT || 8787);

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
 * For production, replace with a durable, per-user store.
 */
const oauthTokenStore = new Map();

const oauthProviders = loadOAuthProviders(process.env, {
  baseUrl: process.env.BASE_URL || `http://localhost:${port}`,
  redirectBaseUrl: process.env.OAUTH_REDIRECT_BASE_URL,
  allowIncomplete: true,
  postAuthRedirect: process.env.OAUTH_POST_AUTH_REDIRECT || "/",
});

const oauthRouter = createOAuthRouter({
  providers: oauthProviders,
  onSuccess: async (req, { providerId, token }) => {
    oauthTokenStore.set(providerId, {
      token,
      receivedAt: Date.now(),
    });
  },
  onError: async (req, err) => {
    console.error("OAuth error:", err);
  },
});

/**
 * Health check.
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * Provider list for UI selection.
 */
app.get("/api/providers", (req, res) => {
  res.json({
    providers: listProviders(),
  });
});

/**
 * OAuth endpoints.
 */
app.get("/oauth/:provider/start", oauthRouter.start);
app.get("/oauth/:provider/callback", oauthRouter.callback);
app.get("/oauth/:provider/status", oauthRouter.status);

/**
 * Debug-only token status.
 * NOTE: For production, remove or protect this endpoint.
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
    tokenType: entry.token?.token_type,
    expiresIn: entry.token?.expires_in,
  });
});

/**
 * Main optimization endpoint.
 */
app.post("/api/optimize", async (req, res) => {
  try {
    const {
      provider: providerId = "local",
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
      auth,
      model,
    } = req.body || {};

    const provider = getProvider(providerId);
    if (!provider) {
      res.status(400).json({ error: "Unknown provider." });
      return;
    }

    const oauthTokenEntry = oauthTokenStore.get(
      String(providerId).toLowerCase(),
    );

    const resolvedAuth =
      auth ||
      (oauthTokenEntry?.token
        ? {
            oauthAccessToken: oauthTokenEntry.token.access_token,
          }
        : null);

    const layouts = await provider.generateLayout({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
      auth: resolvedAuth,
      model,
    });

    res.json({ provider: provider.id, layouts });
  } catch (err) {
    console.error("Optimize error:", err);
    res.status(500).json({
      error: err.message || "Optimization failed.",
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Garden Craft AI server running on http://localhost:${port}`);
});
