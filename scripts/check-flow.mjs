import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const client = () =>
  createClient("http://127.0.0.1:54321", "sb_publishable_local_test_only", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const ok = async (operation) => {
  const { data, error } = await operation;
  if (error) throw error;
  return data;
};
const alice = client(),
  bob = client(),
  admin = client(),
  anonymous = client();
assert.deepEqual(await ok(anonymous.rpc("gd_environment")), {
  environment: "local",
  projectRef: null,
  features: { productAlbum: true, productImageUpload: false, productVariants: true, variantOrders: true },
});
for (const [c, email] of [
  [alice, "alice@example.test"],
  [bob, "bob@example.test"],
  [admin, "admin@example.test"],
])
  await ok(
    c.auth.signInWithPassword({ email, password: "Garden-test-only-2026" }),
  );
const shop = await ok(
  anonymous.from("gd_shop").select("*").eq("id", 1).single(),
);
const catalog = await ok(anonymous.from("gd_products").select("*").order("id"));
const shipping = await ok(
  anonymous.from("gd_shipping").select("*").order("name"),
);
const size = await ok(admin.from("gd_product_variants").insert({ product_id: catalog[0].id,
  sku: "SDK-L", size_name: "Bó lớn thử", price: 690000, active: true }).select("*").single());
assert.equal((await ok(anonymous.from("gd_product_variants").select("*").eq("id", size.id).single())).price, 690000);
const id = randomUUID(),
  message = "Cảm ơn mẹ vì luôn chờ con về.\nCon thương mẹ.";
const request = {
  requestId: id,
  name: "Người nhận giả",
  phone: "0900000000",
  address: "Địa chỉ giả, không giao hàng",
  deliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  deliveryTime: "Chiều · 13–17h",
  message,
  consent: true,
  items: [{ id: catalog[0].id, quantity: 1 }],
  shippingId: shipping[0].id,
  paymentMethod: "VIETQR",
  expectedTotal: catalog[0].price + shipping[0].fee,
};
let order = await ok(alice.rpc("gd_create_order", { p_request: request }));
assert.equal(order.is_test, true);
assert.equal(order.total, request.expectedTotal);
assert.equal(order.bank.account, shop.bank_account);
const sizedRequest = { ...request, requestId: randomUUID(), expectedTotal: 2 * size.price + catalog[0].price + shipping[0].fee,
  items: [{ id: catalog[0].id, variantId: size.id, quantity: 2, price: 1 }, { id: catalog[0].id, quantity: 1 }] };
const sizedOrder = await ok(alice.rpc("gd_create_order", { p_request: sizedRequest }));
assert.equal(sizedOrder.items[0].price, size.price);
assert.equal(sizedOrder.items[0].sizeName, size.size_name);
assert.equal(sizedOrder.items[0].sku, size.sku);
const changedSize = await ok(admin.from("gd_product_variants").update({ price: 790000, active: false })
  .eq("id", size.id).eq("version", size.version).select("*").single());
assert.ok(changedSize.version > size.version);
assert.equal((await ok(anonymous.from("gd_product_variants").select("*").eq("id", size.id))).length, 0);
assert.deepEqual((await ok(alice.rpc("gd_create_order", { p_request: sizedRequest }))).items, sizedOrder.items);
assert.match((await alice.rpc("gd_create_order", { p_request: { ...sizedRequest, requestId: randomUUID() } })).error.message, /VARIANT_UNAVAILABLE/);
const album = ["/flowers/bouquet_2.webp", catalog[0].image];
const albumProduct = await ok(admin.from("gd_products").update({ images: album })
  .eq("id", catalog[0].id).eq("version", catalog[0].version).select("*").single());
assert.deepEqual(albumProduct.images, album);
assert.equal(albumProduct.image, album[0]);
assert.ok(albumProduct.version > catalog[0].version);
assert.equal((await ok(anonymous.from("gd_products").select("image,images").eq("id", catalog[0].id).single())).image, album[0]);
assert.equal((await ok(alice.from("gd_orders").select("items").eq("id", id).single())).items[0].image, catalog[0].image);
const blockedAlbum = await alice.from("gd_products").update({ images: ["/flowers/bouquet_3.webp"] })
  .eq("id", catalog[0].id).select("*");
assert.ok(blockedAlbum.error || blockedAlbum.data.length === 0);
assert.deepEqual((await ok(anonymous.from("gd_products").select("images").eq("id", catalog[0].id).single())).images, album);
const staleAlbum = await ok(admin.from("gd_products").update({ images: [...album].reverse() })
  .eq("id", catalog[0].id).eq("version", catalog[0].version).select("*").maybeSingle());
assert.equal(staleAlbum, null);
assert.equal(
  (await ok(alice.rpc("gd_create_order", { p_request: request }))).id,
  id,
);
assert.equal(
  (await ok(bob.from("gd_orders").select("id").eq("id", id))).length,
  0,
);
assert.equal(
  (await ok(alice.from("gd_orders").select("id").eq("id", id))).length,
  1,
);
const denied = await alice.rpc("gd_update_order", {
  p_id: id,
  p_version: 1,
  p_status: "CONFIRMED",
  p_payment: "PAID",
  p_note: "Không được sửa",
});
assert.match(denied.error.message, /ADMIN_REQUIRED/);
for (const status of ["CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED"])
  order = await ok(
    admin.rpc("gd_update_order", {
      p_id: id,
      p_version: order.version,
      p_status: status,
      p_payment: status === "DELIVERED" ? "PAID" : "UNPAID",
      p_note:
        status === "DELIVERED" ? "Đã đối soát thử, KHÔNG chuyển tiền" : "",
    }),
  );
const events = await ok(
  alice
    .from("gd_order_events")
    .select("id,event,note,created_at")
    .eq("order_id", id)
    .order("id"),
);
assert.equal(events.length, 5);
const memory = await ok(
  alice.from("gd_memories").select("*").eq("order_id", id).maybeSingle(),
);
assert.equal(memory.share_token, null);
assert.equal(memory.is_test, true);
assert.equal(Number(await ok(anonymous.rpc("gd_memory_count"))), 0);
const link = await ok(
  alice.rpc("gd_share_memory", {
    p_id: memory.id,
    p_visibility: "LINK",
    p_signature: "Con",
  }),
);
const card = await ok(
  anonymous.rpc("gd_public_memory", { p_token: link.share_token }),
);
assert.equal(card.message, message);
assert.equal(card.signature, "Con");
assert.equal(card.address, undefined);
const gardenBefore = await ok(
  anonymous.rpc("gd_garden", {
    p_before: null,
    p_before_id: null,
    p_limit: 24,
  }),
);
assert.ok(!gardenBefore.some((m) => m.token === link.share_token));
await ok(
  alice.rpc("gd_share_memory", {
    p_id: memory.id,
    p_visibility: "GARDEN",
    p_signature: "Con",
  }),
);
assert.ok(
  (
    await ok(
      anonymous.rpc("gd_garden", {
        p_before: null,
        p_before_id: null,
        p_limit: 24,
      }),
    )
  ).some((m) => m.token === link.share_token),
);
await ok(
  alice.rpc("gd_share_memory", {
    p_id: memory.id,
    p_visibility: "PRIVATE",
    p_signature: "",
  }),
);
assert.equal(
  await ok(anonymous.rpc("gd_public_memory", { p_token: link.share_token })),
  null,
);
const item = await ok(
  admin
    .from("gd_products")
    .insert({
      name: "Bó hoa kiểm thử",
      occasion: "Sinh nhật",
      price: 500000,
      stems: "Hoa thử",
      description: "Dữ liệu giả",
      image: "/flowers/bouquet_1.webp",
      active: true,
      featured: false,
    })
    .select("*")
    .single(),
);
assert.ok(item.id > 20);
await ok(
  admin
    .from("gd_products")
    .update({ active: false })
    .eq("id", item.id)
    .eq("version", item.version)
    .select("*")
    .single(),
);
assert.equal(
  (await ok(anonymous.from("gd_products").select("*").eq("id", item.id)))
    .length,
  0,
);
const service = await ok(
  admin
    .from("gd_shipping")
    .insert({
      name: "Dịch vụ thử",
      area: "Khu vực thử",
      fee: 40000,
      active: true,
    })
    .select("*")
    .single(),
);
assert.equal(service.fee, 40000);
const updated = await ok(
  admin
    .from("gd_shop")
    .update({ about: "Thông tin được admin cập nhật" })
    .eq("id", 1)
    .eq("version", shop.version)
    .select("*")
    .single(),
);
assert.ok(updated.version > shop.version);
assert.equal((await ok(alice.from("gd_admin_audit").select("id"))).length, 0);
assert.ok((await ok(admin.from("gd_admin_audit").select("id"))).length > 0);
for (const c of [alice, bob, admin]) await c.auth.signOut();
console.log(
  "SDK integration passed: sign-in, dynamic catalog, album/size/version isolation, server-priced sizes and snapshot-preserving retries, order/ship/bank snapshots, tracking, admin payment, exact card sharing, revoke, RLS, product/shipping/shop edits and audit. Synthetic local data only; Storage file API is not simulated.",
);
