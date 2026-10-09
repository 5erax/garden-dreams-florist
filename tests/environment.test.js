import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkEnvironment,
  checkBackendEnvironment,
  productionProjectRef,
  stagingProjectRef,
} from "../src/environment.js";

const remote = (ref) => ({
  VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_configuration_only",
});
test("configuration fails closed on cross-environment backends and preview production overrides", () => {
  assert.equal(checkEnvironment({}).environment, "demo");
  assert.equal(
    checkEnvironment({ ...remote(stagingProjectRef), VERCEL_ENV: "preview" })
      .environment,
    "staging",
  );
  assert.equal(
    checkEnvironment({
      ...remote(productionProjectRef),
      VERCEL_ENV: "production",
    }).environment,
    "production",
  );
  for (const env of [
    { ...remote(productionProjectRef), VERCEL_ENV: "preview" },
    {
      ...remote(productionProjectRef),
      VERCEL_ENV: "preview",
      VITE_APP_ENV: "production",
    },
    { ...remote(productionProjectRef), VITE_APP_ENV: "staging" },
    { ...remote(productionProjectRef) },
    { ...remote(stagingProjectRef), VERCEL_ENV: "production" },
    { ...remote(stagingProjectRef), VITE_APP_ENV: "production" },
    { ...remote(stagingProjectRef), VITE_APP_ENV: "demo" },
    { VITE_APP_ENV: "staging" },
    { VITE_SUPABASE_URL: "https://example.com" },
  ])
    assert.throws(() => checkEnvironment(env));
});
test("only public frontend keys and plain trusted HTTPS/loopback endpoints are accepted", () => {
  const env = { ...remote(stagingProjectRef), VITE_APP_ENV: "staging" };
  for (const url of [
    "http://tgvozhrkolcpszyyrgth.supabase.co",
    "https://user:pass@tgvozhrkolcpszyyrgth.supabase.co",
    "https://tgvozhrkolcpszyyrgth.supabase.co/path",
    "https://tgvozhrkolcpszyyrgth.supabase.co?x=1",
    "https://tgvozhrkolcpszyyrgth.supabase.co.evil.test",
  ])
    assert.throws(() => checkEnvironment({ ...env, VITE_SUPABASE_URL: url }));
  const jwt = (role) =>
    `eyJheader.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  for (const key of [
    "sb_secret_not_public",
    jwt("service_role"),
    "eyJinvalid",
    "unknown",
  ])
    assert.throws(
      () => checkEnvironment({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
      /FRONTEND_REQUIRES_PUBLIC_KEY/,
    );
  assert.equal(
    checkEnvironment({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon") })
      .environment,
    "staging",
  );
  assert.equal(
    checkEnvironment({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test_only",
    }).environment,
    "local",
  );
});
test("backend runtime must confirm both environment and project identity", () => {
  const config = checkEnvironment({
    ...remote(stagingProjectRef),
    VITE_APP_ENV: "staging",
  });
  checkBackendEnvironment(config, {
    environment: "staging",
    projectRef: stagingProjectRef,
  });
  for (const runtime of [
    null,
    { environment: "production", projectRef: productionProjectRef },
    { environment: "staging", projectRef: productionProjectRef },
  ])
    assert.throws(
      () => checkBackendEnvironment(config, runtime),
      /BACKEND_ENV_MISMATCH/,
    );
});
