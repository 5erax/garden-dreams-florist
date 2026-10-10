import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { products } from "../src/catalog.js";

let server, Checkout, BankPayment, DeliveryPicker, selectedDelivery, ReorderFlowers;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../",import.meta.url)),configFile:false,envDir:false,
    cacheDir:fileURLToPath(new URL("../node_modules/.vite/tests/checkout-dialog",import.meta.url)),
    plugins:[{
      name:"checkout-test-store",enforce:"pre",
      load(id) { if (id.replaceAll('\\','/').endsWith('/src/Store.jsx')) return "export const useStore = () => globalThis.checkoutTestStore;"; },
    },react()],
    define:{"import.meta.env.VITE_SUPABASE_URL":'""',"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":'""'},
    server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  });
  ({default:Checkout}=await server.ssrLoadModule('/src/LiveCheckout.jsx'));
  ({BankPayment}=await server.ssrLoadModule('/src/OrderDetail.jsx'));
  ({default:DeliveryPicker,selectedDelivery}=await server.ssrLoadModule('/src/DeliveryPicker.jsx'));
  ({default:ReorderFlowers}=await server.ssrLoadModule('/src/ReorderFlowers.jsx'));
});
after(async () => { delete globalThis.checkoutTestStore; await server?.close(); });
function render(store, pending = {current:null}) {
  globalThis.checkoutTestStore = {
    shop:{name:"Garden Dreams",phone:"0832345780",cod_enabled:true,accepting_orders:true},
    products,shipping:[{id:"shipping",name:"Long Thành",fee:0,area:"Long Thành"}],
    session:{user:{id:"alice"}},loading:false,error:"",...store,
  };
  return renderToStaticMarkup(createElement(Checkout,{cart:[{id:1,quantity:1}],pending,onClose(){},onComplete(){}}));
}
test("closed checkout offers the real shop contact before requesting customer signup", () => {
  const html=render({shop:{name:"Garden Dreams",phone:"0832345780",accepting_orders:false},session:null,shipping:[]});
  assert.match(html,/tel:0832345780/);
  assert.match(html,/zalo.me\/0832345780/);
  assert.match(html,/665L/);
  assert.match(html,/chưa có đơn nào được gửi/);
  assert.doesNotMatch(html,/name="email"/);
  assert.doesNotMatch(html,/name="address"/);
});
test("reopened pending request retains recipient/message, freezes editing and offers a safe retry", () => {
  const html=render({}, {current:{ownerId:"alice",request:{requestId:"original",name:"Khách thử",phone:"0900000000",address:"Địa chỉ giả",message:"Lời riêng tư",consent:true,deliveryDate:"2026-10-10",expectedTotal:420000}}});
  assert.match(html,/Thử lại yêu cầu vừa gửi/);
  assert.match(html,/<form hidden=""/);
  assert.match(html,/value="Khách thử"/);
  assert.match(html,/Lời riêng tư<\/textarea>/);
  assert.match(html,/Kiểm tra lịch sử mua/);
});
test("another customer's pending contact is not rendered into the form", () => {
  const html=render({session:{user:{id:"bob"}}},{current:{ownerId:"alice",request:{name:"SECRET ALICE",address:"SECRET ADDRESS",message:"SECRET MESSAGE"}}});
  assert.doesNotMatch(html,/SECRET/);
  assert.doesNotMatch(html,/Thử lại yêu cầu vừa gửi/);
  assert.doesNotMatch(html,/<form hidden=""/);
});
test("checkout puts delivery before recipient and shows the final total in one form", () => {
  const html=render({});
  assert.ok(html.indexOf('name="deliveryDate"') < html.indexOf('name="name"'));
  assert.match(html,/checkout-layout/);
  assert.match(html,/aria-label="Kiểm tra đơn hoa"/);
  assert.match(html,/Đặt hoa ·/);
  assert.match(html,/<input(?=[^>]*name="consent")(?=[^>]*required)[^>]*>/);
  assert.equal((html.match(/name="deliveryDate"/g) || []).length,1);
});
test("guest checkout is available only when the provider actually enables it", () => {
  const available=render({session:null,guestEnabled:true});
  assert.match(available,/Không cần tạo tài khoản/);
  assert.doesNotMatch(available,/name="email"/);
  const unavailable=render({session:null,connected:true,guestEnabled:false});
  assert.match(unavailable,/name="email"/);
  assert.doesNotMatch(unavailable,/Không cần tạo tài khoản/);
});

test("checkout distinguishes waiting from a completed empty delivery catalog",()=>{
  const waiting=render({session:null,loading:true,shipping:[]});
  assert.match(waiting,/bloom-loader-flower/);
  assert.doesNotMatch(waiting,/Đang tải/);
  const empty=render({session:null,loading:false,shipping:[]});
  assert.match(empty,/Shop chưa có dịch vụ giao hoa/);
  assert.match(empty,/Kiểm tra lại/);
  assert.doesNotMatch(empty,/bloom-loader-flower/);
});
test("VietQR provides account/reference copy actions only for unpaid active bank orders", () => {
  const order = {payment_method:"VIETQR",payment_status:"UNPAID",status:"PENDING",total:390000,reference:"GD-FIXTURE",bank:{bankName:"MB Bank",account:"0832345780",accountName:"Hà Văn Phước"}};
  const renderBank = changes => renderToStaticMarkup(createElement(BankPayment,{order:{...order,...changes}}));
  assert.match(renderBank({}),/Sao chép số tài khoản/);
  assert.match(renderBank({}),/Sao chép nội dung/);
  assert.equal(renderBank({status:"CANCELLED"}), "");
  assert.equal(renderBank({payment_status:"PAID"}), "");
  assert.equal(renderBank({payment_method:"COD"}), "");
});
test("calendar checkout waits for a server choice; old backends retain their existing date/time flow", () => {
  const html=render({features:{deliveryCalendar:true}});
  assert.match(html,/type="submit" disabled=""/);
  assert.match(html,/name="deliveryDate"/);
  const legacy=renderToStaticMarkup(createElement(DeliveryPicker,{shippingId:"fixture",onReady(){}}));
  assert.match(legacy,/name="deliveryTime"/);
  assert.match(legacy,/Chiều · 13–17h/);
  assert.doesNotMatch(legacy,/<select[^>]*disabled/);
  assert.equal(selectedDelivery([{time:"morning",available:false},{time:"afternoon",available:true}],"morning"), "");
  assert.equal(selectedDelivery([{time:"afternoon",available:true}],"afternoon"), "afternoon");
});

function renderReorder(changes = {}, onReorder = () => {}) {
  globalThis.checkoutTestStore = { products, connected: true, loading: false, error: "", shop: { accepting_orders: true }, ...changes };
  return renderToStaticMarkup(createElement(ReorderFlowers, { cart: [], onReorder, order: {
    id: "history-order", recipient_name: "PRIVATE RECIPIENT", recipient_phone: "PRIVATE PHONE", address: "PRIVATE ADDRESS", card_message: "PRIVATE CARD",
    items: [{ id: 1, name: "OLD FLOWER", quantity: 1, price: 1 }],
  } }));
}
test("reorder preview uses current flowers and price without recovering contacts or private cards", () => {
  const html = renderReorder();
  assert.match(html, /Giá hiện tại/);
  assert.match(html, /Thêm hoa &amp; mở giỏ/);
  assert.doesNotMatch(html, /PRIVATE RECIPIENT|PRIVATE PHONE|PRIVATE ADDRESS|PRIVATE CARD|OLD FLOWER/);
  assert.doesNotMatch(html, /<button[^>]*disabled/);
});
test("reorder never enables additions with a stale catalog, disconnected backend or missing cart callback", () => {
  for (const changes of [{ connected: false }, { loading: true }, { error: "catalog failure" }]) {
    const html = renderReorder(changes);
    assert.doesNotMatch(html, /Thêm hoa &amp; mở giỏ/);
    assert.doesNotMatch(html, /Giá hiện tại/);
  }
  assert.match(renderReorder({}, null), /<button[^>]*disabled/);
  assert.match(renderReorder({ products: [] }), /<button[^>]*disabled/);
});
test("closed shop can prepare a reorder cart while clearly showing that online orders remain closed", () => {
  const html = renderReorder({ shop: { accepting_orders: false } });
  assert.match(html, /Cửa hàng hiện chưa mở nhận đơn/);
  assert.doesNotMatch(html, /<button[^>]*disabled/);
  assert.match(html, /Chưa gồm phí giao; chưa tạo đơn hoặc thu tiền/);
});
