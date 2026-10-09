import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

// Local synthetic data only; this drill never connects to a Supabase project.
test("a disk backup restores orders, memories, permissions and retention without changing active orders", async () => {
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  const admin = "33333333-3333-4333-8333-333333333333";
  const started = performance.now();
  let db = new PGlite();
  const as = async (user, operation) => {
    await db.exec(`set role ${user ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user || "",
    ]);
    try {
      return await operation();
    } finally {
      await db.exec("reset role");
    }
  };
  const rpc = async (name, args = []) =>
    (
      await db.query(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
        args,
      )
    ).rows[0].value;
  const counts = async () =>
    (
      await db.query(`select
    (select count(*)::int from public.gd_orders) orders,
    (select count(*)::int from public.gd_memories) memories,
    (select count(*)::int from public.gd_order_events) events,
    (select count(*)::int from public.gd_admin_audit) audit,
    (select count(*)::int from public.gd_products) products`)
    ).rows[0];
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    const migrationFiles = (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles)
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "update gd_private.runtime set environment='local',project_ref=null;",
    );
    await db.query("insert into auth.users values($1),($2),($3)", [
      alice,
      bob,
      admin,
    ]);
    await db.query("insert into public.gd_admins values($1)", [admin]);
    await as(admin, () =>
      db.exec(
        "update public.gd_shop set accepting_orders=true; update public.gd_shipping set active=true,fee=30000",
      ),
    );
    const shippingId = (await db.query("select id from public.gd_shipping"))
      .rows[0].id;
    const orders = [];
    for (let i = 0; i < 6; i++) {
      let order = await as(alice, () =>
        rpc("gd_create_order", [
          {
            requestId: randomUUID(),
            name: "Khách giả để thử phục hồi",
            phone: "0900000000",
            address: "Địa chỉ giả, không phải địa chỉ khách",
            deliveryDate: new Date(Date.now() + 86400000)
              .toISOString()
              .slice(0, 10),
            deliveryTime: "Chiều · 13–17h",
            message: "Lời nhắn giả được giữ sau phục hồi.",
            consent: true,
            items: [{ id: 1, quantity: 1 }],
            shippingId,
            paymentMethod: "COD",
            expectedTotal: 420000,
          },
        ]),
      );
      if ([0, 2, 5].includes(i)) {
        for (const status of [
          "CONFIRMED",
          "PREPARING",
          "SHIPPING",
          "DELIVERED",
        ])
          order = await as(admin, () =>
            rpc("gd_update_order", [
              order.id,
              order.version,
              status,
              status === "DELIVERED" ? "PAID" : "UNPAID",
              "Đối soát giả trong kiểm thử",
            ]),
          );
      } else if ([1, 4].includes(i))
        order = await as(admin, () =>
          rpc("gd_update_order", [
            order.id,
            order.version,
            "CANCELLED",
            "UNPAID",
            "Hủy đơn giả để thử",
          ]),
        );
      await db.query(
        "update public.gd_orders set created_at=now()-interval '11 minutes' where id=$1",
        [order.id],
      );
      orders.push(order);
    }
    const memory = (
      await db.query("select id from public.gd_memories where order_id=$1", [
        orders[0].id,
      ])
    ).rows[0];
    const shared = await as(alice, () =>
      rpc("gd_share_memory", [memory.id, "GARDEN", "Người thử"]),
    );
    await db.query(
      "update public.gd_orders set updated_at=now()-interval '91 days' where id=any($1::uuid[])",
      [[orders[0].id, orders[1].id, orders[3].id, orders[4].id]],
    );
    await db.query(
      "update public.gd_orders set updated_at=now()-interval '89 days' where id=$1",
      [orders[2].id],
    );
    await db.query(
      "update public.gd_orders set recipient_name=null,recipient_phone=null,address=null,contacts_erased_at=now()-interval '1 day' where id=$1",
      [orders[4].id],
    );
    const expectedCounts = await counts();
    const expectedOrders = (
      await db.query("select * from public.gd_orders order by id")
    ).rows;
    const expectedGarden = await as(null, () => rpc("gd_garden"));

    const archive = Buffer.from(
      await (await db.dumpDataDir("gzip")).arrayBuffer(),
    );
    const digest = createHash("sha256").update(archive).digest("hex");
    const archiveDirectory = new URL("../.backups/", import.meta.url);
    await mkdir(archiveDirectory, { recursive: true });
    const archiveFile = new URL(
      `local-drill-${randomUUID()}.tar.gz`,
      archiveDirectory,
    );
    await writeFile(archiveFile, archive, { flag: "wx", mode: 0o600 });
    await db.close();
    const onDisk = await readFile(archiveFile);
    assert.equal(createHash("sha256").update(onDisk).digest("hex"), digest);
    db = new PGlite({ loadDataDir: new Blob([onDisk]) });
    assert.deepEqual(await rpc("gd_environment"), {
      environment: "local",
      projectRef: null,
    });
    assert.deepEqual(await counts(), expectedCounts);
    assert.deepEqual(
      (await db.query("select * from public.gd_orders order by id")).rows,
      expectedOrders,
    );
    assert.deepEqual(await as(null, () => rpc("gd_garden")), expectedGarden);
    assert.equal(
      (await as(null, () => rpc("gd_public_memory", [shared.share_token])))
        .message,
      "Lời nhắn giả được giữ sau phục hồi.",
    );
    assert.equal(Number(await rpc("gd_memory_count")), 0);
    await assert.rejects(
      as(null, () => db.query("select * from public.gd_orders")),
      /permission denied/,
    );
    assert.equal(
      (await as(bob, () => db.query("select * from public.gd_orders"))).rows
        .length,
      0,
    );
    assert.equal(
      (await as(alice, () => db.query("select * from public.gd_orders"))).rows
        .length,
      6,
    );
    await assert.rejects(
      as(alice, () =>
        db.exec("update public.gd_orders set payment_status='PAID'"),
      ),
      /permission denied/,
    );
    for (const user of [null, alice, admin])
      await assert.rejects(
        as(user, () => rpc("gd_expire_contacts")),
        /permission denied/,
      );

    await db.exec("begin");
    // Use the transaction clock to test the exact cutoff without wall-clock drift.
    await db.query(
      "update public.gd_orders set updated_at=now()-interval '90 days' where id=$1",
      [orders[5].id],
    );
    const alreadyErased = (
      await db.query(
        "select contacts_erased_at from public.gd_orders where id=$1",
        [orders[4].id],
      )
    ).rows[0].contacts_erased_at;
    assert.equal(Number(await rpc("gd_expire_contacts")), 2);
    assert.equal(Number(await rpc("gd_expire_contacts")), 0);
    const retained = (await db.query("select * from public.gd_orders")).rows;
    for (const i of [0, 1]) {
      const order = retained.find((row) => row.id === orders[i].id);
      for (const key of ["recipient_name", "recipient_phone", "address"])
        assert.equal(order[key], null);
      assert.ok(order.contacts_erased_at);
      assert.equal(order.card_message, "Lời nhắn giả được giữ sau phục hồi.");
      assert.equal(order.request_body.hash.length, 64);
    }
    for (const i of [2, 3, 5]) {
      const order = retained.find((row) => row.id === orders[i].id);
      assert.ok(order.recipient_name && order.recipient_phone && order.address);
      assert.equal(order.contacts_erased_at, null);
    }
    assert.deepEqual(
      retained.find((row) => row.id === orders[4].id).contacts_erased_at,
      alreadyErased,
    );
    assert.deepEqual(await counts(), expectedCounts);
    assert.deepEqual(await as(null, () => rpc("gd_garden")), expectedGarden);
    await db.exec("commit");
    const report = {
      checkedAt: new Date().toISOString(),
      environment: "local",
      data: "synthetic-only",
      engine: "PGlite 0.5.8",
      migrationFiles,
      counts: expectedCounts,
      archiveBytes: archive.length,
      sha256: digest,
      elapsedMs: Math.round(performance.now() - started),
      passed: [
        "disk-checksum",
        "new-database-restore",
        "order-snapshots",
        "memory-sharing",
        "rls-owner-isolation",
        "payment-permissions",
        "retention-permissions",
        "retention-90-day-boundary",
        "retention-active-order-protection",
        "retention-idempotency",
        "card-and-history-preservation",
      ],
      notChecked: [
        "hosted-backup-and-restore",
        "supabase-auth-sessions",
        "storage-objects",
        "live-cron-history",
      ],
    };
    await writeFile(
      new URL("latest-drill-report.json", archiveDirectory),
      JSON.stringify(report, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log(JSON.stringify(report));
  } finally {
    await db.close();
  }
});
