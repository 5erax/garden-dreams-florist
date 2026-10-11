import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { cartOwner, readCustomerCart, saveCustomerCart, switchCustomerCart } from '../src/customer-cart.js';

const device = () => {
  const values = new Map();
  return { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name) };
};
const session = (id, anonymous = false) => ({ user: { id, is_anonymous: anonymous } });
const aliceFlowers = [{ id: 1, quantity: 2 }], bobFlowers = [{ id: 2, quantity: 1 }];
test('cart storage is isolated by customer, environment and browser tab, never importing legacy carts', () => {
  const storage = device();
  storage.setItem('gd-cart', JSON.stringify(aliceFlowers));
  assert.deepEqual(readCustomerCart(storage, 'production', 'visitor'), []);
  saveCustomerCart(storage, 'production', 'alice', aliceFlowers);
  assert.deepEqual(readCustomerCart(storage, 'production', 'bob'), []);
  assert.deepEqual(readCustomerCart(storage, 'staging', 'alice'), []);
  assert.deepEqual(readCustomerCart(device(), 'production', 'alice'), []);
  assert.deepEqual(readCustomerCart(storage, 'production', 'alice'), aliceFlowers);
  assert.equal(cartOwner(session('alice'), false), null);
});
test('only guest-to-anonymous checkout carries choices; signout, account switch and corrupt storage stay safe', () => {
  const storage = device(), guest = { owner: 'visitor', items: aliceFlowers };
  assert.deepEqual(switchCustomerCart(guest, 'new-guest', true, storage, 'production').items, aliceFlowers);
  assert.deepEqual(switchCustomerCart(guest, 'bob', false, storage, 'production').items, []);
  assert.deepEqual(switchCustomerCart({ owner: 'alice', items: aliceFlowers }, 'bob', false, storage, 'production').items, []);
  saveCustomerCart(storage, 'production', 'visitor', aliceFlowers);
  assert.deepEqual(switchCustomerCart({ owner: 'alice', items: aliceFlowers }, 'visitor', false, storage, 'production').items, []);
  storage.setItem('gd-cart-v2:production:bob', 'broken');
  assert.deepEqual(readCustomerCart(storage, 'production', 'bob'), []);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(readCustomerCart(blocked, 'production', 'bob'), []);
  assert.doesNotThrow(() => saveCustomerCart(blocked, 'production', 'bob', bobFlowers));
});

test('real cart hook hides old selections before effects, rejects stale updates and preserves anonymous checkout', async () => {
  const h = { state: [], dependencies: [], effects: [], cursor: 0 };
  globalThis.gdCartHarness = h;
  globalThis.sessionStorage = device();
  globalThis.localStorage = device();
  globalThis.localStorage.setItem('gd-cart', JSON.stringify(aliceFlowers));
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, envDir: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite/tests/customer-cart', import.meta.url)),
    plugins: [{ name: 'cart-hooks-fixture', enforce: 'pre', resolveId(id) { if (id === 'virtual:cart-hooks') return id; },
      transform(source, id) { if (id.replaceAll('\\', '/').endsWith('/src/customer-cart.js')) return source.replace("from 'react'", "from 'virtual:cart-hooks'"); },
      load(id) { if (id === 'virtual:cart-hooks') return `
        export const useState=initial=>{const h=globalThis.gdCartHarness,i=h.cursor++;if(!(i in h.state))h.state[i]=initial;return [h.state[i],next=>{h.state[i]=typeof next==='function'?next(h.state[i]):next;}];};
        export const useEffect=(effect,deps)=>{const h=globalThis.gdCartHarness,i=h.cursor++,old=h.dependencies[i];if(!old||deps.some((value,j)=>!Object.is(value,old[j]))){h.dependencies[i]=deps;h.effects.push(effect);}};`; }
    }], server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  try {
    const { useCustomerCart } = await server.ssrLoadModule('/src/customer-cart.js');
    const options = { session: null, authReady: false, environment: 'production', products: [{ id: 1, image: "/flowers/test.webp" }, { id: 2, image: "/flowers/test.webp" }], loading: false, error: '' };
    const render = () => { h.cursor = 0; return useCustomerCart(options); };
    const settle = () => { for (let i = 0; i < 4; i++) { render(); const effects = h.effects.splice(0); effects.forEach(effect => effect()); } return render(); };
    saveCustomerCart(globalThis.sessionStorage, 'production', 'alice', aliceFlowers);
    assert.deepEqual(render()[0], []);
    settle(); assert.equal(globalThis.localStorage.getItem('gd-cart'), null);
    options.authReady = true; options.session = session('alice');
    let [items, updateAlice] = settle(); assert.deepEqual(items, aliceFlowers);
    options.session = session('bob');
    assert.deepEqual(render()[0], []);
    let [bob, updateBob] = settle(); assert.deepEqual(bob, []);
    updateAlice(() => aliceFlowers); assert.deepEqual(settle()[0], []);
    updateBob(() => bobFlowers); assert.deepEqual(settle()[0], bobFlowers);
    options.session = session('alice'); assert.deepEqual(settle()[0], aliceFlowers);
    options.session = null; assert.deepEqual(render()[0], []); assert.deepEqual(settle()[0], []);
    assert.deepEqual(readCustomerCart(globalThis.sessionStorage, 'production', 'alice'), []);
    settle()[1](() => bobFlowers); assert.deepEqual(settle()[0], bobFlowers);
    options.session = session('guest-one', true); assert.deepEqual(settle()[0], bobFlowers);
    assert.deepEqual(readCustomerCart(globalThis.sessionStorage, 'production', 'visitor'), []);
    options.session = session('guest-one', true); assert.deepEqual(settle()[0], bobFlowers);
    options.session = session('guest-two', true); assert.deepEqual(render()[0], []); assert.deepEqual(settle()[0], []);
  } finally { await server.close(); delete globalThis.gdCartHarness; delete globalThis.sessionStorage; delete globalThis.localStorage; }
});
