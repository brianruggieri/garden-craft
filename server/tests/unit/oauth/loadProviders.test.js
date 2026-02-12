import test from "node:test";
import assert from "node:assert/strict";
import { loadOAuthProviders } from "../../../oauth/providers.js";

test("loadOAuthProviders loads OpenAI provider config from env", () => {
  const env = {
    OPENAI_OAUTH_AUTHORIZE_URL: "https://auth.openai.example/authorize",
    OPENAI_OAUTH_TOKEN_URL: "https://auth.openai.example/token",
    OPENAI_OAUTH_CLIENT_ID: "openai-client-id",
    OPENAI_OAUTH_CLIENT_SECRET: "openai-client-secret",
    OPENAI_OAUTH_SCOPES: "openid profile email",
    // Intentionally omit OPENAI_OAUTH_REDIRECT_URI to test default redirect URI generation
  };

  const baseUrl = "http://localhost:8787";
  const providers = loadOAuthProviders(env, {
    baseUrl,
    allowIncomplete: false,
  });

  const openai = providers.find((p) => p.id === "openai");
  assert.ok(openai, "Expected OpenAI provider to be present");

  assert.strictEqual(
    openai.authorizeUrl,
    env.OPENAI_OAUTH_AUTHORIZE_URL,
    "authorizeUrl should be taken from env",
  );
  assert.strictEqual(
    openai.tokenUrl,
    env.OPENAI_OAUTH_TOKEN_URL,
    "tokenUrl should be taken from env",
  );
  assert.strictEqual(
    openai.clientId,
    env.OPENAI_OAUTH_CLIENT_ID,
    "clientId should be taken from env",
  );
  assert.strictEqual(
    openai.clientSecret,
    env.OPENAI_OAUTH_CLIENT_SECRET,
    "clientSecret should be taken from env",
  );

  assert.deepStrictEqual(
    openai.scopes,
    ["openid", "profile", "email"],
    "scopes should be parsed into an array",
  );

  const expectedRedirect = `${baseUrl.replace(/\/+$/, "")}/oauth/openai/callback`;
  assert.strictEqual(
    openai.redirectUri,
    expectedRedirect,
    "redirectUri should be generated from baseUrl when not provided",
  );

  assert.strictEqual(
    openai.tokenAuthMethod,
    "post",
    "default tokenAuthMethod should be 'post'",
  );
});
