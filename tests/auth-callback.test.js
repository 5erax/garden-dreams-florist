import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthCallback, authCallbackRoute } from "../src/auth-callback.js";

test("only auth callback parameters trigger account routing, including expired links", () => {
  for (const location of [
    { hash: "#access_token=test-only&refresh_token=test-only&type=recovery" },
    {
      hash: "#error=access_denied&error_code=otp_expired&error_description=untrusted-text",
    },
    { search: "?error_code=otp_expired" },
    { search: "?code=test-only" },
  ])
    assert.equal(isAuthCallback(location), true);
  for (const location of [
    { hash: "#account" },
    { hash: "#garden" },
    { hash: "#memory/test-only" },
    { search: "?utm_source=flowers" },
    {},
  ])
    assert.equal(isAuthCallback(location), false);
});
test("callback routing removes credentials and provider errors while preserving unrelated query data", () => {
  const route = authCallbackRoute({
    pathname: "/",
    search:
      "?utm_source=flowers&access_token=test-secret&refresh_token=test-secret&code=test-secret&expires_in=3600&expires_at=1234&token_type=bearer&type=recovery&error=error&error_code=otp_expired&error_description=untrusted-text",
    hash: "#access_token=another-test-secret",
  });
  assert.equal(route, "/?utm_source=flowers#account");
  assert.equal(
    authCallbackRoute({ pathname: "/", search: "?error_code=otp_expired" }),
    "/#account",
  );
  assert.equal(authCallbackRoute({ pathname: "/" }), "/#account");
});
