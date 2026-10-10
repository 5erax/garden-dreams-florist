import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, actors } from './helpers/database.js';
import { readFile } from 'node:fs/promises';

test('inventory upgrade rejects another project and preserves legacy orders without inventing stock', async () => {
  const f=await database({through:'202610100012_payment_ledger.sql'});
  try {
    const sql=await readFile(new URL('../supabase/migrations/20261010001316_inventory_and_public_catalog.sql',import.meta.url),'utf8');
    await f.db.exec("update gd_private.runtime set project_ref='aaaaaaaaaaaaaaaaaaaa'");
    await assert.rejects(f.db.exec(sql),/INVENTORY_REQUIRES_KNOWN_SCHEMA_012/);await f.db.exec('rollback');
    await f.db.exec("update gd_private.runtime set project_ref='ztzpipgptticvliotbsc'");
    const legacy=await f.order();await f.db.exec(sql);
    const saved=(await f.db.query("select to_jsonb(o)-'request_body' saved from gd_orders o where id=$1",[legacy.id])).rows[0].saved;
    assert.equal(saved.inventory_managed,false);delete saved.inventory_managed;assert.deepEqual(saved,legacy);
    assert.equal((await f.db.query('select count(*)::int n from gd_stock_batches')).rows[0].n,0);
    assert.equal((await f.db.query('select enabled from gd_inventory_settings')).rows[0].enabled,false);
    assert.equal((await f.db.query('select accepting_orders from gd_shop')).rows[0].accepting_orders,true);
  } finally {await f.close();}
});

test('inventory is private, versioned and idempotent; FEFO holds, shortages, expiry, consumption and waste reconcile', async () => {
  const f = await database(); const {db,as,rpc,payload} = f;
  const command = (action,body,id=randomUUID()) => as(actors.admin,()=>rpc('gd_inventory_command',[id,action,body]));
  try {
    for (const actor of [null,actors.alice]) {
      await assert.rejects(as(actor,()=>rpc('gd_inventory_state')), /permission denied|ADMIN_REQUIRED/);
      await assert.rejects(as(actor,()=>rpc('gd_inventory_command',[randomUUID(),'ENABLE',{enabled:true}])), /permission denied|ADMIN_REQUIRED/);
      const rows = await as(actor,()=>db.query('select * from gd_stock_batches').catch(error=>{assert.match(error.message,/permission denied/);return {rows:[]};}));
      assert.equal(rows.rows.length,0);
    }
    assert.equal((await as(actors.admin,()=>rpc('gd_inventory_state'))).enabled,false);
    await assert.rejects(command('ENABLE',{enabled:true}),/RECIPES_REQUIRED/);
    await db.exec('update gd_products set active=false where id<>1');
    const {ingredientId} = await command('INGREDIENT',{name:'Fixture stems',unit:'STEM'});
    const recipe = await command('RECIPE',{productId:1,variantId:null,lines:[{ingredientId,quantity:3}]});
    const future = payload().deliveryDate;
    const expiry = new Date(new Date(future).getTime()+3*86400000).toISOString().slice(0,10);
    const batchA = randomUUID(), batchB = randomUUID();
    await command('RECEIVE',{ingredientId,code:'A',quantity:4,unitCost:10000,expiresOn:future},batchA);
    const receiveB = {ingredientId,code:'B',quantity:3,unitCost:12000,expiresOn:expiry};
    const first = await command('RECEIVE',receiveB,batchB);
    assert.deepEqual(await command('RECEIVE',receiveB,batchB),first);
    await assert.rejects(command('RECEIVE',{...receiveB,quantity:30},batchB),/IDEMPOTENCY_CONFLICT/);
    await command('ENABLE',{enabled:true});
    const request = payload();
    let order = await as(actors.alice,()=>rpc('gd_create_order',[request]));
    assert.equal(order.inventory_managed,true);
    assert.equal((await db.query('select reserved from gd_stock_batches where id=$1',[batchA])).rows[0].reserved,3);
    await as(actors.alice,()=>rpc('gd_create_order',[request]));
    assert.equal((await db.query('select count(*)::int n from gd_stock_allocations')).rows[0].n,1);
    const second = await as(actors.bob,()=>rpc('gd_create_order',[payload()]));
    const allocations = (await db.query('select batch_id,quantity from gd_stock_allocations where order_id=$1 order by quantity',[second.id])).rows;
    assert.deepEqual(allocations.map(row=>row.quantity),[1,2]);
    await assert.rejects(as(actors.bob,()=>rpc('gd_create_order',[payload()])),/STOCK_SHORTAGE/);
    assert.equal((await db.query('select count(*)::int n from gd_orders')).rows[0].n,2);
    assert.equal((await db.query('select sum(reserved)::int n from gd_stock_batches')).rows[0].n,6);
    await assert.rejects(command('WASTE',{batchId:batchA,quantity:1,reason:'Fixture damage'}),/STOCK_RESERVED_OR_INSUFFICIENT/);
    await as(actors.admin,()=>rpc('gd_update_order',[second.id,second.version,'CANCELLED','UNPAID','']));
    assert.equal((await db.query('select sum(reserved)::int n from gd_stock_batches')).rows[0].n,3);
    await command('RECIPE',{productId:1,variantId:null,lines:[{ingredientId,quantity:100}]});
    assert.equal((await db.query('select recipe_id from gd_stock_allocations where order_id=$1',[order.id])).rows[0].recipe_id,recipe.recipeId);
    for (const status of ['CONFIRMED','PREPARING']) order = await as(actors.admin,()=>rpc('gd_update_order',[order.id,order.version,status,'UNPAID','']));
    assert.equal((await db.query('select sum(on_hand)::int n,sum(reserved)::int r from gd_stock_batches')).rows[0].n,4);
    assert.equal((await db.query("select count(*)::int n from gd_stock_movements where kind='CONSUME'")).rows[0].n,1);
    await as(actors.admin,()=>rpc('gd_update_order',[order.id,order.version,'SHIPPING','UNPAID','']));
    assert.equal((await db.query("select count(*)::int n from gd_stock_movements where kind='CONSUME'")).rows[0].n,1);
    const waste = randomUUID(); const body={batchId:batchB,quantity:1,reason:'Fixture damaged stem'};
    await command('WASTE',body,waste); await command('WASTE',body,waste);
    assert.equal((await db.query('select on_hand from gd_stock_batches where id=$1',[batchB])).rows[0].on_hand,2);
    assert.equal((await db.query('select count(*)::int n from gd_stock_batches b where on_hand<>(select sum(delta) from gd_stock_movements m where m.batch_id=b.id)')).rows[0].n,0);
    await assert.rejects(db.exec("update gd_orders set inventory_managed=false where inventory_managed"),/INVENTORY_SNAPSHOT_IMMUTABLE/);
    await command('RECIPE',{productId:1,variantId:null,lines:[{ingredientId,quantity:1}]});
    await db.exec("update gd_stock_batches set expires_on=arrived_on");
    await assert.rejects(as(actors.alice,()=>rpc('gd_create_order',[payload()])),/STOCK_SHORTAGE/);
    await assert.rejects(command('RECIPE',{productId:1,variantId:null,lines:[{ingredientId,quantity:1},{ingredientId,quantity:2}]}),/duplicate key/);
    const revisions = (await db.query('select revision from gd_recipes where active')).rows;
    assert.equal(revisions[0].revision,3);
  } finally { await f.close(); }
});
