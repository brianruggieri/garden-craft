/**
 * Lightweight integration checks for core routes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config();

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8787";

describe("Core Route Integration Tests", () => {
  it("GET /api/health responds with ok", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.time, "Health response should include time");
  });

  it("GET /api/providers responds with provider list", async () => {
    const res = await fetch(`${BASE_URL}/api/providers`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.providers), "providers should be an array");
  });

  it("GET /api/catalog responds with plant catalog", async () => {
    const res = await fetch(`${BASE_URL}/api/catalog`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.plants, "catalog should include plants");
  });

  it("GET /oauth_config responds with MCP oauth discovery", async () => {
    const res = await fetch(`${BASE_URL}/oauth_config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.oauth, "oauth_config should include oauth");
  });

  it("GET /mcp/oauth_config responds with MCP oauth discovery", async () => {
    const res = await fetch(`${BASE_URL}/mcp/oauth_config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.oauth, "mcp/oauth_config should include oauth");
  });
});
