const callbackKeys = [
  "access_token",
  "refresh_token",
  "error",
  "error_code",
  "error_description",
  "code",
];
export function isAuthCallback({ hash = "", search = "" }) {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search);
  return callbackKeys.some((key) => fragment.has(key) || query.has(key));
}
export function authCallbackRoute({ pathname, search = "" }) {
  const query = new URLSearchParams(search);
  for (const key of [
    ...callbackKeys,
    "expires_in",
    "expires_at",
    "token_type",
    "type",
  ])
    query.delete(key);
  const remaining = query.toString();
  return `${pathname}${remaining ? "?" + remaining : ""}#account`;
}
