import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';
test('payment component fails closed on balance errors, supports retry and hides zero balances',async()=>{
  const harness={states:[],effects:[],index:0,read:async()=>{throw Error('offline')}};
  globalThis.gdPaymentHarness=harness;
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,
    cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/bank-payment',import.meta.url)),
    plugins:[{name:'payment-fixture',enforce:'pre',resolveId(id){if(id==='virtual:payment-hooks')return id;},
      transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/BankPayment.jsx'))return source.replace("from 'react'","from 'virtual:payment-hooks'");},
      load(id){
        if(id==='virtual:payment-hooks')return `export const useEffect=effect=>globalThis.gdPaymentHarness.effects.push(effect);export const useState=initial=>{const h=globalThis.gdPaymentHarness,i=h.index++;if(!(i in h.states))h.states[i]=initial;return[h.states[i],v=>{h.states[i]=typeof v==='function'?v(h.states[i]):v;}];};`;
        if(id.replaceAll('\\','/').endsWith('/src/backend.js'))return 'export const call=(...args)=>globalThis.gdPaymentHarness.read(...args);';
      }},react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  try{
    const {BankPayment}=await server.ssrLoadModule('/src/BankPayment.jsx');
    const order={id:'synthetic',status:'CONFIRMED',payment_status:'PARTIAL',payment_method:'VIETQR',total:600000,reference:'GD-TEST',bank:{bankName:'Test',account:'123456',accountName:'TEST'}};
    const render=()=>{harness.index=0;return renderToStaticMarkup(BankPayment({order}));};
    assert.match(render(),/CHUYỂN KHOẢN VIETQR/);
    const cleanup=harness.effects.at(-1)();
    await new Promise(setImmediate);
    const failed=render();assert.match(failed,/Thử lại thông tin thanh toán/);assert.doesNotMatch(failed,/data:image|600\.000/);
    cleanup();harness.read=async()=>({receivable:0});harness.effects.at(-1)();
    await new Promise(setImmediate);
    const settled=render();assert.match(settled,/không còn số tiền/);assert.doesNotMatch(settled,/CHUYỂN KHOẢN|data:image/);
  }finally{await server.close();delete globalThis.gdPaymentHarness;}
});
