import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

let server, RouteBoundary;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)), configFile: false, envDir: false,
    cacheDir: fileURLToPath(new URL("../node_modules/.vite/tests/route-boundary", import.meta.url)),
    plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ default: RouteBoundary } = await server.ssrLoadModule("/src/RouteBoundary.jsx"));
});
after(async () => { await server?.close(); });

test("a pending route announces loading while its module stays unresolved", () => {
  const html = renderToStaticMarkup(createElement(RouteBoundary, {
    load: () => new Promise(() => {}), title: "Góc của bạn", pageProps: {},
  }));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Góc của bạn/);
  assert.match(html, /Chờ một chút/);
});

test("recovery offers retry and collection without exposing internal errors or reloading the session", () => {
  const boundary = new RouteBoundary({ load: () => Promise.reject(new Error("secret-token")), title: "Quản trị", pageProps: {} });
  boundary.state.error = new Error("private customer address / secret-token");
  const html = renderToStaticMarkup(boundary.render());
  assert.match(html, /role="alert"/);
  assert.match(html, /Thử tải lại/);
  assert.match(html, /href="#collection"/);
  assert.match(html, /phiên hiện tại vẫn được giữ/);
  assert.doesNotMatch(html, /secret-token|private customer address/);
  const rejectedPage = boundary.state.Page;
  boundary.setState = update => { boundary.state = { ...boundary.state, ...update }; };
  boundary.retry();
  assert.equal(boundary.state.error, null);
  assert.notEqual(boundary.state.Page, rejectedPage);
});
