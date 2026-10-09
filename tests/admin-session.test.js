import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server, AdminPortal, sessionIsAdmin;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)), configFile: false, envDir: false,
    cacheDir: fileURLToPath(new URL("../node_modules/.vite/tests/admin-session", import.meta.url)),
    plugins: [{
      name: "admin-session-fixture", enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/src/Store.jsx"))
          return "export const useStore = () => globalThis.adminSessionFixture;";
      },
    }, react()],
    define: { "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '""' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ default: AdminPortal } = await server.ssrLoadModule("/src/AdminPortal.jsx"));
  ({ sessionIsAdmin } = await server.ssrLoadModule("/src/Store.jsx?permission-check"));
});
after(async () => { delete globalThis.adminSessionFixture; await server?.close(); });
const session = id => ({ user: { id } });

test("admin authority belongs to the verified account, including delayed results after a switch", () => {
  assert.equal(sessionIsAdmin(session("alice"), "alice"), true);
  assert.equal(sessionIsAdmin(session("bob"), "alice"), false);
  assert.equal(sessionIsAdmin(session("bob"), null), false);
  assert.equal(sessionIsAdmin(session("bob"), "bob"), true);
  assert.equal(sessionIsAdmin(null, "alice"), false);
  assert.equal(sessionIsAdmin({ user: {} }, null), false);
});

test("admin workspace is recreated on account changes and permission loss or regain", () => {
  const key = (id, isAdmin) => {
    globalThis.adminSessionFixture = { session: id ? session(id) : null, isAdmin, features: {} };
    return AdminPortal().key;
  };
  const alice = key("alice", true), bob = key("bob", true);
  assert.notEqual(alice, bob);
  assert.notEqual(bob, key("bob", false));
  assert.notEqual(alice, key(null, false));
  assert.equal(bob, key("bob", true));
});

test("unverified replacement accounts cannot render the management workspace", () => {
  globalThis.adminSessionFixture = {
    session: session("bob"), isAdmin: sessionIsAdmin(session("bob"), "alice"), features: {},
  };
  const html = renderToStaticMarkup(createElement(AdminPortal));
  assert.match(html, /chưa có quyền admin/);
  assert.doesNotMatch(html, /Cửa hàng &amp; thanh toán|Thêm hoa|Thông tin cửa hàng/);
});
