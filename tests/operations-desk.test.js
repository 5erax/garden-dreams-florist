import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { vietnamDate } from "../src/order.js";

const admin="33333333-3333-4333-8333-333333333333", customer="11111111-1111-4111-8111-111111111111";
const day=vietnamDate(new Date(Date.now()+86400000));
let db, orders=[];
async function as(user,run){
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user || '']);
  try{return await run();}finally{await db.exec('reset role');}
}
async function rpc(name,values=[]){return(await db.query(`select public.${name}(${values.map((_,i)=>`$${i+1}`).join(',')}) value`,values)).rows[0].value;}
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema auth to anon,authenticated; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for(const file of(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[admin,customer]);await db.query('insert into gd_admins values($1)',[admin]);
  await db.exec('update gd_shop set accepting_orders=true;update gd_shipping set active=true');
  const shipping=(await db.query('select id from gd_shipping')).rows[0].id;
  for(let i=0;i<3;i++)orders.push(await as(customer,()=>rpc('gd_create_order',[{requestId:randomUUID(),name:'Khách fixture',phone:'0900000000',
    address:'Địa chỉ giả trong fixture',message:'PRIVATE CARD',consent:true,deliveryDate:day,deliveryTime:'Chiều · 13–17h',
    items:[{id:1,quantity:1}],shippingId:shipping,paymentMethod:'COD',expectedTotal:390000}])));
});
after(async()=>db?.close());
test('work queues and summaries are admin-only and omit private card/address/bank',async()=>{
  for(const actor of[null,customer]){
    await assert.rejects(as(actor,()=>rpc('gd_operations_queue')));
    await assert.rejects(as(actor,()=>rpc('gd_operations_summary',[day])));
  }
  const rows=await as(admin,()=>rpc('gd_operations_queue',['PENDING',day,'',null,null,30]));
  assert.equal(rows.length,3);
  assert.doesNotMatch(JSON.stringify(rows),/PRIVATE CARD|Địa chỉ giả|recipient_phone|request_body|bank/);
  const totals=await as(admin,()=>rpc('gd_operations_summary',[day]));
  assert.equal(totals.pending,3);assert.equal(totals.outstanding,1170000);assert.equal(totals.heldCash,0);
});
test('cursor pagination has no duplicates and search/filter input is bounded',async()=>{
  const first=await as(admin,()=>rpc('gd_operations_queue',['ALL',day,'',null,null,1]));
  assert.equal(first.length,2);
  const next=await as(admin,()=>rpc('gd_operations_queue',['ALL',day,'',first[0].created_at,first[0].id,1]));
  assert.equal(next[0].id,first[1].id);
  const found=await as(admin,()=>rpc('gd_operations_queue',['ALL',null,orders[0].reference,null,null,30]));
  assert.equal(found.length,1);assert.equal(found[0].id,orders[0].id);
  for(const values of[['INVALID',null,'',null,null,30],['ALL',null,'%',null,null,30],['ALL',null,'',null,null,500],['ALL',null,'',null,orders[0].id,30]])
    await assert.rejects(as(admin,()=>rpc('gd_operations_queue',values)),/INVALID_QUEUE_FILTER/);
});
test('internal notes are private, append-only and idempotent without customer timeline leakage',async()=>{
  const id=randomUUID(),note='INTERNAL ONLY';
  await assert.rejects(as(customer,()=>rpc('gd_add_staff_note',[id,orders[0].id,note])),/ADMIN_REQUIRED/);
  const saved=await as(admin,()=>rpc('gd_add_staff_note',[id,orders[0].id,note]));
  const retry=await as(admin,()=>rpc('gd_add_staff_note',[id,orders[0].id,note]));assert.equal(retry.id,saved.id);
  await assert.rejects(as(admin,()=>rpc('gd_add_staff_note',[id,orders[0].id,'CHANGED'])),/IDEMPOTENCY_CONFLICT/);
  assert.equal((await as(customer,()=>db.query('select * from gd_order_staff_notes'))).rows.length,0);
  assert.equal((await as(admin,()=>db.query('select * from gd_order_staff_notes'))).rows.length,1);
  await assert.rejects(as(admin,()=>db.exec("update gd_order_staff_notes set body='Changed'")),/permission denied/);
  const events=await as(customer,()=>db.query('select * from gd_order_events where order_id=$1',[orders[0].id]));
  assert.doesNotMatch(JSON.stringify(events.rows),/INTERNAL ONLY/);
});
test('collection metrics change only after reconciliation and refund, cancelled unpaid orders are excluded',async()=>{
  let first=orders[0];
  first=await as(admin,()=>rpc('gd_update_order',[first.id,first.version,'CONFIRMED','PAID','Fixture receipt verified']));
  let second=orders[1];second=await as(admin,()=>rpc('gd_update_order',[second.id,second.version,'CANCELLED','UNPAID','']));
  let totals=await as(admin,()=>rpc('gd_operations_summary',[day]));
  assert.equal(totals.heldCash,390000);assert.equal(totals.outstanding,390000);assert.equal(totals.needsCollection,1);
  const collection=await as(admin,()=>rpc('gd_operations_queue',['COLLECTION',day,'',null,null,30]));assert.equal(collection.length,1);
  await as(admin,()=>rpc('gd_update_order',[first.id,first.version,'CONFIRMED','REFUNDED','Fixture refund recorded']));
  totals=await as(admin,()=>rpc('gd_operations_summary',[day]));assert.equal(totals.heldCash,0);
});
