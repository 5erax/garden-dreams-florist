import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { products } from "../src/catalog.js";
import { randomUUID } from "node:crypto";

let db;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
let shipping;
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function as(user, fn) {
  await db.exec(`set role ${user ? "authenticated" : "anon"};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const rpc = async (name, args) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
      args,
    )
  ).rows[0].value;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('${alice}'),('${bob}'),('${admin}');`);
  for (const file of [
    "202610090001_shop.sql",
    "202610090002_orders.sql",
    "202610090003_catalog.sql",
    "202610090004_audit.sql",
    "202610090005_environment.sql",
    "202610090006_product_albums.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  await db.query("insert into public.gd_admins values($1)", [admin]);
  await db.exec(
    "update public.gd_shop set accepting_orders=true; update public.gd_shipping set active=true,fee=30000;",
  );
  shipping = (await db.query("select id from public.gd_shipping")).rows[0].id;
});
after(async () => await db?.close());
function order(requestId = id) {
  return {
    requestId,
    name: "Khách thử",
    phone: "0900000000",
    address: "Địa chỉ giả để kiểm thử",
    deliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    deliveryTime: "Chiều · 13–17h",
    message: "Cảm ơn mẹ vì luôn chờ con về.",
    consent: true,
    items: [{ id: 1, quantity: 2, price: 1 }],
    shippingId: shipping,
    paymentMethod: "COD",
    expectedTotal: 810000,
  };
}
test("SQL migrations execute on PostgreSQL; anon sees only public shop/catalog and cannot grant itself admin", async () => {
  assert.equal(
    (await as(null, () => db.query("select * from public.gd_shop"))).rows
      .length,
    1,
  );
  await assert.rejects(
    as(null, () => db.query("select * from public.gd_orders")),
  );
  await assert.rejects(
    as(alice, () =>
      db.query("insert into public.gd_admins values($1)", [alice]),
    ),
  );
  const denied = await as(alice, () =>
    db.query(
      "update public.gd_shop set bank_account='1234',bank_bin='970436',account_name='TEST' returning *",
    ),
  );
  assert.equal(denied.rows.length, 0);
  assert.equal(
    (await db.query("select bank_account from public.gd_shop")).rows[0]
      .bank_account,
    "",
  );
});
test("orders use database prices/ship snapshots, enforce consent and isolate customer data", async () => {
  await assert.rejects(
    as(null, () => rpc("gd_create_order", [order()])),
    /permission denied/,
  );
  await assert.rejects(
    as(alice, () => rpc("gd_create_order", [{ ...order(), consent: false }])),
    /CONSENT_REQUIRED/,
  );
  const placed = await as(alice, () => rpc("gd_create_order", [order()]));
  assert.equal(placed.total, 810000);
  assert.equal(placed.items[0].price, 390000);
  assert.equal(
    (await as(bob, () => db.query("select * from public.gd_orders"))).rows
      .length,
    0,
  );
  assert.equal(
    (await as(alice, () => db.query("select * from public.gd_orders"))).rows
      .length,
    1,
  );
  assert.equal(placed.request_body, undefined);
  await assert.rejects(
    as(alice, () =>
      db.query("update public.gd_orders set payment_status='PAID'"),
    ),
    /permission denied/,
  );
});
test("retry returns one order and refuses changed payload or another owner; price changes do not change old totals", async () => {
  const again = await as(alice, () => rpc("gd_create_order", [order()]));
  assert.equal(again.id, id);
  await assert.rejects(
    as(alice, () =>
      rpc("gd_create_order", [{ ...order(), message: "changed" }]),
    ),
    /IDEMPOTENCY_CONFLICT/,
  );
  await assert.rejects(
    as(bob, () => rpc("gd_create_order", [order()])),
    /IDEMPOTENCY_CONFLICT/,
  );
  await as(admin, () =>
    db.exec("update public.gd_products set price=999000 where id=1"),
  );
  assert.equal(
    (await as(alice, () => rpc("gd_create_order", [order()]))).total,
    810000,
  );
  await assert.rejects(
    as(alice, () =>
      rpc("gd_create_order", [order("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")]),
    ),
    /PRICE_CHANGED/,
  );
  assert.equal(
    (await db.query("select count(*)::integer n from public.gd_orders")).rows[0]
      .n,
    1,
  );
});
test("invalid dates, shipping, unknown products, duplicate lines, fractional quantity and disabled payments fail", async () => {
  for (const change of [
    { deliveryDate: "2026-02-30" },
    { deliveryTime: "any" },
    { shippingId: null },
    { items: [{ id: 999, quantity: 1 }] },
    {
      items: [
        { id: 1, quantity: 1 },
        { id: 1, quantity: 1 },
      ],
    },
    { items: [{ id: 1, quantity: 1.5 }] },
    { paymentMethod: "VIETQR" },
    { phone: "123" },
    { name: null },
    { consent: null },
  ])
    await assert.rejects(
      as(alice, () =>
        rpc("gd_create_order", [
          { ...order("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), ...change },
        ]),
      ),
    );
});
test("only admin can verify payments; optimistic versions and delivery transitions prevent stale or skipped updates", async () => {
  await assert.rejects(
    as(alice, () =>
      rpc("gd_update_order", [id, 1, "CONFIRMED", "PAID", "Bank verified"]),
    ),
    /ADMIN_REQUIRED/,
  );
  await assert.rejects(
    as(admin, () => rpc("gd_update_order", [id, 1, "DELIVERED", "UNPAID", ""])),
    /INVALID_TRANSITION/,
  );
  await assert.rejects(
    as(admin, () => rpc("gd_update_order", [id, 1, "CONFIRMED", "PAID", ""])),
    /PAYMENT_EVIDENCE_REQUIRED/,
  );
  await as(admin, () =>
    rpc("gd_update_order", [id, 1, "CONFIRMED", "UNPAID", "Đã gọi xác nhận"]),
  );
  await assert.rejects(
    as(admin, () => rpc("gd_update_order", [id, 1, "PREPARING", "UNPAID", ""])),
    /VERSION_CONFLICT/,
  );
  await as(admin, () =>
    rpc("gd_update_order", [id, 2, "PREPARING", "UNPAID", ""]),
  );
  await as(admin, () =>
    rpc("gd_update_order", [id, 3, "SHIPPING", "UNPAID", ""]),
  );
  await as(admin, () =>
    rpc("gd_update_order", [id, 4, "DELIVERED", "UNPAID", ""]),
  );
  assert.equal(
    (await db.query("select count(*)::integer n from public.gd_memories"))
      .rows[0].n,
    0,
  );
  await as(admin, () =>
    rpc("gd_update_order", [
      id,
      5,
      "DELIVERED",
      "PAID",
      "Đã kiểm tra tiền COD",
    ]),
  );
  await as(admin, () =>
    rpc("gd_update_order", [id, 6, "DELIVERED", "PAID", "Đã kiểm tra lại"]),
  );
  assert.equal(
    (await db.query("select count(*)::integer n from public.gd_memories"))
      .rows[0].n,
    1,
  );
});
test("memories default private, copy the exact card only after opt-in, links omit PII, listing/revocation work", async () => {
  const memory = (
    await as(alice, () => db.query("select * from public.gd_memories"))
  ).rows[0];
  assert.equal(memory.share_token, null);
  assert.equal(memory.message, "");
  assert.deepEqual(
    await as(null, () => rpc("gd_garden", [null, null, 24])),
    [],
  );
  await assert.rejects(
    as(bob, () => rpc("gd_share_memory", [memory.id, "GARDEN", "Someone"])),
    /NOT_FOUND/,
  );
  const shared = await as(alice, () =>
    rpc("gd_share_memory", [memory.id, "LINK", "Con"]),
  );
  const page = await as(null, () =>
    rpc("gd_public_memory", [shared.share_token]),
  );
  assert.equal(page.message, order().message);
  assert.deepEqual(
    Object.keys(page).sort(),
    [
      "createdAt",
      "flowerImage",
      "flowerName",
      "message",
      "signature",
      "token",
    ].sort(),
  );
  assert.deepEqual(
    await as(null, () => rpc("gd_garden", [null, null, 24])),
    [],
  );
  await as(alice, () => rpc("gd_share_memory", [memory.id, "GARDEN", "Con"]));
  assert.equal(
    (await as(null, () => rpc("gd_garden", [null, null, 24]))).length,
    1,
  );
  await as(alice, () => rpc("gd_share_memory", [memory.id, "PRIVATE", ""]));
  assert.equal(
    await as(null, () => rpc("gd_public_memory", [shared.share_token])),
    null,
  );
  const republished = await as(alice, () =>
    rpc("gd_share_memory", [memory.id, "GARDEN", ""]),
  );
  assert.notEqual(republished.share_token, shared.share_token);
  await as(admin, () =>
    rpc("gd_update_order", [
      id,
      7,
      "DELIVERED",
      "REFUNDED",
      "Đã hoàn tiền bên ngoài",
    ]),
  );
  assert.equal(
    await as(null, () => rpc("gd_public_memory", [republished.share_token])),
    null,
  );
  await assert.rejects(
    as(alice, () => rpc("gd_share_memory", [memory.id, "GARDEN", ""])),
    /MEMORY_UNAVAILABLE/,
  );
});
test("retention removes delivery PII while keeping the private card/history; customers cannot run retention", async () => {
  await db.exec(
    "update public.gd_orders set updated_at=now()-interval '91 days'",
  );
  await assert.rejects(
    as(alice, () => rpc("gd_expire_contacts", [])),
    /permission denied/,
  );
  assert.equal(await rpc("gd_expire_contacts", []), 1);
  const old = (
    await as(alice, () => db.query("select * from public.gd_orders"))
  ).rows[0];
  assert.equal(old.address, null);
  assert.equal(old.recipient_phone, null);
  assert.equal(old.recipient_name, null);
  assert.equal(old.card_message, order().message);
  assert.equal(old.request_body.hash.length, 64);
});

test("admin audit is private, config validates bank details and missing versions cannot overwrite", async () => {
  const current = (
    await db.query("select * from public.gd_orders where id=$1", [id])
  ).rows[0];
  await assert.rejects(
    as(admin, () =>
      rpc("gd_update_order", [
        id,
        null,
        current.status,
        current.payment_status,
        "",
      ]),
    ),
    /VERSION_CONFLICT/,
  );
  await assert.rejects(
    as(admin, () => db.exec("update public.gd_shop set transfer_enabled=true")),
    /check constraint/,
  );
  await as(admin, () =>
    db.exec("update public.gd_shop set about='Cấu hình đã cập nhật'"),
  );
  assert.equal(
    (await as(alice, () => db.query("select * from public.gd_admin_audit")))
      .rows.length,
    0,
  );
  const audit = (
    await as(admin, () =>
      db.query(
        "select * from public.gd_admin_audit where actor_id=$1 order by id desc limit 1",
        [admin],
      ),
    )
  ).rows[0];
  assert.equal(audit.after_data.about, "Cấu hình đã cập nhật");
  assert.notEqual(audit.before_data.about, audit.after_data.about);
  await assert.rejects(
    as(alice, () =>
      db.exec(
        "insert into public.gd_admin_audit(entity,entity_id,action) values('shop','1','UPDATE')",
      ),
    ),
    /permission denied/,
  );
});
test("order rate limit blocks new requests while allowing an idempotent retry", async () => {
  const price = (
    await db.query("select price from public.gd_products where id=1")
  ).rows[0].price;
  let first;
  for (let n = 0; n < 5; n++) {
    const request = {
      ...order(randomUUID()),
      expectedTotal: price * 2 + 30000,
    };
    if (!first) first = request;
    await as(bob, () => rpc("gd_create_order", [request]));
  }
  assert.equal(
    (await as(bob, () => rpc("gd_create_order", [first]))).id,
    first.requestId,
  );
  await assert.rejects(
    as(bob, () =>
      rpc("gd_create_order", [
        { ...order(randomUUID()), expectedTotal: price * 2 + 30000 },
      ]),
    ),
    /ORDER_RATE_LIMIT/,
  );
});
