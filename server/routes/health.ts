import { Router } from "express";

export function createHealthRoutes(): Router {
  const router = Router();

  /**
   * Health check
   */
  router.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  /**
   * Root POST handler (dev-only)
   */
  router.post("/", (req, res) => {
    res.json({ ok: true, path: "/", timestamp: new Date().toISOString() });
  });

  /**
   * Root GET handler
   */
  router.get("/", (req, res) => {
    res.json({
      ok: true,
      message: "Garden Craft AI server",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

export default {
  createHealthRoutes,
};
