import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transferAmount } from '../src/transfer-amount.js';
import { robotsPolicy, applyRobots } from '../src/robots-policy.js';
import { startingPrice } from '../src/flower-selection.js';
import { readFavorites } from '../src/customer-favorites.js';

test('partial transfers use authoritative receivables and never fall back on failure', async () => {
  const order={id:'fixture',total:600000,payment_status:'PARTIAL'};
  assert.equal(await transferAmount(order,async()=>({receivable:500000})),500000);
  assert.equal(await transferAmount({...order,payment_status:'UNPAID'},async()=>({receivable:500000})),500000);
  assert.equal(await transferAmount(order,async()=>({receivable:0})),0);
  await assert.rejects(transferAmount(order,async()=>{throw Error('offline')}),/offline/);
  await assert.rejects(transferAmount(order,async()=>({receivable:-1})),/INVALID/);
});
test('robots restore product and environment policy across private route visits without duplicates', () => {
  const reference={id:1,active:false,reference_only:true};
  const sale={id:2,active:true,image:'/real.webp'};
  const nodes=[];
  const document={querySelectorAll:()=>nodes,createElement:()=>({remove(){nodes.splice(nodes.indexOf(this),1)}}),head:{append:n=>nodes.push(n)}};
  for (const route of ['', '#account', '']) {
    applyRobots(document,robotsPolicy(route,reference,'production'));
    assert.equal(nodes.length,1); assert.match(nodes[0].content,/noindex/);
  }
  applyRobots(document,robotsPolicy('',sale,'production'));
  assert.equal(nodes.length,0);
  assert.equal(robotsPolicy('',sale,'staging','noindex,nofollow'),'noindex,nofollow');
});
test('both price sort directions match the cheapest enabled size', () => {
  const a={id:1,price:600000,image:'/real.webp',variants:[{id:2,price:300000,active:true},{id:3,price:100000,active:false}]};
  const b={id:4,price:400000,image:'/real.webp'};
  assert.deepEqual([b,a].sort((x,y)=>startingPrice(x)-startingPrice(y)),[a,b]);
  assert.deepEqual([a,b].sort((x,y)=>startingPrice(y)-startingPrice(x)),[b,a]);
});
test('favorite storage has explicit account/environment ownership and ignores legacy data', () => {
  const rows=new Map([['gd-favorites','[99]'],['gd-favorites-v2:local:alice','[1,2,2,-1,"3"]'],['gd-favorites-v2:local:bob','[4]']]);
  const storage={getItem:key=>rows.get(key)};
  assert.deepEqual(readFavorites(storage,'local','alice'),[1,2]);
  assert.deepEqual(readFavorites(storage,'local','bob'),[4]);
  assert.deepEqual(readFavorites(storage,'local','visitor'),[]);
  assert.deepEqual(readFavorites(storage,'staging','alice'),[]);
  assert.deepEqual(readFavorites({getItem(){throw Error('blocked')}},'local','bob'),[]);
});
