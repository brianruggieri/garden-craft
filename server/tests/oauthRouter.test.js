import test from 'node:test';
import assert from 'node:assert/strict';
import { createOAuthRouter, MemoryStore } from '../oauth/index.js';

// Lightweight mock response object for Express-like handlers
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
    redirect(url) {
      // store the url on the object so tests can read it
      this._redirected = url;
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

test('oauth start redirects to provider authorize URL with PKCE params', async (t) => {
  const providers = [
    {
      id: 'gemini',
      name: 'Test Gemini',
      authorizeUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:8787/oauth/gemini/callback',
      scopes: ['openid', 'profile', 'email'],
      extraAuthParams: {},
      extraTokenParams: {},
    },
  ];

  const router = createOAuthRouter({ providers });
  const req = { params: { provider: 'gemini' }, query: { redirect: '/after' } };
  const res = makeRes();

  await router.start(req, res);

  assert.ok(res._redirected, 'Expected redirect to be issued');

  const u = new URL(res._redirected);
  assert.strictEqual(u.origin + u.pathname, 'https://auth.example.com/authorize');
  const params = u.searchParams;
  assert.strictEqual(params.get('client_id'), 'test-client-id');
  assert.strictEqual(params.get('redirect_uri'), 'http://localhost:8787/oauth/gemini/callback');
  assert.ok(params.get('state'), 'state param should be present');
  assert.ok(params.get('code_challenge'), 'code_challenge param should be present');
  assert.strictEqual(params.get('response_type'), 'code');
  assert.ok(params.get('scope').includes('openid'));

  // Ensure the state was saved in the store
  // The router exposes the internal store via router.store
  const state = params.get('state');
  const stored = router.store.get(`state:${state}`);
  assert.ok(stored, 'State should be stored in the router store');
  assert.strictEqual(stored.providerId, 'gemini');
});

test('oauth status returns provider metadata', async (t) => {
  const providers = [
    {
      id: 'gemini',
      name: 'Test Gemini',
      authorizeUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:8787/oauth/gemini/callback',
      scopes: ['openid', 'profile', 'email'],
      extraAuthParams: {},
      extraTokenParams: {},
    },
  ];

  const router = createOAuthRouter({ providers });
  const req = { params: { provider: 'gemini' } };
  const res = makeRes();

  await router.status(req, res);

  const payload = res._getPayload();
  assert.ok(payload, 'Expected JSON payload');
  assert.strictEqual(payload.provider, 'gemini');
  assert.strictEqual(payload.authorizeUrl, 'https://auth.example.com/authorize');
  assert.strictEqual(payload.tokenUrl, 'https://auth.example.com/token');
  assert.deepStrictEqual(payload.scopes, ['openid', 'profile', 'email']);
});

// MemoryStore expiry behavior test
test('memory store expires keys after TTL', async (t) => {
  const store = new MemoryStore();
  store.set('foo', { a: 1 }, 50); // 50 ms
  const first = store.get('foo');
  assert.deepStrictEqual(first, { a: 1 });
  // wait 70ms
  await new Promise((r) => setTimeout(r, 70));
  const second = store.get('foo');
  assert.strictEqual(second, null);
});
