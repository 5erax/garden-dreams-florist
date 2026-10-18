import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { products } from '../src/catalog.js';

test('both catalog reset buttons recover empty results and restore purchasable defaults', async () => {
  const harness = { states: [], index: 0 };
  globalThis.gdFilterHarness = harness;
  globalThis.location = { pathname: '/', hash: '#collection', search: '' };
  globalThis.document = { getElementById: () => null };
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, envDir: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite/tests/filter-reset', import.meta.url)),
    plugins: [{ name: 'filter-reset-fixture', enforce: 'pre',
      resolveId(id) { if (id === 'virtual:filter-hooks') return id; },
      transform(source, id) {
        if (id.replaceAll('\\', '/').endsWith('/src/App.jsx')) return source.replace('from "react"', 'from "virtual:filter-hooks"');
      },
      load(id) {
        if (id === 'virtual:filter-hooks') return `
          export const useEffect=()=>{},useRef=current=>({current});
          export const useState=initial=>{
            const h=globalThis.gdFilterHarness,i=h.index++;
            if(!(i in h.states))h.states[i]=typeof initial==='function'?initial():initial;
            return [h.states[i],next=>{h.states[i]=typeof next==='function'?next(h.states[i]):next;}];
          };`;
        if (id.replaceAll('\\', '/').endsWith('/src/Store.jsx')) return 'export const useStore=()=>globalThis.gdFilterHarness.store;';
        if (id.replaceAll('\\', '/').endsWith('/src/customer-cart.js')) return 'export const useCustomerCart=()=>[[],()=>{}];';
        if (id.replaceAll('\\', '/').endsWith('/src/customer-favorites.js')) return 'export const useCustomerFavorites=()=>[[],()=>{}];';
      },
    }, react()],
    define: { 'import.meta.env.VITE_APP_ENV': '"demo"', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  try {
    harness.store = { products, shop: { name: 'Garden Dreams', phone: '0832345780' }, session: null, isAdmin: false, loading: false, connected: false };
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const render = () => { harness.index = 0; return App(); };
    function elements(node) {
      if (Array.isArray(node)) return node.flatMap(elements);
      return node?.props ? [node, ...elements(node.props.children)] : [];
    }
    const find = predicate => {
      const node = elements(render()).find(predicate);
      assert.ok(node, 'expected catalog control');
      return node;
    };
    const choose = (label, value) => find(n => n.props['aria-label'] === label).props.onChange({ target: { value } });
    const button = text => find(n => n.type === 'button' && n.props.children === text);
    const cards = () => find(n => n.props.className === 'product-grid').props.children.length;
    for (const action of ['Xem tất cả hoa', 'Đặt lại lựa chọn']) {
      for (const scenario of ['color/type', 'query', 'favorites']) {
        harness.states = [];
        choose('Loại hoa', 'tulip');
        choose('Sắc hoa', 'xanh');
        if (scenario !== 'color/type') {
          button('Sinh nhật').props.onClick({ detail: 0 });
          choose('Ngân sách bó hoa', '300000');
          find(n => n.type === 'input' && n.props.placeholder === 'Tìm một bó hoa…').props.onChange({ target: { value: 'khong-co-hoa-nay' } });
          find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: false } });
        }
        if (scenario === 'favorites') find(n => typeof n.props.onFavorites === 'function').props.onFavorites();
        assert.equal(cards(), 0);
        button(action).props.onClick();
        assert.ok(cards() > 0, `${action} must restore results`);
        for (const label of ['Sắc hoa', 'Loại hoa']) assert.equal(find(n => n.props['aria-label'] === label).props.value, '');
        assert.equal(find(n => n.props['aria-label'] === 'Ngân sách bó hoa').props.value, 0);
        assert.equal(find(n => n.type === 'input' && n.props.type === 'checkbox').props.checked, true);
        assert.equal(find(n => n.type === 'input' && n.props.placeholder === 'Tìm một bó hoa…').props.value, '');
        assert.equal(find(n => typeof n.props.onFavorites === 'function').props.onlyFavorites, false);
        assert.equal(button('Tất cả').props['aria-pressed'], true);
      }
    }
  } finally {
    await server.close();
    delete globalThis.gdFilterHarness; delete globalThis.location; delete globalThis.document;
  }
});
