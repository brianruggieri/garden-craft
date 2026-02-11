import express from "express";

/**
 * Dev-safe SSE scaffold for MCP (Server-Sent Events)
 *
 * - GET  /mcp/sse    -> opens an SSE connection
 * - POST /mcp/push   -> (dev-only) broadcast a test event or send to specific client
 * - GET  /mcp/status -> (dev-only) show connected client count
 *
 * Usage:
 *   import { createMcpSseRouter } from "./mcp/sseRouter.js";
 *   app.use(createMcpSseRouter({ allowDevPush: true }));
 *
 * Security:
 * - This module is intended for local development and testing only.
 * - The dev push/status endpoints should be disabled or protected in production.
 * - Do NOT expose raw token material via SSE; treat SSE as a transport for structured events.
 */

export function createMcpSseRouter({ allowDevPush = true } = {}) {
  const router = express.Router();

  // Keep a mapping of clientId -> response object
  const clients = new Map();
  let nextClientId = 1;

  /**
   * Helper: write an SSE event to a response
   * Format:
   *   event: <name>\n
   *   data: <json-string>\n
   *   \n
   */
  const sendEvent = (res, eventName, data) => {
    try {
      // `data` should be JSON-serializable; we stringify on send
      const payload = JSON.stringify(data === undefined ? null : data);
      res.write(`event: ${eventName}\n`);
      // Split data by newlines per SSE spec; send as multiple data: lines if needed
      // but here we keep it simple: single data line with JSON string
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      // If writing fails, the client likely disconnected; ignore here.
    }
  };

  /**
   * GET /mcp/sse
   * Opens a Server-Sent Events connection and registers the client.
   */
  router.get("/mcp/sse", (req, res) => {
    // Recommended headers for SSE
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // For local dev convenience; restrict in production
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send an initial comment to ensure the stream is open (helps some proxies)
    res.write(": connected\n\n");

    const clientId = String(nextClientId++);
    clients.set(clientId, res);

    // Send an initial connection event to the client with its id
    sendEvent(res, "mcp.connected", { clientId });

    // Periodic keep-alive comment to prevent idle timeouts (15s)
    const keepAlive = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch (err) {
        // ignore; cleanup will occur on close
      }
    }, 15000);

    // Clean up when the connection closes
    req.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(clientId);
    });
  });

  /**
   * Dev-only: POST /mcp/push
   * Body: { event?: string, data?: any, to?: clientId }
   *
   * If `to` is provided, sends to a specific client; otherwise broadcasts to all.
   */
  if (allowDevPush) {
    // Ensure body is parsed
    router.post("/mcp/push", express.json(), (req, res) => {
      const { event = "mcp.message", data = {}, to } = req.body || {};

      if (to) {
        const dest = clients.get(String(to));
        if (!dest) {
          res.status(404).json({ error: "Client not found" });
          return;
        }
        sendEvent(dest, event, data);
        res.json({ ok: true, sentTo: to });
        return;
      }

      // Broadcast to all clients
      for (const [, dest] of clients) {
        sendEvent(dest, event, data);
      }
      res.json({ ok: true, clients: clients.size });
    });
  }

  /**
   * Dev-only: GET /mcp/status
   * Returns number of connected clients and their ids.
   */
  router.get("/mcp/status", (req, res) => {
    res.json({ clients: clients.size, clientIds: Array.from(clients.keys()) });
  });

  /**
   * Programmatic helpers attached to the router instance
   * These can be used by server code to push MCP events when the server
   * is wired to provider logic (e.g. push layout result events).
   */
  router._sendToAll = (eventName, payload) => {
    for (const [, dest] of clients) {
      sendEvent(dest, eventName, payload);
    }
  };

  router._sendToClient = (clientId, eventName, payload) => {
    const dest = clients.get(String(clientId));
    if (dest) sendEvent(dest, eventName, payload);
  };

  // Expose a small safe API to inspect number of clients (programmatically)
  router._clientCount = () => clients.size;

  return router;
}
