export const productionProjectRef = "ztzpipgptticvliotbsc";
export const stagingProjectRef = "tgvozhrkolcpszyyrgth";

export function checkEnvironment(env, { command = "build" } = {}) {
  const url = env.VITE_SUPABASE_URL?.trim() || "";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const declared = env.VITE_APP_ENV?.trim();
  if (Boolean(url) !== Boolean(key))
    throw new Error("SUPABASE_CONFIG_INCOMPLETE");
  const environment =
    declared ||
    (!url
      ? "demo"
      : env.VERCEL_ENV === "production"
        ? "production"
        : env.VERCEL_ENV === "preview"
          ? "staging"
          : "local");
  if (!["demo", "local", "staging", "production"].includes(environment))
    throw new Error("INVALID_APP_ENV");
  if (env.VERCEL_ENV === "preview" && environment === "production")
    throw new Error("PREVIEW_CANNOT_USE_PRODUCTION");
  if (command === "serve" && environment === "production")
    throw new Error("DEV_CANNOT_USE_PRODUCTION");
  if (
    env.VERCEL_ENV === "production" &&
    !["production", "demo"].includes(environment)
  )
    throw new Error("PRODUCTION_CANNOT_USE_TEST_BACKEND");
  if (!url) {
    if (environment !== "demo") throw new Error("SUPABASE_CONFIG_REQUIRED");
    return { environment, url, key, projectRef: null };
  }
  if (environment === "demo") throw new Error("DEMO_CANNOT_USE_BACKEND");
  let endpoint;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("INVALID_SUPABASE_URL");
  }
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/"
  )
    throw new Error("INVALID_SUPABASE_URL");
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(
    endpoint.hostname,
  );
  const projectRef =
    /^([a-z0-9]{20})\.supabase\.co$/.exec(endpoint.hostname)?.[1] || null;
  if (environment === "local") {
    if (!loopback || !["http:", "https:"].includes(endpoint.protocol))
      throw new Error("LOCAL_REQUIRES_LOOPBACK_BACKEND");
  } else {
    if (!projectRef || endpoint.protocol !== "https:" || endpoint.port)
      throw new Error("REMOTE_REQUIRES_SUPABASE_HTTPS");
    if (
      projectRef !==
      (environment === "production" ? productionProjectRef : stagingProjectRef)
    )
      throw new Error("SUPABASE_PROJECT_ENV_MISMATCH");
  }
  if (key.startsWith("eyJ")) {
    let role;
    try {
      role = JSON.parse(atob(key.split(".")[1])).role;
    } catch {
      /* rejected below */
    }
    if (role !== "anon") throw new Error("FRONTEND_REQUIRES_PUBLIC_KEY");
  } else if (!key.startsWith("sb_publishable_"))
    throw new Error("FRONTEND_REQUIRES_PUBLIC_KEY");
  return { environment, url: endpoint.origin, key, projectRef };
}

export function checkBackendEnvironment(config, runtime) {
  if (
    runtime?.environment !== config.environment ||
    runtime?.projectRef !== config.projectRef
  )
    throw new Error("BACKEND_ENV_MISMATCH");
}
