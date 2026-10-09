import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

let production, staging;
const alice = "11111111-1111-4111-8111-111111111111",
  admin = "33333333-3333-4333-8333-333333333333";
const stagingInit = await readFile(
  new URL("../supabase/staging-init.sql", import.meta.url),
  "utf8",
);
const stagingSetup = await readFile(
  new URL("../supabase/staging-setup.sql", import.meta.url),
  "utf8",
);
const migrations = await Promise.all(
  (await readdir(new URL("../supabase/migrations/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) =>
      readFile(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8"),
    ),
);
async function fixture(isStaging) {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  if (isStaging) await db.exec(stagingSetup);
  else for (const sql of migrations) await db.exec(sql);
  await db.query("insert into auth.users values($1),($2)", [alice, admin]);
  await db.query("insert into public.gd_admins values($1)", [admin]);
  await db.exec(
    "update public.gd_shop set accepting_orders=true; update public.gd_shipping set active=true,fee=30000;",
  );
  return db;
}
before(async () => {
  production = await fixture(false);
  staging = await fixture(true);
});
after(async () => {
  await production?.close();
  await staging?.close();
});
async function as(db, user, fn) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const rpc = async (db, name, args = []) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
      args,
    )
  ).rows[0].value;
async function placed(db) {
  const shipping = (await db.query("select id from public.gd_shipping")).rows[0]
    .id;
  return as(db, alice, () =>
    rpc(db, "gd_create_order", [
      {
        requestId: randomUUID(),
        name: "Khách thử",
        phone: "0900000000",
        address: "Địa chỉ giả để kiểm thử",
        deliveryDate: new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 10),
        deliveryTime: "Chiều · 13–17h",
        message: "Kỉ niệm kiểm thử",
        consent: true,
        items: [{ id: 1, quantity: 1 }],
        shippingId: shipping,
        paymentMethod: "COD",
        expectedTotal: 420000,
        is_test: false,
      },
    ]),
  );
}
async function finish(db, order) {
  for (const status of ["CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED"])
    order = await as(db, admin, () =>
      rpc(db, "gd_update_order", [
        order.id,
        order.version,
        status,
        status === "DELIVERED" ? "PAID" : "UNPAID",
        "Đối soát giả trong database nhúng",
      ]),
    );
  return order;
}

test("runtime is public metadata, owner-only configuration, and staging init refuses an existing production account", async () => {
  assert.deepEqual(
    await as(production, null, () => rpc(production, "gd_environment")),
    { environment: "production", projectRef: "ztzpipgptticvliotbsc", features: { productAlbum: true, productImageUpload: false } },
  );
  assert.deepEqual(
    await as(staging, null, () => rpc(staging, "gd_environment")),
    { environment: "staging", projectRef: "tgvozhrkolcpszyyrgth", features: { productAlbum: true, productImageUpload: false } },
  );
  await assert.rejects(
    production.exec(stagingInit),
    /STAGING_REQUIRES_EMPTY_PROJECT/,
  );
  await production.exec("rollback");
  await assert.rejects(
    production.exec(stagingSetup),
    /STAGING_SETUP_REQUIRES_EMPTY_PROJECT/,
  );
  await staging.exec(stagingInit); // idempotent after installing a staging project
  for (const user of [null, alice, admin])
    await assert.rejects(
      as(staging, user, () =>
        staging.exec("update gd_private.runtime set environment='production'"),
      ),
      /permission denied/,
    );
});
test("staging orders and memories are server-classified, immutable and excluded from actual sales/counts", async () => {
  const order = await placed(staging);
  assert.equal(order.is_test, true);
  await assert.rejects(
    as(staging, alice, () =>
      staging.query("update public.gd_orders set is_test=false where id=$1", [
        order.id,
      ]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    staging.query("update public.gd_orders set is_test=false where id=$1", [
      order.id,
    ]),
    /ORDER_KIND_IMMUTABLE/,
  );
  await finish(staging, order);
  const memory = (
    await staging.query("select * from public.gd_memories where order_id=$1", [
      order.id,
    ])
  ).rows[0];
  assert.equal(memory.is_test, true);
  assert.equal(
    (
      await staging.query(
        "select count(*) n from public.gd_memories where order_id=$1",
        [order.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await staging.query("select count(*) n from gd_private.real_orders"))
      .rows[0].n,
    0,
  );
  assert.equal(
    Number(await as(staging, null, () => rpc(staging, "gd_memory_count"))),
    0,
  );
  const shared = await as(staging, alice, () =>
    rpc(staging, "gd_share_memory", [memory.id, "GARDEN", ""]),
  );
  assert.equal(
    (
      await as(staging, null, () =>
        rpc(staging, "gd_public_memory", [shared.share_token]),
      )
    ).message,
    "Kỉ niệm kiểm thử",
  );
  assert.equal(
    (await as(staging, null, () => rpc(staging, "gd_garden", [null, null, 24])))
      .length,
    1,
  );
  await assert.rejects(
    staging.query("update public.gd_memories set is_test=false where id=$1", [
      memory.id,
    ]),
    /MEMORY_KIND_IMMUTABLE/,
  );
  await assert.rejects(
    staging.exec(
      "update gd_private.runtime set environment='production',project_ref='ztzpipgptticvliotbsc'",
    ),
    /ENVIRONMENT_LOCKED/,
  );
  await assert.rejects(
    staging.exec("delete from gd_private.runtime"),
    /ENVIRONMENT_LOCKED/,
  );
});
test("the additive migration keeps the real order and one-memory path intact", async () => {
  const order = await placed(production);
  assert.equal(order.is_test, false);
  await finish(production, order);
  assert.equal(
    (await production.query("select count(*) n from gd_private.real_orders"))
      .rows[0].n,
    1,
  );
  assert.equal(
    Number(
      await as(production, null, () => rpc(production, "gd_memory_count")),
    ),
    1,
  );
  const memory = (
    await production.query(
      "select * from public.gd_memories where order_id=$1",
      [order.id],
    )
  ).rows[0];
  assert.equal(memory.is_test, false);
  assert.equal(memory.share_token, null);
});
