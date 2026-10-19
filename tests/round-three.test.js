import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,actors} from './helpers/database.js';
import {isOverdue,inventoryChecklist} from '../src/admin-ux.js';
import {cartChoice,vietnamDate} from '../src/order.js';
import {readFile} from 'node:fs/promises';

test('identity repair follows explicitly seeded ids without rewinding an allocated sequence',async()=>{
 const f=await database();
 try{
  const next=(await f.db.query("select last_value+1 id from gd_products_id_seq")).rows[0].id;
  for(const id of [next,5000])await f.db.query("insert into gd_products(id,name,occasion,price,stems,description,image,active) values($1,'Seeded fixture','Sinh nhật',390000,'Hồng','Fixture','/flowers/bouquet_1.webp',false)",[id]);
  const insert=()=>f.db.query("insert into gd_products(name,occasion,price,stems,description,image,active) values('New fixture','Sinh nhật',390000,'Hồng','Fixture','/flowers/bouquet_1.webp',false) returning id");
  await assert.rejects(f.as(actors.admin,insert),/duplicate key/);
  const repair=await readFile(new URL('../supabase/migrations/20261019011608_repair_product_identity_sequence.sql',import.meta.url),'utf8');
  await f.db.exec(repair);assert.equal((await f.as(actors.admin,insert)).rows[0].id,5001);
  await f.db.exec("select setval('gd_products_id_seq',6000,true)");await f.db.exec(repair);
  assert.equal((await f.as(actors.admin,insert)).rows[0].id,6001);
 }finally{await f.close();}
});

test('admin product creation derives Vietnamese slugs while customers remain denied',async()=>{
 const f=await database();
 const insert=()=>f.db.query("insert into gd_products(name,occasion,price,stems,description,image,active) values('Đóa Hồng E2E','Sinh nhật',390000,'Hồng đỏ','Bó hoa thử','/flowers/bouquet_1.webp',true) returning id,slug");
 try{
  const {rows:[product]}=await f.as(actors.admin,insert);assert.equal(product.slug,`doa-hong-e2e-${product.id}`);
  await assert.rejects(f.as(actors.alice,insert),/row-level security/);
 }finally{await f.close();}
});

test('partial receipts/refunds preserve bounds, identity, privacy and report balances',async()=>{
 const f=await database();const admin=(name,args)=>f.as(actors.admin,()=>f.rpc(name,args));
 try{
  let order=await f.order();const receipt=(order,amount,id=randomUUID(),ref='')=>admin('gd_reconcile_payment',[id,order.id,order.version,'RECEIPT','Fixture bank proof',ref,amount]);
  await assert.rejects(receipt(order,100000),/INVALID_PAYMENT_TRANSITION/);
  order=await admin('gd_update_order',[order.id,order.version,'CONFIRMED','UNPAID','']);
  const id=randomUUID(),partial=await receipt(order,100000,id);
  assert.equal(partial.order.payment_status,'PARTIAL');assert.equal(partial.balance.receivable,290000);
  assert.equal((await receipt(order,100000,id)).event.id,id);
  await assert.rejects(receipt(order,110000,id),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(receipt(partial.order,290001),/INVALID_RECONCILIATION|INVALID_PAYMENT_TRANSITION/);
  assert.equal((await admin('gd_business_dashboard',[vietnamDate(),vietnamDate()])).receivableNow,290000);
  const full=await receipt(partial.order,290000);assert.equal(full.order.payment_status,'PAID');
  const refund=await admin('gd_reconcile_payment',[randomUUID(),order.id,full.order.version,'REFUND','Fixture partial refund','',50000]);
  assert.equal(refund.order.payment_status,'REFUND_PARTIAL');assert.equal(refund.balance.heldCash,340000);
  assert.equal(refund.balance.receivable,0);
  await assert.rejects(admin('gd_reconcile_payment',[randomUUID(),order.id,refund.order.version,'REFUND','Fixture excessive refund','',340001]),/INVALID_RECONCILIATION|INVALID_PAYMENT_TRANSITION/);
  const zero=await admin('gd_reconcile_payment',[randomUUID(),order.id,refund.order.version,'REFUND','Fixture final refund','',340000]);assert.equal(zero.order.payment_status,'REFUNDED');
  await assert.rejects(f.as(actors.alice,()=>f.rpc('gd_reconcile_payment',[randomUUID(),order.id,zero.order.version,'RECEIPT','Customer false proof','',1])),/ADMIN_REQUIRED/);
  const publicBalance=await f.as(actors.alice,()=>f.rpc('gd_payment_balance',[order.id]));assert.doesNotMatch(JSON.stringify(publicBalance),/Fixture|actor_id|reference/);
  await f.db.exec("update gd_shop set transfer_enabled=true,bank_bin='970422',bank_account='0000000000',account_name='TEST SHOP'");
  let bank=await f.order(actors.bob,{paymentMethod:'VIETQR'});bank=await admin('gd_update_order',[bank.id,bank.version,'CONFIRMED','UNPAID','']);
  await assert.rejects(receipt(bank,1),/PAYMENT_REFERENCE_REQUIRED/);
  assert.equal((await receipt(bank,1,randomUUID(),'BANK-UNIQUE')).order.payment_status,'PARTIAL');
 }finally{await f.close();}
});

test('overdue queues agree with dashboard; rescheduling keeps money and enforces version and permissions',async()=>{
 const f=await database();const admin=(name,args)=>f.as(actors.admin,()=>f.rpc(name,args));
 try{
  let order=await f.order();assert.match(order.reference,/^GD-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  await f.db.exec('alter table gd_orders disable trigger guard_delivery_calendar');
  await f.db.query("update gd_orders set delivery_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date-1 where id=$1",[order.id]);
  await f.db.exec('alter table gd_orders enable trigger guard_delivery_calendar');
  await assert.rejects(admin('gd_update_order',[order.id,order.version,'CONFIRMED','UNPAID','']),/ORDER_OVERDUE/);
  const totals=await admin('gd_operations_summary',[null]),dashboard=await admin('gd_business_dashboard',[vietnamDate(),vietnamDate()]);
  assert.equal(totals.queueCounts.OVERDUE,1);assert.equal(dashboard.overdueNow,1);
  assert.equal((await admin('gd_operations_queue',['OVERDUE',null,'',null,null,30])).length,1);
  await assert.rejects(f.as(actors.alice,()=>f.rpc('gd_reschedule_order',[order.id,order.version,order.delivery_date,order.delivery_time,'Customer changed time'])),/ADMIN_REQUIRED/);
  const saved=await admin('gd_reschedule_order',[order.id,order.version,order.delivery_date,order.delivery_time,'Customer agreed to new time']);
  assert.equal(saved.total,order.total);assert.equal(saved.version,order.version+1);
  await assert.rejects(admin('gd_reschedule_order',[order.id,order.version,order.delivery_date,'Sáng · 9–12h','Customer agreed to morning']),/VERSION_CONFLICT/);
  assert.equal((await admin('gd_operations_summary',[null])).queueCounts.OVERDUE,0);
 }finally{await f.close();}
});

test('empty stock cannot activate, photographs gate purchase, and Vietnamese name slugs preserve custom links',async()=>{
 const f=await database();
 try{
  const state=await f.as(actors.admin,()=>f.rpc('gd_inventory_state'));assert.deepEqual(state.readiness,{ingredients:false,recipes:false,stock:false});
  assert.equal(Object.values(inventoryChecklist(state,[],vietnamDate())).every(Boolean),false);
  assert.equal(cartChoice({id:1},[{id:1,active:true,image:'/flowers/placeholder.svg',price:1}]),null);
  await f.db.exec("update gd_products set image='/flowers/placeholder.svg' where id=1");
  await assert.rejects(f.order(),/PRODUCT_PHOTO_REQUIRED/);
  await f.db.exec("update gd_products set name='Đóa Hồng Mẫu Đơn',slug='bo-hoa-1' where id=1;update gd_products set slug='custom-keep' where id=2");
  await assert.rejects(f.as(actors.alice,()=>f.rpc('gd_generate_product_slugs',[[1,2]])),/ADMIN_REQUIRED/);
  assert.equal(await f.as(actors.admin,()=>f.rpc('gd_generate_product_slugs',[[1,2]])),1);
  assert.deepEqual((await f.db.query('select slug from gd_products where id in (1,2) order by id')).rows.map(r=>r.slug),['doa-hong-mau-don-1','custom-keep']);
  assert.equal(isOverdue({delivery_date:'2026-10-11',delivery_time:'Chiều · 13–17h',status:'PENDING'},Date.parse('2026-10-11T10:01:00Z')),true);
 }finally{await f.close();}
});

test('morning cutoff falls on prior evening and rescheduling cannot exceed slot capacity',async()=>{
 const f=await database();const admin=(name,args)=>f.as(actors.admin,()=>f.rpc(name,args));
 try{
  const day=f.payload().deliveryDate, next=vietnamDate(new Date(Date.parse(day+'T12:00:00Z')+86400000));
  const rule=await admin('gd_save_delivery_rule',[null,null,{shippingId:f.shipping,deliveryTime:'Sáng · 9–12h',weekdays:[1,2,3,4,5,6,7],capacity:1,leadMinutes:120,active:true}]);
  const cutoff=day+'T07:00:00+07:00', expected=new Date(Date.parse(day+'T20:00:00+07:00')-86400000).toISOString();
  const check=(await f.db.query('select gd_private.delivery_option($1,$2,$3,$4) value',[f.shipping,day,rule.delivery_time,new Date(Date.parse(expected)-1).toISOString()])).rows[0].value;
  assert.equal(new Date(check.cutoffAt).toISOString(),expected);assert.equal(check.available,true);
  const closed=(await f.db.query('select gd_private.delivery_option($1,$2,$3,$4) value',[f.shipping,day,rule.delivery_time,expected])).rows[0].value;assert.equal(closed.reason,'CUTOFF');
  assert.notEqual(new Date(check.cutoffAt).toISOString(),new Date(cutoff).toISOString());
  await admin('gd_set_delivery_calendar',[1,true]);
  let one=await f.order(actors.alice,{deliveryTime:rule.delivery_time});
  let two=await f.order(actors.bob,{deliveryDate:next,deliveryTime:rule.delivery_time});
  one=await admin('gd_update_order',[one.id,one.version,'CONFIRMED','UNPAID','']);
  two=await admin('gd_update_order',[two.id,two.version,'CONFIRMED','UNPAID','']);
  await assert.rejects(admin('gd_reschedule_order',[one.id,one.version,next,rule.delivery_time,'Customer agreed to later date']),/DELIVERY_UNAVAILABLE/);
  assert.equal((await f.db.query('select version from gd_orders where id=$1',[one.id])).rows[0].version,one.version);
  assert.equal((await f.db.query('select count(*)::int count from gd_private.reschedule_authorizations')).rows[0].count,0);
 }finally{await f.close();}
});
