import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { products } from "../src/catalog.js";

let server, Checkout;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../",import.meta.url)),configFile:false,envDir:false,
    plugins:[{
      name:"checkout-test-store",enforce:"pre",
      load(id) { if (id.replaceAll('\\','/').endsWith('/src/Store.jsx')) return "export const useStore = () => globalThis.checkoutTestStore;"; },
    },react()],
    define:{"import.meta.env.VITE_SUPABASE_URL":'""',"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":'""'},
    server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  });
  ({default:Checkout}=await server.ssrLoadModule('/src/LiveCheckout.jsx'));
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
