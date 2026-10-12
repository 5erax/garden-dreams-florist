import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('changing admin sections clears incompatible rows and detail before the next render', async () => {
  const harness = { states: [], refs: [], stateIndex: 0, refIndex: 0 };
  globalThis.adminNavigationHarness = harness;
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, envDir: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite/tests/admin-navigation', import.meta.url)),
    plugins: [{ name: 'navigation-hooks', enforce: 'pre',
      resolveId(id) { if (id === 'virtual:navigation-hooks') return id; },
      transform(source, id) {
        if (id.replaceAll('\\', '/').endsWith('/src/AdminPortal.jsx'))
          return source.replace('from "react"', 'from "virtual:navigation-hooks"');
      },
      load(id) {
        if (id === 'virtual:navigation-hooks') return `
          export function useState(initial) {
            const h=globalThis.adminNavigationHarness, i=h.stateIndex++;
            if (!(i in h.states)) h.states[i]=typeof initial==='function'?initial():initial;
            return [h.states[i],next=>{h.states[i]=typeof next==='function'?next(h.states[i]):next;}];
          }
          export function useRef(initial) {
            const h=globalThis.adminNavigationHarness, i=h.refIndex++;
            return h.refs[i] ||= {current:initial};
          }
          export const useEffect=()=>{};`;
        if (id.replaceAll('\\', '/').endsWith('/src/Store.jsx'))
          return 'export const useStore=()=>globalThis.adminNavigationHarness.store;';
      },
    }, react()],
    define: { 'import.meta.env.VITE_APP_ENV': '"demo"', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  const find = (node, name) => {
    if (!node || typeof node !== 'object') return;
    if (node.type?.name === name) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, name); if (found) return found;
    }
  };
  try {
    harness.store = { session: { user: { id: 'admin-test' } }, isAdmin: true, connected: true, features: {} };
    const { default: AdminPortal } = await server.ssrLoadModule('/src/AdminPortal.jsx');
    const render = () => {
      harness.stateIndex = 0; harness.refIndex = 0;
      const workspace = AdminPortal(); return workspace.type(workspace.props);
    };
    render();
    for (const previous of ['shop', 'products', 'shipping']) {
      harness.states[0] = previous;
      harness.states[1] = [{ id: 1, name: 'Old section, no delivery date' }];
      harness.states[5] = { id: 1 }; harness.states[6] = { id: 'old-order' }; harness.states[7] = true;
      find(render(), 'AdminNavigation').props.onChange('orders');
      assert.deepEqual(harness.states[1], []);
      assert.equal(harness.states[5], null); assert.equal(harness.states[6], null);
      assert.equal(harness.states[7], false);
      assert.doesNotThrow(render);
    }
    harness.states[0] = 'dashboard'; harness.states[1] = [{ id: 1 }];
    find(render(), 'BusinessDashboard').props.onNavigate('products', 1);
    assert.equal(harness.states[0], 'products'); assert.deepEqual(harness.states[1], []);
    assert.equal(harness.refs[0].current, 1);
    const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
    harness.states[0] = 'products'; harness.states[1] = [];
    harness.states[2] = false; harness.states[3] = 'Lưu thất bại; giữ nội dung đang sửa.';
    harness.states[5] = { id: 16, name: 'Đồng hoa', image: '/flowers/bouquet_16-pending.svg', images: [], description: 'Nội dung đang sửa.' };
    harness.states[6] = null;
    let tree = nodes(render());
    const saveBar = tree.find(node => node.props?.className === 'form-actions admin-save-bar');
    assert.equal(nodes(saveBar).filter(node => node.props?.role === 'alert').length, 1);
    assert.equal(tree.filter(node => node.props?.role === 'alert').length, 1);
    assert.equal(tree.find(node => node.type === 'textarea').props.defaultValue, 'Nội dung đang sửa.');
    assert.equal(tree.find(node => node.props?.['aria-label'] === 'Nguồn ảnh tham khảo')?.type, 'aside');
    assert.ok(tree.some(node => node.props?.href === 'https://hoayeuthuong.com/hoa-tuoi/hoa-cuc/10675_garden-style-05'));
    for (const replacement of [{ image: '/flowers/own-photo.webp' }, { images: ['/flowers/own-photo.webp'] }, { name: 'Mẫu đã đổi' }]) {
      const original = harness.states[5]; harness.states[5] = { ...original, ...replacement };
      assert.ok(!nodes(render()).some(node => node.props?.['aria-label'] === 'Nguồn ảnh tham khảo'));
      harness.states[5] = original;
    }
    harness.states[5] = null;
    assert.equal(nodes(render()).filter(node => node.props?.role === 'alert').length, 1);
  } finally { await server.close(); delete globalThis.adminNavigationHarness; }
});
