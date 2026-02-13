import { config } from "dotenv";
import express from "express";
import { createApiRoutes } from "./routes/api";
import { createHealthRoutes } from "./routes/health";
import { createMcpRoutes } from "./routes/mcp";
import { createOAuthRoutes } from "./routes/oauth";
import { corsMiddleware } from "./middleware/cors";

// Load .env file if it exists
config();

const app = express();
const port = Number(process.env.PORT || 8787);
const baseUrl = process.env.BASE_URL || "";
const fallbackBaseUrl = baseUrl || `http://localhost:${port}`;

// CORS and JSON middleware
app.use(express.json({ limit: "500kb" }));
app.use(corsMiddleware);

// OAuth routes + token store (shared with optimize handler)
const { router: oauthRouter, tokenStore: oauthTokenStore } = createOAuthRoutes({
  env: process.env,
  baseUrl: fallbackBaseUrl,
  redirectBaseUrl: process.env.OAUTH_REDIRECT_BASE_URL,
  postAuthRedirect: process.env.OAUTH_POST_AUTH_REDIRECT || "/",
});

// API routes
const apiRouter = createApiRoutes({ oauthTokenStore });

// MCP routes
const enableMcpSse = process.env.ENABLE_MCP_SSE !== "false";
const allowDevPush = process.env.ENABLE_MCP_PUSH !== "false";
const mcpRouter = createMcpRoutes({
  baseUrl,
  fallbackBaseUrl,
  enableSse: enableMcpSse,
  allowDevPush,
});

// Health + root routes
const healthRouter = createHealthRoutes();

app.use(apiRouter);
app.use(oauthRouter);
app.use(mcpRouter);
app.use(healthRouter);

// ========================================================================
// START SERVER
// ========================================================================

app.listen(port, "0.0.0.0", () => {
  console.log(
    `Garden Craft AI server running on ${fallbackBaseUrl} (local port ${port})`,
  );
  console.log("MCP SSE enabled:", enableMcpSse ? "yes" : "no");
});
