import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalogReader, storefrontHandler } from '../api/storefront.js';
const shop={name:'Garden Dreams',phone:'0832345780',address:'Long Thành',accepting_orders:true};
const flower={id:1,slug:'bo-hoa-1',name:'Hoa thật',price:390000,image:'/flowers/bouquet_1.webp',active:true,reference_only:false};
const reference={...flower,id:21,slug:'bo-hoa-21',active:false,reference_only:true};
const catalog={shop,products:[flower,reference]};
const template=await readFile(new URL('../index.html',import.meta.url),'utf8');
const response=()=>({code:200,headers:{},body:'',status(code){this.code=code;return this;},setHeader(key,value){this.headers[key]=value;return this;},end(body=''){this.body=body;return this;},send(body){return this.end(body);}});
test('cold backend failure serves build snapshot read-only; subsequent live recovery restores fresh catalog',async()=>{
  let fail=true,reads=0;
  const read=catalogReader(async()=>{reads++;if(fail)throw Error('timeout');return catalog;},async()=>catalog);
  const fallback=await read();assert.equal(fallback.degraded,true);assert.equal(fallback.shop.accepting_orders,false);
  assert.equal(catalog.shop.accepting_orders,true);
  fail=false;const recovered=await read();assert.equal(recovered.degraded,false);assert.equal(recovered.shop.accepting_orders,true);
  await read();assert.equal(reads,2);
});
test('concurrent reads share refresh, warm expired cache survives outage and never substitutes a wrong snapshot',async()=>{
  let time=0,reads=0,fail=false;
  const read=catalogReader(async()=>{reads++;if(fail)throw Error('offline');await Promise.resolve();return catalog;},async()=>{throw Error('wrong project');},()=>time);
  await Promise.all([read(),read(),read()]);assert.equal(reads,1);
  time=60001;fail=true;assert.equal((await read()).degraded,true);assert.equal(reads,2);
  await assert.rejects(catalogReader(async()=>{throw Error('offline');},async()=>{throw Error('wrong project');})(),/wrong project/);
});
test('handler renders home/query equivalent, product metadata and static #buy anchor; sitemap excludes references',async()=>{
  const handler=storefrontHandler({catalog:async()=>catalog,template:async()=>template,preview:()=>false});
  for(const query of [{},{nocache:'unique'}]){
    const res=response();await handler({method:'GET',query},res);
    assert.equal(res.code,200);assert.match(res.body,/<h1>Hoa tươi Long Thành/);assert.match(res.body,/rel="canonical"/);
    assert.match(res.body,/application\/ld\+json/);assert.match(res.headers['Cache-Control'],/stale-while-revalidate=300/);
  }
  const res=response();await handler({method:'GET',query:{path:'/hoa/bo-hoa-1'}},res);
  assert.match(res.body,/id="buy"/);assert.match(res.body,/href="#buy"/);
  assert.match(res.body,/<meta name="twitter:image" content="[^"]*bouquet_1.webp"/);
  assert.doesNotMatch(res.body,/og:image:(width|height)/);
  const ref=response();await handler({method:'GET',query:{path:'/hoa/bo-hoa-21'}},ref);
  assert.equal(ref.headers['X-Robots-Tag'],'noindex, follow');assert.match(ref.body,/noindex,follow/);
  assert.match(ref.body,/og:type" content="website"/);
  const xml=response();await handler({method:'GET',query:{path:'/sitemap.xml'}},xml);
  assert.match(xml.body,/bo-hoa-1</);assert.doesNotMatch(xml.body,/bo-hoa-21/);
});
test('fallback remains readable without an Offer or purchase CTA; unknown products, HEAD and methods stay correct',async()=>{
  const handler=storefrontHandler({catalog:async()=>({...catalog,degraded:true,shop:{...shop,accepting_orders:false}}),template:async()=>template,preview:()=>false});
  const res=response();await handler({method:'GET',query:{path:'/hoa/bo-hoa-1'}},res);
  assert.equal(res.code,200);assert.equal(res.headers['X-Garden-Catalog'],'fallback');assert.match(res.body,/bản dự phòng/);
  const graph=JSON.parse(res.body.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.ok(!graph[1].offers);assert.doesNotMatch(res.body,/href="#buy"/);
  const head=response();await handler({method:'HEAD',query:{}},head);assert.equal(head.code,200);assert.equal(head.body,'');
  const missing=response();await handler({method:'GET',query:{path:'/hoa/bo-hoa-999'}},missing);assert.equal(missing.code,404);
  const post=response();await handler({method:'POST',query:{}},post);assert.equal(post.code,405);
});

test('legacy shop schema omits optional address instead of failing the entire catalog',async()=>{
  const {publicCatalog}=await import('../api/storefront.js');
  const env={VITE_APP_ENV:'staging',VITE_SUPABASE_URL:'https://tgvozhrkolcpszyyrgth.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
  const requests=[];
  const result=await publicCatalog(env,async url=>{
    requests.push(url);
    if(url.includes('gd_shop?')&&url.includes('address'))return {ok:false,status:400,json:async()=>({code:'42703'})};
    return {ok:true,json:async()=>url.includes('gd_shop?')?[{name:shop.name,phone:shop.phone,accepting_orders:false}]:[flower]};
  });
  assert.equal(requests.length,3);assert.equal(result.shop.address,undefined);assert.equal(result.products.length,1);
  await assert.rejects(publicCatalog(env,async()=>({ok:false,status:403,json:async()=>({code:'42501'})})),/CATALOG_UNAVAILABLE/);
});
