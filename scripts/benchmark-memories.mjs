// Isolated in-memory database only; never connects to a Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
const db = new PGlite();
try {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select null::uuid$$; insert into auth.users values('11111111-1111-4111-8111-111111111111');`,
  );
  for (const file of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    "update gd_private.runtime set environment='local',project_ref=null;",
  );
  // This benchmark measures memory storage and pagination, excluding order storage.
  await db.exec(
    "alter table public.gd_memories drop constraint gd_memories_order_id_fkey;",
  );
  const started = performance.now();
  for (let start = 1; start <= 1000000; start += 100000) {
    await db.query(
      `insert into public.gd_memories(id,order_id,owner_id,message,signature,flower_name,flower_image,share_token,listed,created_at)
      select md5('memory'||n)::uuid,md5('order'||n)::uuid,'11111111-1111-4111-8111-111111111111'::uuid,'Cảm ơn vì đã ở bên nhau.','Một người thương','Hoa hồng','/flowers/bouquet_1.webp',md5('token'||n)::uuid,true,timestamptz '2026-01-01 00:00:00+00'+n*interval '1 microsecond' from generate_series($1::int,$2::int) n`,
      [start, start + 99999],
    );
    console.log(`Seeded ${start + 99999} synthetic memories`);
  }
  await db.exec("analyze public.gd_memories;");
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from public.gd_memories where is_test",
        )
      ).rows[0].n,
    ),
    1000000,
  );
  assert.equal(
    Number((await db.query("select public.gd_memory_count() n")).rows[0].n),
    0,
  );
  const first = (await db.query("select public.gd_garden(null,null,24) page"))
    .rows[0].page;
  assert.equal(first.length, 24);
  const last = first.at(-1),
    queryStart = performance.now();
  const second = (
    await db.query("select public.gd_garden($1,$2,24) page", [
      last.createdAt,
      last.id,
    ])
  ).rows[0].page;
  const pageMs = performance.now() - queryStart;
  assert.equal(second.length, 24);
  assert.ok(second.every((m) => !first.some((p) => p.id === m.id)));
  assert.equal(
    (
      await db.query("select public.gd_public_memory($1) card", [
        first[0].token,
      ])
    ).rows[0].card.message,
    first[0].message,
  );
  const plan = (
    await db.query(
      "explain (analyze,buffers) select * from public.gd_memories where listed and not revoked and (created_at,id)<($1,$2) order by created_at desc,id desc limit 24",
      [last.createdAt, last.id],
    )
  ).rows
    .map((r) => r["QUERY PLAN"])
    .join("\n");
  assert.match(plan, /Index Scan using gd_memories_garden_cursor/);
  const bytes = Number(
    (
      await db.query(
        "select pg_total_relation_size('public.gd_memories') bytes",
      )
    ).rows[0].bytes,
  );
  const report = {
    rows: 1000000,
    totalSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
    pageSize: 24,
    secondPageMs: Number(pageMs.toFixed(2)),
    tableAndIndexBytes: bytes,
    plan,
    scope:
      "Local PGlite, short synthetic messages, actual schema/index/RPC; excludes orders, Auth, network, concurrency and Supabase Free capacity.",
  };
  await mkdir(new URL("../benchmarks/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../benchmarks/memories.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.close();
}
