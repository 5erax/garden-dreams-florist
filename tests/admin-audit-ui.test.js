import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
let server,money,tools,Catalog,Time,Reschedule,Navigation,Policy;
before(async()=>{
 server=await createServer({configFile:false,envDir:false,plugins:[react()],define:{'import.meta.env.VITE_APP_ENV':'"demo"','import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
 money=await server.ssrLoadModule('/src/BloomMoney.jsx');tools=await server.ssrLoadModule('/src/OrderTools.jsx');Catalog=(await server.ssrLoadModule('/src/AdminCatalogTable.jsx')).default;
 Time=(await server.ssrLoadModule('/src/BloomTime.jsx')).default;Reschedule=(await server.ssrLoadModule('/src/RescheduleOrder.jsx')).default;
 Navigation=(await server.ssrLoadModule('/src/AdminNavigation.jsx')).default;
 Policy=(await server.ssrLoadModule('/src/ShopPolicy.jsx')).default;
});

test('grouped navigation marks one current destination and hides unavailable features on desktop and mobile',()=>{
 const html=renderToStaticMarkup(createElement(Navigation,{tab:'orders',features:{inventory:true},busy:false,onChange(){}}));
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.match(html,/<optgroup label="Vận hành">/);
 assert.match(html,/<option value="orders" selected="">/);
 assert.match(html,/Kho &amp; công thức/);
 assert.doesNotMatch(html,/Bàn xử lý đơn|Lịch giao|Đối soát tiền/);
 const busy=renderToStaticMarkup(createElement(Navigation,{tab:'shop',features:{},busy:true,onChange(){}}));
 assert.match(busy,/<select disabled="">/);
 assert.equal((busy.match(/<button disabled=""/g)||[]).length,6);
 const policy=renderToStaticMarkup(createElement(Policy,{value:'Hoa theo mùa.'}));
 assert.match(policy,/name="returns_policy" maxLength="4000"/);
 assert.match(policy,/13\/4.000 ký tự/);
});
test('shop time stays in 24-hour form values and reschedule requires customer agreement',()=>{
 const html=renderToStaticMarkup(createElement(Time,{name:'closes_at',defaultValue:'17:30'}));
 assert.match(html,/name="closes_at" value="17:30"/);assert.match(html,/aria-label="Giờ"/);assert.doesNotMatch(html,/type="time"|PM|AM/);
 const order={id:'fixture',version:2,status:'PENDING',delivery_date:'2030-01-01',delivery_time:'Chiều · 13–17h'};
 const form=renderToStaticMarkup(createElement(Reschedule,{order}));assert.match(form,/Đã liên hệ và được khách đồng ý/);assert.match(form,/type="checkbox" required=""/);assert.match(form,/minLength="10"/);
 assert.equal(renderToStaticMarkup(createElement(Reschedule,{order:{...order,status:'SHIPPING'}})),'');
});
after(async()=>{await server?.close();});
test('money inputs reject negatives, fractional, unsafe and missing amounts; preserve canonical form value',()=>{
 assert.equal(money.moneyInput('550.000',1000),550000);
 for(const value of ['','-1000','1,50','Infinity','99999999999999999'])assert.equal(money.moneyInput(value,1000),null);
 const html=renderToStaticMarkup(createElement(money.default,{name:'price',defaultValue:550000,required:true}));
 assert.match(html,/value="550.000"/);assert.match(html,/name="price" value="550000"/);
});
test('order progress and contact actions distinguish cancelled and recipient contacts',()=>{
 assert.equal(tools.nextOrderStatus('DELIVERED'),null);
 assert.equal(tools.nextOrderStatus('PENDING'),'CONFIRMED');
 const progress=renderToStaticMarkup(createElement(tools.OrderProgress,{order:{status:'CANCELLED'}}));
 assert.doesNotMatch(progress,/is-complete|aria-current/);
 const actions=renderToStaticMarkup(createElement(tools.OrderTools,{admin:true,order:{recipient_phone:'0900000000'}}));
 assert.match(actions,/Gọi người nhận/);assert.doesNotMatch(actions,/Gọi người đặt/);
});
test('catalog table exposes non-hover edit, formatted price and explicit availability switches',()=>{
 const html=renderToStaticMarkup(createElement(Catalog,{rows:[{id:1,slug:'hong-phan',name:'Hồng phấn',stems:'Hồng',price:550000,image:'/flowers/bouquet_1.webp',active:false,version:1}],busy:false}));
 assert.match(html,/role="switch" aria-checked="false"/);assert.match(html,/Chỉnh sửa/);assert.match(html,/Lưu giá/);assert.match(html,/\/hoa\/hong-phan/);
});

test('catalog explains boundaries and keeps separate named reorder actions',()=>{
 const rows=[{id:1,name:'Cúc trắng',slug:'cuc-trang',price:100000,version:1},{id:2,name:'Cúc vàng',slug:'cuc-vang',price:120000,version:1}];
 const html=renderToStaticMarkup(createElement(Catalog,{rows,busy:false}));
 assert.match(html,/Vị trí 1\/2 · Đầu danh mục/);
 assert.match(html,/Vị trí 2\/2 · Cuối danh mục/);
 assert.match(html,/aria-label="Đưa Cúc trắng lên một vị trí" title="Mẫu đang ở đầu danh mục" disabled/);
 assert.match(html,/catalog-order-actions/);
});
