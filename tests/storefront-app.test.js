import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { products } from '../src/catalog.js';

let server, App;
before(async()=>{
  server=await createServer({
    root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,
    cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/storefront-app',import.meta.url)),
    plugins:[{name:'public-snapshot',enforce:'pre',load(id){
      if(id.replaceAll('\\','/').endsWith('/src/Store.jsx')) return 'export const useStore=()=>globalThis.storefrontFixture;';
    }},react()],
    define:{'import.meta.env.VITE_APP_ENV':'"demo"','import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},
    server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  });
  ({default:App}=await server.ssrLoadModule('/src/App.jsx'));
  const {occasion,...legacy}=products[0];
  globalThis.storefrontFixture={products:[legacy,...products.slice(1)],shop:{name:'Garden Dreams',phone:'0832345780',accepting_orders:false},session:null,isAdmin:false,loading:false,error:'',connected:false};
});
after(async()=>{delete globalThis.location;delete globalThis.storefrontFixture;await server?.close();});

test('homepage renders its hero and collection from the public snapshot',()=>{
  globalThis.location={pathname:'/',hash:'#home'};
  const html=renderToStaticMarkup(createElement(App));
  assert.match(html,/id="home"/);assert.match(html,/id="collection"/);
  assert.match(html,/40 bó hoa dành cho bạn/);
  assert.match(html,/class="button hero-cta" href="#collection"/);
});

test('cold product route has readable navigation and tolerates legacy snapshot data',()=>{
  globalThis.location={pathname:'/hoa/bo-hoa-1',hash:''};
  const html=renderToStaticMarkup(createElement(App));
  assert.match(html,/class="header is-scrolled"/);
  assert.match(html,/href="\/#home"/);
  assert.match(html,/người bạn thương/);
  assert.match(html,/id="buy"/);
  assert.doesNotMatch(html,/id="home"/);
});
