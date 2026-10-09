import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

let db, variant;
const admin = "33333333-3333-4333-8333-333333333333";
const customer = "11111111-1111-4111-8111-111111111111";
async function as(user, fn) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for (const file of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1),($2)", [admin, customer]);
  await db.query("insert into gd_admins values($1)", [admin]);
});
after(async () => db?.close());

test("orders price variants on the server, preserve snapshots/retries and reject disabled or foreign sizes", async () => {
  await db.exec("update gd_shop set accepting_orders=true; update gd_shipping set active=true");
  const shipping = (await db.query("select id from gd_shipping")).rows[0].id;
  const v = (await as(admin, () => db.exec("insert into gd_product_variants(product_id,sku,size_name,price) values(2,'GD-2-L','Bó lớn',800000) returning *")))[0].rows[0];
  const payload = { requestId: randomUUID(), name: "Khách thử", phone: "0900000000", address: "Địa chỉ giả để kiểm thử",
    deliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), deliveryTime: "Chiều · 13–17h",
    consent: true, message: "Lời nhắn nguyên vẹn", shippingId: shipping, paymentMethod: "COD", expectedTotal: 1290000,
    items: [{ id: 2, variantId: v.id, quantity: 1, price: 1, sizeName: "Giả" }, { id: 2, quantity: 1 }] };
  const place = p => as(customer, async () => (await db.query("select gd_create_order($1::jsonb) value", [JSON.stringify(p)])).rows[0].value);
  let order = await place(payload);
  assert.equal(order.total, 1290000);
  assert.equal(order.items[0].price, 800000);
  assert.equal(order.items[0].sizeName, "Bó lớn");
  assert.equal(order.items[0].sku, "GD-2-L");
  assert.equal(order.items[0].occasion, "Tình yêu");
  for (const invalid of [
    { items: [{ id: 1, variantId: v.id, quantity: 1 }] },
    { items: [{ id: 2, variantId: 999999, quantity: 1 }] },
    { items: [{ id: 2, variantId: "1", quantity: 1 }] },
    { items: [{ id: 2, variantId: 1.5, quantity: 1 }] },
    { items: [null] },
    { items: [{ id: 2 }] },
    { items: [{ id: 2, quantity: 1 }, { id: 2, variantId: null, quantity: 1 }] },
    { items: [{ id: 2, variantId: v.id, quantity: 1 }, { id: 2, variantId: v.id, quantity: 1 }] },
    { expectedTotal: 1 },
  ]) await assert.rejects(place({ ...payload, ...invalid, requestId: randomUUID() }), /VARIANT_UNAVAILABLE|INVALID_ITEMS|PRICE_CHANGED/);
  await as(admin, () => db.query("update gd_product_variants set price=900000,size_name='Cỡ mới',sku='GD-2-NEW',active=false where id=$1", [v.id]));
  await db.exec("update gd_products set occasion='Chúc mừng' where id=2");
  assert.deepEqual((await place(payload)).items, order.items);
  await assert.rejects(place({ ...payload, requestId: randomUUID() }), /VARIANT_UNAVAILABLE/);
  await assert.rejects(place({ ...payload, items: [{ id: 2, quantity: 1 }] }), /IDEMPOTENCY_CONFLICT/);
  for (const status of ["CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED"])
    order = await as(admin, async () => (await db.query("select gd_update_order($1,$2,$3,$4,$5) value", [order.id, order.version, status, status === "DELIVERED" ? "PAID" : "UNPAID", "Đối soát giả kiểm thử"])).rows[0].value);
  const memory = (await db.query("select * from gd_memories where order_id=$1", [order.id])).rows[0];
  assert.deepEqual(memory.flower_metadata, { productId: 2, occasion: "Tình yêu", variantId: v.id, sku: "GD-2-L", sizeName: "Bó lớn" });
  await assert.rejects(db.exec("update gd_memories set flower_metadata='{}'"), /MEMORY_METADATA_IMMUTABLE/);
  await as(admin, () => db.query("update gd_product_variants set active=true where id=$1", [v.id]));
  await assert.rejects(place({ ...payload, requestId: randomUUID() }), /PRICE_CHANGED/);
});

test("variant management validates catalog, preserves parent/version/audit and excludes disabled choices", async () => {
  for (const user of [null, customer])
    await assert.rejects(as(user, () => db.exec("insert into gd_product_variants(product_id,sku,size_name,price) values(1,'GD-L','Bó lớn',690000)")), /permission denied|row-level security/);
  variant = (await as(admin, () => db.query("insert into gd_product_variants(product_id,sku,size_name,price) values(1,'GD-L','Bó lớn',690000) returning *"))).rows[0];
  assert.equal((await as(null, () => db.query("select * from gd_product_variants where product_id=1"))).rows.length, 1);
  for (const [sku, size, price, productId] of [["bad code", "Bó lớn", 500000, 1], ["GD-M", " ", 500000, 1],
    ["GD-M", "Bó vừa", 1, 1], ["GD-M", "Bó vừa", 100000001, 1], ["GD-M", "Bó vừa", 500000, 999]])
    await assert.rejects(as(admin, () => db.query("insert into gd_product_variants(product_id,sku,size_name,price) values($1,$2,$3,$4)", [productId, sku, size, price])), /constraint/);
  await assert.rejects(as(admin, () => db.exec("insert into gd_product_variants(product_id,sku,size_name,price) values(2,'GD-L','Bó lớn',500000)")), /unique constraint/);
  await assert.rejects(as(admin, () => db.query("update gd_product_variants set product_id=2 where id=$1", [variant.id])), /VARIANT_PARENT_IMMUTABLE/);
  await as(customer, () => db.exec("update gd_product_variants set price=1000 where product_id=1"));
  assert.equal((await db.query("select price from gd_product_variants where product_id=1")).rows[0].price, 690000);
  const changed = (await as(admin, () => db.query("update gd_product_variants set active=false where id=$1 and version=$2 returning *", [variant.id, variant.version]))).rows[0];
  assert.equal(changed.version, variant.version + 1);
  assert.equal((await as(admin, () => db.query("update gd_product_variants set price=1000 where id=$1 and version=$2 returning *", [variant.id, variant.version]))).rows.length, 0);
  assert.equal((await as(null, () => db.query("select * from gd_product_variants where product_id=1"))).rows.length, 0);
  assert.equal((await as(admin, () => db.query("select * from gd_product_variants where product_id=1"))).rows.length, 1);
  await as(admin, () => db.exec("update gd_product_variants set active=true where product_id=1; update gd_products set active=false where id=1"));
  assert.equal((await as(null, () => db.query("select * from gd_product_variants where product_id=1"))).rows.length, 0);
  assert.equal((await as(customer, () => db.query("select * from gd_admin_audit where entity='gd_product_variants'"))).rows.length, 0);
  assert.equal((await as(admin, () => db.query("select * from gd_admin_audit where entity='gd_product_variants' and entity_id=$1", [variant.id.toString()]))).rows.length, 3);
  await assert.rejects(as(admin, () => db.exec("delete from gd_product_variants")), /permission denied/);
  await db.exec("update gd_products set active=true where id=1");
});
