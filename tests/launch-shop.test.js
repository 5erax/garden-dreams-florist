import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("shop setup preserves prices and closed status, remains private and reruns without duplicate shipping", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      grant usage on schema auth to anon,authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      insert into auth.users values('33333333-3333-4333-8333-333333333333','dha260803@gmail.com',now());`);
    for (const file of ['202610090001_shop.sql','202610090002_orders.sql','202610090003_catalog.sql','202610090004_audit.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8'));
    const sql = await readFile(new URL('../supabase/launch-shop.sql',import.meta.url),'utf8');
    await assert.rejects(db.exec(sql), /SHOP_OWNER_NOT_CONFIRMED/);
    await db.exec('rollback');
    await db.exec("insert into public.gd_admins values('33333333-3333-4333-8333-333333333333');");
    const before = (await db.query('select id,price from public.gd_products order by id')).rows;
    await db.exec(sql);
    await db.exec(sql);
    const shop = (await db.query('select * from public.gd_shop')).rows[0];
    assert.equal(shop.accepting_orders,false);
    assert.equal(shop.cod_enabled,true);
    assert.equal(shop.transfer_enabled,true);
    assert.equal(shop.bank_bin,'970422');
    assert.equal(shop.bank_account,'0832345780');
    assert.equal(shop.account_name,'Hà Văn Phước');
    assert.match(shop.address,/665L/);
    assert.deepEqual((await db.query('select id,price from public.gd_products order by id')).rows,before);
    assert.deepEqual((await db.query('select fee from public.gd_shipping where active order by fee')).rows.map(x=>x.fee),[0,30000,50000]);
    await db.exec('set role anon');
    assert.equal((await db.query('select address from public.gd_shop')).rows[0].address,shop.address);
    await assert.rejects(db.exec('update public.gd_shop set accepting_orders=true'),/permission denied/);
    await db.exec('reset role');
    await db.exec(`create function public.gd_environment() returns jsonb language sql as $$select '{"projectRef":"tgvozhrkolcpszyyrgth","environment":"staging"}'::jsonb$$;`);
    await assert.rejects(db.exec(sql),/WRONG_ENVIRONMENT/);
    await db.exec('rollback');
    await db.exec('drop function public.gd_environment(); update public.gd_shop set accepting_orders=true');
    const services=(await db.query('select id,fee from public.gd_shipping where active order by fee')).rows;
    await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false)");
    for (const service of services) {
      const request={requestId:crypto.randomUUID(),name:'Khách thử',phone:'0900000000',address:'Địa chỉ giả, không giao hoa',message:'Lời nhắn thử',consent:true,website:'',
        deliveryDate:new Date(Date.now()+86400000).toISOString().slice(0,10),deliveryTime:'Chiều · 13–17h',items:[{id:1,quantity:1}],shippingId:service.id,paymentMethod:'VIETQR',expectedTotal:390000+service.fee};
      const order=(await db.query('select public.gd_create_order($1) as value',[request])).rows[0].value;
      assert.equal(order.total,request.expectedTotal);
      assert.equal(order.payment_status,'UNPAID');
      assert.equal(order.bank.account,'0832345780');
      assert.equal(order.bank.accountName,'Hà Văn Phước');
    }
  } finally { await db.close(); }
});
