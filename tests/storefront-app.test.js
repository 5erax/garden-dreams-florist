import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import {cartChoice} from '../src/order.js';
import { products } from '../src/catalog.js';
import sampleOrders from '../src/garden-orders.json' with { type: 'json' };
import { existsSync } from 'node:fs';

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
  assert.ok(html.includes(`${products.filter(p=>cartChoice({id:p.id},[p])).length} bó hoa phù hợp`));
  assert.match(html,/<details class="flower-finder">/);
  assert.doesNotMatch(html,/class="quick-add"/);
  assert.match(html,/class="button hero-cta" href="#collection"/);
  assert.match(html,/<h2>Bộ sưu tập hoa<\/h2>/);
  assert.match(html,/class="ordering-guide" id="story"/);
  assert.match(html,/Xem khu vực &amp; phí giao/);
  assert.doesNotMatch(html,/Rooted in love|Thay ngàn lời|story-composition/);
});

test('cold product route has readable navigation and tolerates legacy snapshot data',()=>{
  globalThis.location={pathname:'/hoa/bo-hoa-1',hash:''};
  const html=renderToStaticMarkup(createElement(App));
  assert.match(html,/class="header is-scrolled"/);
  assert.match(html,/href="\/#home"/);
  assert.match(html,/người bạn thương/);
  assert.match(html,/id="buy"/);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  assert.doesNotMatch(html,/id="home"/);
});

test('customers keep the same header across shop, garden and account routes',()=>{
 const previous=globalThis.storefrontFixture;
 globalThis.storefrontFixture={...previous,session:{user:{id:'customer-test',email:'customer@example.test',is_anonymous:false}}};
 try {
   const headers=['#home','#garden','#account'].map(hash=>{
     globalThis.location={pathname:'/',hash};
     const html=renderToStaticMarkup(createElement(App));
     assert.equal((html.match(/<header[ >]/g)||[]).length,1);
     assert.doesNotMatch(html,/class="portal-header"/);
     return html.match(/<header[\s\S]*?<\/header>/)[0].replace('header is-scrolled','header ').replace(/ aria-current="page"/g,'');
   });
   assert.equal(headers[0],headers[1]); assert.equal(headers[1],headers[2]);
   assert.match(headers[0],/Đặt &amp; giao hoa/);
 }finally{globalThis.storefrontFixture=previous;}
});

test('forty synthetic completed orders carry original cards and no customer identity',async()=>{
 assert.equal(sampleOrders.length,40);
 assert.equal(new Set(sampleOrders.map(o=>o.id)).size,40);
 assert.equal(new Set(sampleOrders.map(o=>o.memory.token)).size,40);
 assert.equal(new Set(sampleOrders.map(o=>o.memory.message)).size,40);
 for(const order of sampleOrders){
   assert.equal(order.is_test,true); assert.equal(order.status,'DELIVERED'); assert.equal(order.payment_status,'PAID');
   assert.equal(order.owner_id,null); assert.equal(order.total,order.items[0].price);
   assert.equal(order.memory.signature,'Garden Dreams');
   assert.ok(existsSync(new URL('../public'+order.memory.flowerImage,import.meta.url)));
   assert.ok(!('recipient_phone' in order) && !('address' in order));
 }
 const {SharedMemory}=await server.ssrLoadModule('/src/Garden.jsx');
 const html=renderToStaticMarkup(createElement(SharedMemory,{token:sampleOrders[0].memory.token}));
 assert.match(html,/Một lời nhắn gợi ý tại/); assert.match(html,/Garden Dreams/);
 const privateCard=renderToStaticMarkup(createElement(SharedMemory,{token:'70000000-0000-4000-8000-000000000001'}));
 assert.match(privateCard,/đang được giữ riêng/);
 assert.doesNotMatch(privateCard,/Một lời nhắn gợi ý tại/);
});

test('admin account uses the workspace on the homepage and product previews have no purchasing controls',()=>{
 const previous=globalThis.storefrontFixture;
 globalThis.storefrontFixture={...previous,isAdmin:true,session:{user:{id:'admin'}},features:{}};
 try{
 globalThis.location={pathname:'/',hash:'#home'};
 const home=renderToStaticMarkup(createElement(App));
 assert.doesNotMatch(home,/id="home"|id="collection"|Mở giỏ hoa|hero-cta/);
 assert.match(home,/Quản trị cửa hàng/);
 globalThis.storefrontFixture.recovery=true;
 const reset=renderToStaticMarkup(createElement(App));
 assert.match(reset,/Đặt mật khẩu quản trị/);
 assert.doesNotMatch(reset,/Mở giỏ hoa|hero-cta/);
 globalThis.storefrontFixture.recovery=false;
 globalThis.location={pathname:'/hoa/bo-hoa-1',hash:''};
 const detail=renderToStaticMarkup(createElement(App));
 assert.match(detail,/product-page/);
 assert.doesNotMatch(detail,/product-purchase-footer|Đặt ngay|Thêm vào giỏ hoa|Lưu bó hoa này/);
 }finally{globalThis.storefrontFixture=previous;}
});
