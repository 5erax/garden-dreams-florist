import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,actors} from './helpers/database.js';
import {datePresets,recipeCsv,csvText,cutoffLabel,batchState,deliveryRemaining} from '../src/admin-ux.js';
import {guestStorage} from '../src/guest-session.js';

test('report periods, recipe import, CSV escaping and delivery clocks handle boundaries',()=>{
 assert.deepEqual(datePresets('2024-03-01')[3],['Tháng trước','2024-02-01','2024-02-29']);
 assert.equal(cutoffLabel('Sáng · 8–12h',120),'06:00');
 assert.equal(cutoffLabel('invalid',120),'Chưa xác định');
 assert.equal(batchState({expires_on:'2026-10-10'},'2026-10-11'),'expired');
 assert.deepEqual(recipeCsv('name,quantity\n"Hồng, đỏ",3',[{id:'one',name:'Hồng, đỏ'}]),[{ingredientId:'one',quantity:3}]);
 for(const text of ['name,quantity\nUnknown,3','name,quantity\nHồng,0','name,quantity\n"Hồng,3'])assert.throws(()=>recipeCsv(text,[{id:'one',name:'Hồng'}]));
 assert.match(csvText([['=1+1','a"b']]),/"'=1\+1","a""b"/);
 assert.match(deliveryRemaining({delivery_date:'2026-10-11',delivery_time:'Chiều · 13–17h'},Date.parse('2026-10-11T09:00:00Z')),/Còn 1h 0 phút/);
});

test('account survives same-tab reload and signout clears it without device persistence',()=>{
 const device=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const disk=device(),tab=device(),value=JSON.stringify({user:{id:'alice',is_anonymous:false}});
 guestStorage('project',disk,tab).setItem('project',value);
 assert.equal(guestStorage('project',disk,tab).getItem('project'),value);
 assert.equal(guestStorage('project',disk,device()).getItem('project'),null);
 assert.equal(disk.getItem('project'),null);
 guestStorage('project',disk,tab).removeItem('project');
 assert.equal(guestStorage('project',disk,tab).getItem('project'),null);
});

test('admin audit migration preserves privacy, buyer retention, composition and atomic settings',async()=>{
 const f=await database();const {db,as,rpc}=f;
 const command=(action,body)=>as(actors.admin,()=>rpc('gd_inventory_command',[randomUUID(),action,body]));
 try{
  for(const actor of [null,actors.alice]){
   await assert.rejects(as(actor,()=>rpc('gd_admin_memories')),/permission denied|ADMIN_REQUIRED/);
   await assert.rejects(as(actor,()=>rpc('gd_close_delivery_range',['2026-10-11','2026-10-12',null,'Fixture closure'])),/permission denied|ADMIN_REQUIRED/);
   await assert.rejects(as(actor,()=>rpc('gd_reorder_products',[[1]])),/permission denied|ADMIN_REQUIRED/);
  }
  const request=f.payload({buyerName:'Người đặt fixture',buyerPhone:'0900000001'});
  const order=await as(actors.alice,()=>rpc('gd_create_order',[request]));
  assert.equal(order.buyer_phone,'0900000001');
  assert.equal((await as(actors.alice,()=>rpc('gd_create_order',[request]))).id,order.id);
  await assert.rejects(f.order(actors.bob,{buyerPhone:'bad'}),/check constraint/);
  await db.query('update gd_orders set contacts_erased_at=now() where id=$1',[order.id]);
  assert.equal((await db.query('select buyer_phone from gd_orders where id=$1',[order.id])).rows[0].buyer_phone,null);
  let delivered=(await as(actors.admin,()=>rpc('gd_reconcile_payment',[randomUUID(),order.id,order.version,'RECEIPT','Fixture verified payment','']))).order;
  for(const status of ['CONFIRMED','PREPARING','SHIPPING','DELIVERED'])delivered=await as(actors.admin,()=>rpc('gd_update_order',[delivered.id,delivered.version,status,'PAID','']));
  const memory=(await db.query('select id from gd_memories where order_id=$1',[order.id])).rows[0];
  assert.equal(Number(await rpc('gd_memory_count')),0);
  const shared=await as(actors.alice,()=>rpc('gd_share_memory',[memory.id,'GARDEN','Người thử']));
  assert.equal(Number(await rpc('gd_memory_count')),1);
  await as(actors.admin,()=>rpc('gd_moderate_memory',[memory.id,1,true,'Fixture moderation']));
  assert.equal(Number(await rpc('gd_memory_count')),0);
  assert.equal(await rpc('gd_public_memory',[shared.share_token]),null);
  await assert.rejects(as(actors.admin,()=>rpc('gd_moderate_memory',[memory.id,1,false,'Fixture restore'])),/VERSION_CONFLICT/);
  await as(actors.admin,()=>rpc('gd_moderate_memory',[memory.id,2,false,'Fixture restore']));
  assert.equal(Number(await rpc('gd_memory_count')),1);
  const {ingredientId}=await command('INGREDIENT',{name:'Hồng thật fixture',unit:'GRAM',minimumStock:25});
  await command('RECIPE',{productId:1,variantId:null,lines:[{ingredientId,quantity:3}]});
  let product=(await db.query('select stems,recipe_managed from gd_products where id=1')).rows[0];
  assert.equal(product.recipe_managed,true);assert.match(product.stems,/Hồng thật fixture × 3/);
  await db.exec("update gd_products set stems='Incorrect manual composition' where id=1");
  assert.match((await db.query('select stems from gd_products where id=1')).rows[0].stems,/Hồng thật fixture/);
  assert.equal((await db.query('select minimum_stock from gd_ingredients where id=$1',[ingredientId])).rows[0].minimum_stock,25);
  const ids=(await db.query('select id from gd_products order by id desc')).rows.map(row=>row.id);
  await as(actors.admin,()=>rpc('gd_reorder_products',[ids]));
  assert.equal((await db.query('select id from gd_products order by sort_order limit 1')).rows[0].id,ids[0]);
  await assert.rejects(as(actors.admin,()=>rpc('gd_reorder_products',[[ids[0]]])),/INVALID_ITEMS/);
  const reservedDay=f.payload().deliveryDate;
  const day=new Date(Date.parse(reservedDay)+86400000).toISOString().slice(0,10);
  await assert.rejects(as(actors.admin,()=>rpc('gd_close_delivery_range',[reservedDay,day,null,'Fixture closure'])),/DAY_HAS_RESERVATIONS/);
  await assert.rejects(as(actors.admin,()=>rpc('gd_close_delivery_range',[day,day,randomUUID(),'Fixture closure'])),/SHIPPING_UNAVAILABLE/);
  assert.equal((await db.query('select count(*)::int n from gd_delivery_closures')).rows[0].n,0);
  assert.equal(await as(actors.admin,()=>rpc('gd_close_delivery_range',[day,day,f.shipping,'Fixture closure'])),1);
  const shop=(await db.query('select opens_at,closes_at,returns_policy,registration_number from gd_shop')).rows[0];
  assert.equal(shop.opens_at,'08:00:00');assert.equal(shop.closes_at,'17:00:00');assert.equal(shop.registration_number,'');assert.ok(shop.returns_policy.length>100);
 }finally{await f.close();}
});
