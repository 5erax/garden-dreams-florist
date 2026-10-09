import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("product albums restrict URLs and writers; Storage permits immutable admin uploads only", async () => {
  const db = new PGlite();
  const admin = "33333333-3333-4333-8333-333333333333";
  const customer = "11111111-1111-4111-8111-111111111111";
  const path = `products/${admin}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;
  const url = `https://ztzpipgptticvliotbsc.supabase.co/storage/v1/object/public/gd-product-images/${path}`;
  const as = async (user, fn) => {
    await db.exec(`set role ${user ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated;
      grant select,insert,update,delete on storage.objects to anon,authenticated;`);
    for (const file of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort())
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    await db.query("insert into auth.users values($1),($2)", [admin, customer]);
    await db.query("insert into gd_admins values($1)", [admin]);
    assert.deepEqual((await as(null, () => db.query("select gd_environment() value"))).rows[0].value.features,
      { productAlbum: true, productImageUpload: true, productVariants: true, variantOrders: true, deliveryCalendar: true });
    assert.deepEqual((await db.query("select file_size_limit,allowed_mime_types,public from storage.buckets")).rows[0],
      { file_size_limit: 2097152, allowed_mime_types: ["image/webp"], public: true });
    const original = (await db.query("select image from gd_products where id=1")).rows[0].image;
    await db.exec("update gd_shop set accepting_orders=true; update gd_shipping set active=true");
    const shipping = (await db.query("select id from gd_shipping")).rows[0].id;
    const order = (await as(customer, () => db.query("select gd_create_order($1::jsonb) value", [JSON.stringify({
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Khách thử", phone: "0900000000", address: "Địa chỉ kiểm thử giả",
      deliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), deliveryTime: "Chiều · 13–17h",
      message: "Thiệp kiểm thử", consent: true, items: [{ id: 1, quantity: 1 }], shippingId: shipping,
      paymentMethod: "COD", expectedTotal: 390000,
    })]))).rows[0].value;
    for (const user of [null, customer]) {
      await assert.rejects(as(user, () => db.query("insert into storage.objects values('gd-product-images',$1)", [path])), /row-level security/);
      await as(user, async () => {
        try { await db.query("update gd_products set images=$1 where id=1", [[url]]); }
        catch (error) { assert.match(error.message, /permission denied/); }
      });
      assert.equal((await db.query("select image from gd_products where id=1")).rows[0].image, original);
    }
    await as(admin, () => db.query("insert into storage.objects values('gd-product-images',$1)", [path]));
    for (const [bucket, name] of [["other", path], ["gd-product-images", path.replace(admin, customer)],
      ["gd-product-images", path.replace(".webp", ".svg")], ["gd-product-images", `../${path}`]])
      await assert.rejects(as(admin, () => db.query("insert into storage.objects values($1,$2)", [bucket, name])), /row-level security/);
    assert.equal((await as(customer, () => db.query("select * from storage.objects"))).rows.length, 0);
    assert.equal((await as(admin, () => db.query("select * from storage.objects"))).rows.length, 1);
    assert.equal((await as(admin, () => db.query("delete from storage.objects returning *"))).rows.length, 0);
    assert.equal((await as(admin, () => db.query("update storage.objects set name='overwrite' returning *"))).rows.length, 0);
    for (const images of [[null], [url, url], Array.from({ length: 9 }, (_, i) => `/flowers/test_${i}.webp`), ["https://evil.test/image.webp"],
      [url.replace("ztzpipgptticvliotbsc", "tgvozhrkolcpszyyrgth")], [url + "?token=private"], [[original]]])
      await assert.rejects(as(admin, () => db.query("update gd_products set images=$1 where id=1", [images])), /INVALID_PRODUCT_IMAGES/);
    await as(admin, () => db.query("update gd_products set images=$1 where id=1", [[url, original]]));
    assert.equal((await as(customer, () => db.query("select items from gd_orders where id=$1", [order.id]))).rows[0].items[0].image, original);
    assert.equal((await as(null, () => db.query("select image from gd_products where id=1"))).rows[0].image, url);
    await as(admin, () => db.query("update gd_products set images=$1 where id=1", [[original, url]]));
    assert.equal((await db.query("select image from gd_products where id=1")).rows[0].image, original);
    await as(admin, () => db.exec("update gd_products set images='{}' where id=1"));
    assert.equal((await db.query("select image from gd_products where id=1")).rows[0].image, original);
    await assert.rejects(as(admin, () => db.exec("update gd_products set images='[0:0]={/flowers/a.webp}' where id=1")), /INVALID_PRODUCT_IMAGES/);
  } finally { await db.close(); }
});

test("migration refuses a conflicting private bucket without exposing it or changing the catalog", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      insert into storage.buckets values('gd-product-images','gd-product-images',false,2097152,array['image/webp']);`);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const albumFile = "202610090006_product_albums.sql";
    const files = (await readdir(directory)).filter(f => f.endsWith(".sql") && f < albumFile).sort();
    for (const file of files) await db.exec(await readFile(new URL(file, directory), "utf8"));
    await assert.rejects(db.exec(await readFile(new URL(albumFile, directory), "utf8")), /PRODUCT_BUCKET_CONFIG_CONFLICT/);
    await db.exec("rollback");
    assert.equal((await db.query("select public from storage.buckets where id='gd-product-images'")).rows[0].public, false);
    assert.equal((await db.query("select count(*) n from information_schema.columns where table_schema='public' and table_name='gd_products' and column_name='images'")).rows[0].n, 0);
    assert.deepEqual((await db.query("select gd_environment() value")).rows[0].value, { environment: "production", projectRef: "ztzpipgptticvliotbsc" });
  } finally { await db.close(); }
});
