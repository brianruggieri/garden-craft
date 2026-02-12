import test from "node:test";
import assert from "node:assert/strict";
import { createOAuthRouter, MemoryStore } from "../../../oauth/index.js";

/**
 * Unit tests for the Device Authorization (RFC 8628) flow.
 *
 * These tests mock the network layer by passing a custom `fetchFn` into the
 * OAuth router. They verify:
 *  - device start returns verification info and stores a transient device entry
 *  - device polling surfaces `authorization_pending` and then handles successful token return
 *
 * The router is configured with an `onSuccess` hook that receives token objects;
 * tests use that hook to assert the token handling behavior without exposing token
 * material in responses.
 */

/* Lightweight mock response object for Express-like handlers */
function makeRes() {
  let _payload = null;
  let _status = 200;
  return {
    _getPayload() {
      return _payload;
    },
    _getStatus() {
      return _status;
    },
    json(payload) {
      _payload = payload;
    },
    status(code) {
      _status = code;
      return this;
    },
  };
}

test("device start returns verification info and stores device entry", async () => {
  const provider = {
    id: "openai",
    name: "OpenAI",
    supportsOAuth: true,
    deviceUrl: "https://auth.example.com/device",
    tokenUrl: "https://auth.example.com/token",
    clientId: "openai-client",
    clientSecret: null,
    scopes: ["openid", "email"],
    redirectUri: "http://localhost:8787/oauth/openai/callback",
    tokenAuthMethod: "post",
  };

  // Mock fetchFn for device authorization endpoint
  const deviceBody = {
    device_code: "device-code-123",
    user_code: "USER-CODE",
    verification_uri: "https://auth.example.com/activate",
    verification_uri_complete:
      "https://auth.example.com/activate?user_code=USER-CODE",
    expires_in: 600,
    interval: 5,
  };

  const fetchFn = async (url, opts) => {
    if (String(url).startsWith(provider.deviceUrl)) {
      return {
        ok: true,
        status: 200,
        json: async () => deviceBody,
        text: async () => JSON.stringify(deviceBody),
      };
    }
    // Should not reach token endpoint in this test
    return { ok: false, status: 404, text: async () => "not found" };
  };

  const router = createOAuthRouter({
    providers: [provider],
    fetchFn,
    store: new MemoryStore(),
    onSuccess: async () => {
      // Not used in this test
    },
    onError: async () => {},
  });

  const req = { params: { provider: "openai" }, body: {} };
  const res = makeRes();

  await router.deviceStart(req, res);

  const payload = res._getPayload();
  assert.ok(payload, "Expected JSON payload from deviceStart");
  assert.strictEqual(payload.provider, "openai");
  assert.ok(payload.key, "Expected a local key to be returned");
  assert.strictEqual(
    payload.userCode,
    deviceBody.user_code,
    "Expected user_code to be returned",
  );
  assert.ok(
    payload.verificationUri || payload.verificationUriComplete,
    "Expected a verification URI",
  );

  // The router should have stored the device flow keyed by device:<key>
  const stored = router.store.get(`device:${payload.key}`);
  assert.ok(stored, "Expected device flow entry in router.store");
  assert.strictEqual(stored.deviceCode, deviceBody.device_code);
  assert.strictEqual(stored.verificationUri, deviceBody.verification_uri);
});

test("device poll returns pending then connected and calls onSuccess", async () => {
  const provider = {
    id: "openai",
    name: "OpenAI",
    supportsOAuth: true,
    deviceUrl: "https://auth.example.com/device",
    tokenUrl: "https://auth.example.com/token",
    clientId: "openai-client",
    clientSecret: "openai-secret",
    scopes: ["openid", "email"],
    redirectUri: "http://localhost:8787/oauth/openai/callback",
    tokenAuthMethod: "post",
  };

  // Sequence control for mocked token polling
  let pollCount = 0;

  // Mock fetchFn to handle device start and token polling
  const fetchFn = async (url, opts) => {
    if (String(url).startsWith(provider.deviceUrl)) {
      // device start response
      return {
        ok: true,
        status: 200,
        json: async () => ({
          device_code: "device-code-xyz",
          user_code: "CODE-XYZ",
          verification_uri: "https://auth.example.com/activate",
          expires_in: 600,
          interval: 5,
        }),
        text: async () => "{}",
      };
    }

    if (String(url).startsWith(provider.tokenUrl)) {
      // token polling behavior: first call -> authorization_pending, second -> success
      pollCount++;
      if (pollCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ error: "authorization_pending" }),
          text: async () => '{"error":"authorization_pending"}',
        };
      }
      // success on second poll
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-abc",
          token_type: "bearer",
          expires_in: 3600,
          scope: "openid email",
        }),
        text: async () =>
          '{"access_token":"access-abc","token_type":"bearer","expires_in":3600}',
      };
    }

    return { ok: false, status: 404, text: async () => "not found" };
  };

  // Capture onSuccess invocation
  let onSuccessCalled = false;
  let captured = null;
  const onSuccess = async (req, { providerId, token }) => {
    onSuccessCalled = true;
    captured = { providerId, token };
    // For security, do not log token contents here in tests
  };

  const router = createOAuthRouter({
    providers: [provider],
    fetchFn,
    store: new MemoryStore(),
    onSuccess,
    onError: async () => {},
  });

  // 1) Start device flow
  const startReq = { params: { provider: "openai" }, body: {} };
  const startRes = makeRes();
  await router.deviceStart(startReq, startRes);
  const startPayload = startRes._getPayload();
  assert.ok(startPayload && startPayload.key, "start should return a key");

  const key = startPayload.key;

  // 2) First poll: should return pending
  const pollReq1 = { params: { provider: "openai" }, query: { key } };
  const pollRes1 = makeRes();
  await router.devicePoll(pollReq1, pollRes1);
  const p1 = pollRes1._getPayload();
  assert.ok(p1, "Expected payload for first poll");
  assert.strictEqual(p1.status, "pending", "First poll should be pending");

  // 3) Second poll: should succeed and call onSuccess
  const pollReq2 = { params: { provider: "openai" }, query: { key } };
  const pollRes2 = makeRes();
  await router.devicePoll(pollReq2, pollRes2);
  const p2 = pollRes2._getPayload();
  assert.ok(p2, "Expected payload for second poll");
  assert.strictEqual(p2.status, "connected", "Second poll should be connected");
  assert.ok(
    onSuccessCalled,
    "onSuccess should have been invoked for successful poll",
  );
  assert.strictEqual(
    captured?.providerId,
    "openai",
    "onSuccess called with correct providerId",
  );
  assert.ok(
    captured?.token?.access_token,
    "Token object should include access_token",
  );

  // After successful poll, the device entry must be removed from the store
  const storedAfter = router.store.get(`device:${key}`);
  assert.strictEqual(
    storedAfter,
    null,
    "Device flow entry should be removed after success",
  );
});
