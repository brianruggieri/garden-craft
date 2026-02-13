import { Router } from "express";
import { listProviders } from "../providers/index";
import { getPlantCatalog } from "../plantCatalogRepo";
import { createOptimizeHandler } from "./optimize";
import { validateOptimize } from "../middleware/validation";

interface TokenEntry {
  accessToken: string;
  tokenType?: string | null;
  scopes?: string | null;
  hasRefreshToken?: boolean;
  receivedAt?: number;
  expiresAt?: number | null;
}

interface ApiRoutesOptions {
  oauthTokenStore: Map<string, TokenEntry>;
}

export function createApiRoutes({ oauthTokenStore }: ApiRoutesOptions): Router {
  const router = Router();

  /**
   * Provider list for UI selection
   */
  router.get("/api/providers", (req, res) => {
    res.json({
      providers: listProviders(),
    });
  });

  /**
   * Plant catalog for client UI
   */
  router.get("/api/catalog", async (req, res) => {
    try {
      const catalog = await getPlantCatalog();
      res.json(catalog);
    } catch (err) {
      res.status(500).json({ error: "Failed to load plant catalog" });
    }
  });

  /**
   * POST /api/optimize
   *
   * Main garden layout optimization endpoint.
   * Uses provider registry with structured output validation.
   * Validates incoming request body before processing.
   */
  router.post(
    "/api/optimize",
    validateOptimize,
    createOptimizeHandler(oauthTokenStore),
  );

  return router;
}

export default {
  createApiRoutes,
};
