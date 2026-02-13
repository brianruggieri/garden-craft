import { Router } from "express";
import { createMcpSseRouter } from "../mcp/sseRouter";

const WELL_KNOWN_PATHS = [
  "/.well-known/openid-configuration",
  "/mcp/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server",
  "/mcp/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/mcp/.well-known/oauth-protected-resource",
];

interface McpRoutesOptions {
  baseUrl?: string;
  fallbackBaseUrl: string;
  enableSse: boolean;
  allowDevPush: boolean;
}

function buildDiscovery(req: any, baseUrl?: string) {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");
  const hostBase = baseUrl || `${proto}://${host}`;

  return {
    issuer: hostBase,
    authorization_endpoint: `${hostBase}/oauth/{provider}/start`,
    token_endpoint: `${hostBase}/oauth/{provider}/token`,
    device_authorization_endpoint: `${hostBase}/oauth/{provider}/device/start`,
    revocation_endpoint: `${hostBase}/oauth/{provider}/disconnect`,
    device_poll_endpoint: `${hostBase}/oauth/{provider}/device/poll`,
    sse: { url: `${hostBase}/mcp/sse` },
  };
}

export function createMcpRoutes({
  baseUrl,
  fallbackBaseUrl,
  enableSse,
  allowDevPush,
}: McpRoutesOptions): Router {
  const router = Router();

  /**
   * MCP OAuth discovery endpoint
   */
  router.get("/mcp/oauth_config", (req, res) => {
    res.json({
      oauth: {
        authorization_url: `${fallbackBaseUrl}/oauth/{provider}/start`,
        token_url: `${fallbackBaseUrl}/oauth/{provider}/token`,
        device_authorization_url: `${fallbackBaseUrl}/oauth/{provider}/device/start`,
        revoke_url: `${fallbackBaseUrl}/oauth/{provider}/disconnect`,
      },
    });
  });

  /**
   * Root-level OAuth config for MCP probes
   */
  router.get("/oauth_config", (req, res) => {
    res.json({
      oauth: {
        authorization_url: `${fallbackBaseUrl}/oauth/{provider}/start`,
        token_url: `${fallbackBaseUrl}/oauth/{provider}/token`,
        device_authorization_url: `${fallbackBaseUrl}/oauth/{provider}/device/start`,
        revoke_url: `${fallbackBaseUrl}/oauth/{provider}/disconnect`,
      },
      sse: {
        url: `${fallbackBaseUrl}/mcp/sse`,
      },
    });
  });

  /**
   * Well-known discovery paths
   */
  for (const path of WELL_KNOWN_PATHS) {
    router.get(path, (req, res) => {
      res.json(buildDiscovery(req, baseUrl));
    });
  }

  /**
   * Dev-only: Accept POST to base paths for probes
   */
  router.post("/mcp", (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  /**
   * MCP SSE (Server-Sent Events) router
   */
  if (enableSse) {
    const sseRouter = createMcpSseRouter({ allowDevPush });
    router.use(sseRouter);
  }

  return router;
}

export default {
  createMcpRoutes,
};
