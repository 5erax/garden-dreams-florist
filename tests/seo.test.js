import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSearch, productFromPath, productUrl } from '../src/product-url.js';
import { renderStorefront, renderSitemap } from '../src/storefront-html.js';
import { publicCatalog } from '../api/storefront.js';
const shop={name:'Garden Dreams',phone:'0832345780',address:'665L, Long Phước, Long Thành, Đồng Nai'};
const product={id:6,slug:'bo-hoa-6',name:'Giấc mơ mẫu đơn',occasion:'Tình yêu',active:true,reference_only:false,stems:'Mẫu đơn hồng',price:890000,image:'/flowers/bouquet_6.webp',description:'Lời thương </script><script>alert(1)</script>'};
const template=await readFile(new URL('../index.html',import.meta.url),'utf8');
test('Vietnamese search folds diacritics, đ, combining marks and case',()=>{
  assert.ok(normalizeSearch(product.name).includes(normalizeSearch(' MAU DON ')));
  assert.equal(normalizeSearch('Đồng Nai'), 'dong nai');
  assert.equal(normalizeSearch('mẫu đơn'),'mau don');
});
test('product URL remains stable after rename and only exact known paths resolve',()=>{
  assert.equal(productUrl({...product,name:'New name'}),'/hoa/bo-hoa-6');
  assert.equal(productFromPath('/hoa/bo-hoa-6/',[product]),product);
  assert.equal(productFromPath('/hoa/bo-hoa-666',[product]),undefined);
});
test('server HTML exposes actual catalog price, canonical and escaped Product/Florist structured data',()=>{
  const html=renderStorefront({template,shop,products:[product],product});
  assert.match(html,/<h1>Giấc mơ mẫu đơn<\/h1>/);
  assert.match(html,/890/);assert.match(html,/<link rel="canonical" href="https:\/\/garden-dreams-florist.vercel.app\/hoa\/bo-hoa-6">/);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.equal(graph[0]['@type'],'Florist');assert.equal(graph[1].offers.price,890000);
  assert.ok(!Object.hasOwn(graph[1].offers,'availability'));
  assert.ok(!html.includes('garden-dreams-hero.webp" as="image"'));
});
test('homepage has crawlable products and hero preload; previews are noindex',()=>{
  const html=renderStorefront({template,shop,products:[product],preview:true});
  assert.match(html,/href="\/hoa\/bo-hoa-6"/);assert.match(html,/noindex,nofollow/);assert.match(html,/as="image" fetchpriority="high"/);
  const sitemap=renderSitemap([product]);assert.match(sitemap,/\/hoa\/bo-hoa-6/);assert.ok(!sitemap.includes('#'));
});
test('SEO fetch only sends public key, only selects public fields, and fails closed on unavailable data',async()=>{
  const env={VITE_APP_ENV:'production',VITE_SUPABASE_URL:'https://ztzpipgptticvliotbsc.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
  const requests=[];const result=await publicCatalog(env,async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.includes('gd_shop?')?[shop]:[product]};});
  assert.equal(result.products.length,1);assert.equal(requests.length,2);
  assert.ok(requests.every(({options})=>!options.headers.Authorization && options.headers.apikey==='sb_publishable_fixture'));
  assert.ok(requests.every(({url})=>!url.includes('/gd_orders?')&&!url.includes('owner_id')));
  assert.ok(requests.find(({url})=>url.includes('gd_products?')).url.includes('occasion'));
  assert.equal(result.products[0].occasion,'Tình yêu');
  await assert.rejects(publicCatalog(env,async()=>({ok:false,status:503,json:async()=>({})})),/CATALOG_UNAVAILABLE/);
});

test('reference pages disclose their state without advertising a purchasable Offer',()=>{
  const reference={...product,active:false,reference_only:true,image:'/flowers/reference-01.jpg'};
  const html=renderStorefront({template,shop,products:[reference],product:reference});
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.ok(!Object.hasOwn(graph[1],'offers'));
  assert.match(html,/Giá dự kiến/);
  assert.match(html,/chưa nhận đặt/);
  assert.match(html,/Suyash Dwivedi/);
  assert.doesNotMatch(html,/Chọn cỡ và đặt hoa/);
});

