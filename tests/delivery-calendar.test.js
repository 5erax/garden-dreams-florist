import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { vietnamDate } from "../src/order.js";

const admin = "33333333-3333-4333-8333-333333333333";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const label = "Chiều · 13–17h";
const day = vietnamDate(new Date(Date.now() + 2 * 86400000));
let db, shipping, rule;
async function as(user, run) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
  try { return await run(); } finally { await db.exec("reset role"); }
}
async function rpc(name, values=[]) {
  return (await db.query(`select public.${name}(${values.map((_,i)=>`$${i+1}`).join(',')}) value`,values)).rows[0].value;
}
const fields = changes => ({shippingId:shipping,deliveryTime:label,weekdays:[1,2,3,4,5,6,7],capacity:1,leadMinutes:60,active:true,...changes});
async function saveRule(changes={}) {
  rule=await as(admin,()=>rpc("gd_save_delivery_rule",[rule?.id || null,rule?.version || null,fields(changes)]));
  return rule;
}
const payload = changes => ({requestId:randomUUID(),name:"Khách kiểm thử",phone:"0900000000",address:"Địa chỉ giả dùng trong fixture",
  deliveryDate:day,deliveryTime:label,message:"Lời riêng tư",consent:true,items:[{id:1,quantity:1}],
  shippingId:shipping,paymentMethod:"COD",expectedTotal:390000,...changes});
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.query("insert into auth.users values($1),($2),($3)",[admin,alice,bob]);
  await db.query("insert into gd_admins values($1)",[admin]);
  await db.exec("update gd_shop set accepting_orders=true; update gd_shipping set active=true");
  shipping=(await db.query("select id from gd_shipping")).rows[0].id;
});
after(async()=>db?.close());

test("calendar is additive/off by default and private configuration cannot be changed by customers",async()=>{
  const initial=await as(null,()=>rpc("gd_delivery_options",[shipping,day]));
  assert.deepEqual(initial,{enabled:false,slots:[]});
  for(const actor of [null,alice]){
    await assert.rejects(as(actor,()=>rpc("gd_save_delivery_rule",[null,null,fields()])));
    await assert.rejects(as(actor,()=>db.exec("update gd_delivery_settings set enabled=true")));
  }
  assert.equal((await as(alice,()=>db.query("select * from gd_delivery_rules"))).rows.length,0);
  await assert.rejects(as(admin,()=>rpc("gd_set_delivery_calendar",[1,true])),/DELIVERY_RULE_REQUIRED/);
  const legacy=await as(alice,()=>rpc("gd_create_order",[payload()]));
  assert.equal(legacy.delivery_rule_id,null);
  assert.equal(legacy.shipping.calendar,undefined);
});
test("rules validate types, version and identity; calendar options expose no contacts or private message",async()=>{
  for(const change of [{weekdays:[0]}, {weekdays:[null]}, {capacity:1.5}, {leadMinutes:-1}, {active:"true"}])
    await assert.rejects(as(admin,()=>rpc("gd_save_delivery_rule",[null,null,fields(change)])),/INVALID_DELIVERY_RULE/);
  await saveRule();
  await assert.rejects(as(admin,()=>rpc("gd_save_delivery_rule",[rule.id,rule.version+1,fields()])),/VERSION_CONFLICT/);
  await assert.rejects(as(admin,()=>rpc("gd_save_delivery_rule",[rule.id,rule.version,fields({deliveryTime:"Sáng · 9–12h"})])),/IDENTITY_IMMUTABLE/);
  await as(admin,()=>rpc("gd_set_delivery_calendar",[1,true]));
  const options=await as(null,()=>rpc("gd_delivery_options",[shipping,day]));
  assert.equal(options.enabled,true);
  assert.equal(options.slots.find(s=>s.time===label).available,true);
  assert.equal(options.slots.find(s=>s.time==="Sáng · 9–12h").reason,"NO_SLOT");
  assert.doesNotMatch(JSON.stringify(options),/recipient|phone|Lời riêng tư|address|owner/);
  await assert.rejects(as(null,()=>rpc("gd_delivery_options",[shipping,"2000-01-01"])),/INVALID_DATE/);
});
test("cutoff uses Vietnam time and the exact boundary is closed",async()=>{
  const cutoff=`${day}T12:00:00+07:00`;
  const previous=new Date(new Date(cutoff).getTime()-1).toISOString();
  const option=async time=>(await db.query("select gd_private.delivery_option($1,$2,$3,$4) value",[shipping,day,label,time])).rows[0].value;
  assert.equal((await option(previous)).available,true);
  assert.equal((await option(cutoff)).reason,"CUTOFF");
  await assert.rejects(as(alice,()=>db.query("select gd_private.delivery_option($1,$2,$3,$4)",[shipping,day,label,previous])),/permission denied/);
});
test("confirmation consumes the last seat, retries cannot double-book, cancellation releases it",async()=>{
  const intent=payload();
  let first=await as(alice,()=>rpc("gd_create_order",[intent]));
  let second=await as(bob,()=>rpc("gd_create_order",[payload()]));
  assert.equal(first.shipping.calendar.capacity,1);
  assert.equal(first.delivery_rule_id,rule.id);
  first=await as(admin,()=>rpc("gd_update_order",[first.id,first.version,"CONFIRMED","UNPAID",""]));
  await assert.rejects(as(admin,()=>rpc("gd_update_order",[second.id,second.version,"CONFIRMED","UNPAID",""])),/DELIVERY_UNAVAILABLE:FULL/);
  assert.equal((await as(null,()=>rpc("gd_delivery_options",[shipping,day]))).slots.find(s=>s.time===label).remaining,0);
  const retry=await as(alice,()=>rpc("gd_create_order",[intent]));
  assert.equal(retry.id,first.id);
  await assert.rejects(as(alice,()=>rpc("gd_create_order",[payload()])),/DELIVERY_UNAVAILABLE:FULL/);
  await assert.rejects(saveRule({capacity:0}),/CAPACITY_BELOW_RESERVATIONS/);
  first=await as(admin,()=>rpc("gd_update_order",[first.id,first.version,"CANCELLED","UNPAID",""]));
  await assert.rejects(as(admin,()=>rpc("gd_update_order",[first.id,first.version-1,"CANCELLED","UNPAID",""])),/VERSION_CONFLICT/);
  second=await as(admin,()=>rpc("gd_update_order",[second.id,second.version,"CONFIRMED","UNPAID",""]));
  assert.equal(second.status,"CONFIRMED");
  await assert.rejects(as(admin,()=>rpc("gd_save_delivery_closure",[null,null,{shippingId:shipping,date:day,reason:"Test",active:true}])),/DAY_HAS_RESERVATIONS/);
  await assert.rejects(db.query("update gd_orders set delivery_time='Sáng · 9–12h' where id=$1",[second.id]),/CALENDAR_SNAPSHOT_IMMUTABLE/);
  await as(admin,()=>rpc("gd_update_order",[second.id,second.version,"CANCELLED","UNPAID",""]));
});
test("shop/service closure and a disabled or zero-capacity rule fail closed",async()=>{
  await db.exec("update gd_shop set accepting_orders=false");
  assert.equal((await as(null,()=>rpc("gd_delivery_options",[shipping,day]))).reason,"CLOSED");
  await db.exec("update gd_shop set accepting_orders=true; update gd_shipping set active=false");
  assert.equal((await as(null,()=>rpc("gd_delivery_options",[shipping,day]))).reason,"CLOSED");
  await db.exec("update gd_shipping set active=true");
  await saveRule({active:false});
  assert.equal((await as(null,()=>rpc("gd_delivery_options",[shipping,day]))).slots.find(s=>s.time===label).reason,"NO_SLOT");
  await saveRule({capacity:0});
  assert.equal((await as(null,()=>rpc("gd_delivery_options",[shipping,day]))).slots.find(s=>s.time===label).reason,"FULL");
  await saveRule({capacity:2});
});
test("holidays and weekly closure block new orders; old snapshots and audit remain",async()=>{
  const closureFields={shippingId:shipping,date:day,reason:"Nghỉ trong fixture",active:true};
  const closure=await as(admin,()=>rpc("gd_save_delivery_closure",[null,null,closureFields]));
  assert.equal((await as(null,()=>rpc("gd_delivery_options",[shipping,day]))).slots.find(s=>s.time===label).reason,"DAY_CLOSED");
  await assert.rejects(as(alice,()=>rpc("gd_create_order",[payload()])),/DELIVERY_UNAVAILABLE:DAY_CLOSED/);
  await as(admin,()=>rpc("gd_save_delivery_closure",[closure.id,closure.version,{...closureFields,active:false}]));
  const excluded=Number((await db.query("select extract(isodow from $1::date) as weekday",[day])).rows[0].weekday);
  await saveRule({weekdays:[1,2,3,4,5,6,7].filter(d=>d!==excluded)});
  await assert.rejects(as(alice,()=>rpc("gd_create_order",[payload()])),/DAY_CLOSED/);
  await saveRule({capacity:2});
  const current=await as(alice,()=>rpc("gd_create_order",[payload()]));
  assert.equal(current.shipping.calendar.capacity,2);
  const previous=(await db.query("select shipping from gd_orders where delivery_rule_id=$1 and id<>$2 limit 1",[rule.id,current.id])).rows[0];
  assert.equal(previous.shipping.calendar.capacity,1);
  assert.ok((await as(admin,()=>db.query("select * from gd_admin_audit where entity='gd_delivery_rules'"))).rows.length>0);
  assert.equal((await as(alice,()=>db.query("select * from gd_admin_audit"))).rows.length,0);
});
