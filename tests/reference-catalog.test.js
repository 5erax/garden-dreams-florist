import test from 'node:test';
import assert from 'node:assert/strict';
import { database, actors } from './helpers/database.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import catalog from '../src/reference-catalog.json' with { type: 'json' };

test('twenty reference concepts have distinct photos, descriptive data and source credits',async()=>{
  assert.equal(catalog.length,20);
  const hashes=new Set();
  for(const item of catalog){
    assert.equal(item.active,false);assert.equal(item.reference_only,true);
    assert.ok(item.name && item.stems && item.occasion && item.description.length>250);
    assert.ok(Number.isSafeInteger(item.price) && item.price>0);
    assert.match(item.credit.source,/^https:\/\/commons.wikimedia.org\/wiki\/File:/);
    assert.match(item.credit.license,/^(CC|Public domain)/);
    const bytes=await readFile(new URL('../public'+item.image,import.meta.url));
    assert.equal(bytes[0],255);assert.equal(bytes[1],216);
    hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size,20);
});

test('public reference browsing cannot purchase or expose unpublished products; activation is explicit', async () => {
  const f = await database();
  try {
    const legacy = await f.order();
    await f.db.exec("insert into gd_products(id,name,occasion,price,stems,description,image,active,reference_only) values(101,'Reference flower','Sinh nhật',490000,'Test stems','Reference description','/flowers/test.jpg',false,true),(102,'Private draft','Sinh nhật',490000,'Test stems','Private description','/flowers/test.jpg',false,false)");
    const publicRows = await f.as(null, () => f.db.query('select id from gd_products where id in (101,102)'));
    assert.deepEqual(publicRows.rows, [{id:101}]);
    await assert.rejects(f.order(actors.alice, {items:[{id:101,quantity:1}],expectedTotal:490000}), /PRODUCT_UNAVAILABLE/);
    const blocked=await f.as(actors.alice, () => f.db.query('update gd_products set active=true where id=101 returning id'));
    assert.equal(blocked.rows.length,0);
    await f.as(actors.admin, () => f.db.exec('update gd_products set active=true where id=101'));
    assert.deepEqual((await f.db.query('select active,reference_only from gd_products where id=101')).rows,[{active:true,reference_only:false}]);
    assert.equal((await f.db.query('select status from gd_orders where id=$1',[legacy.id])).rows[0].status,legacy.status);
  } finally { await f.close(); }
});

test('reference seed preserves existing catalog and is idempotent without creating sale stock',async()=>{
  const f=await database();
  try{
    const original=(await f.db.query('select * from gd_products order by id')).rows;
    const seed=await readFile(new URL('../supabase/reference-catalog-seed.sql',import.meta.url),'utf8');
    await f.db.exec(seed);await f.db.exec(seed);
    assert.equal((await f.db.query('select count(*)::int n from gd_products')).rows[0].n,40);
    assert.deepEqual((await f.db.query('select * from gd_products where id<=20 order by id')).rows,original);
    assert.equal((await f.db.query('select count(*)::int n from gd_products where reference_only and not active')).rows[0].n,20);
    assert.equal((await f.db.query('select count(*)::int n from gd_stock_batches')).rows[0].n,0);
  }finally{await f.close();}
});
