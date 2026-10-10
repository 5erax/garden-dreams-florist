import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { money } from '../src/catalog.js';
let server, BloomSelect, BloomDate;
before(async () => {
  server = await createServer({ root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,plugins:[react()],
    cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/form-controls',import.meta.url)),
    server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  ({default:BloomSelect}=await server.ssrLoadModule('/src/BloomSelect.jsx'));
  ({default:BloomDate}=await server.ssrLoadModule('/src/BloomDate.jsx'));
});
after(async()=>{await server?.close();});
const render = (component,props,...children)=>renderToStaticMarkup(createElement(component,props,...children));
test('select preserves selected size label, price and named form value without native dropdown markup',()=>{
  const html=render(BloomSelect,{name:'variantId',value:'101',required:true,'aria-label':'Cỡ bó hoa'},
    createElement('option',{value:''},`Tiêu chuẩn · ${money(390000)}`),
    createElement('option',{value:101},`Bó lớn · ${money(700000)}`));
  assert.match(html,/role="combobox"/);
  assert.match(html,/aria-label="Cỡ bó hoa"/);
  assert.match(html,/name="variantId"[^>]*value="101"/);
  assert.ok(html.includes(`Bó lớn · ${money(700000)}`));
  assert.doesNotMatch(html,/<select/);
});
test('disabled select preserves disabled trigger and disabled form field',()=>{
  const html=render(BloomSelect,{name:'occasion',defaultValue:'love',disabled:true},createElement('option',{value:'love'},'Tình yêu'));
  assert.match(html,/<button[^>]*disabled=""/);
  assert.match(html,/<input[^>]*disabled=""[^>]*name="occasion"/);
});
test('calendar shows day/month/year and serializes exactly one ISO form field',()=>{
  const html=render(BloomDate,{name:'deliveryDate',value:'2026-10-10',required:true,min:'2026-10-01',max:'2026-10-31'});
  assert.match(html,/value="10\/10\/2026"/);
  assert.match(html,/<input type="hidden" name="deliveryDate" value="2026-10-10"/);
  assert.equal((html.match(/name="deliveryDate"/g)||[]).length,1);
  assert.match(html,/aria-label="Mở lịch chọn ngày"/);
  assert.doesNotMatch(html,/type="date"/);
});
test('invalid or out of range calendar drafts cannot serialize a stale delivery date',()=>{
  for(const value of ['2026-02-30','2026-09-30','2026-11-01']){
    const html=render(BloomDate,{name:'deliveryDate',value,min:'2026-10-01',max:'2026-10-31'});
    assert.match(html,/<input type="hidden" name="deliveryDate" value=""/);
  }
});
