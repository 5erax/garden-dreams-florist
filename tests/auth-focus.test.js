import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
test('real auth subscription keeps admin identity on same-user focus events and clears it on account change or sign out',async()=>{
  const harness={states:[],effects:[],listener:null};
  globalThis.gdAuthHarness=harness;
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,
    cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/auth-focus',import.meta.url)),
    plugins:[{name:'auth-focus-fixture',enforce:'pre',resolveId(id){if(id==='virtual:auth-hooks')return id;},
      transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/Store.jsx'))return source.replace('from "react"','from "virtual:auth-hooks"');},
      load(id){
        if(id==='virtual:auth-hooks')return `export {createContext,useContext} from 'react';
          export const useState=initial=>{const h=globalThis.gdAuthHarness,i=h.states.length;h.states.push(initial);return [initial,next=>{h.states[i]=typeof next==='function'?next(h.states[i]):next;}];};
          export const useEffect=effect=>globalThis.gdAuthHarness.effects.push(effect);
          export const useCallback=value=>value;`;
        if(id.replaceAll('\\','/').endsWith('/src/backend.js'))return `export const backendReady=true,appEnvironment='local',authCallbackPending=false;
          export const result=x=>x,verifyEnvironment=async()=>({features:{}}),guestCheckoutEnabled=async()=>false;
          export const backend={auth:{onAuthStateChange(listener){globalThis.gdAuthHarness.listener=listener;return {data:{subscription:{unsubscribe(){}}}};},initialize:async()=>({}),getSession:async()=>({data:{session:{user:{id:'alice'}}}})}};`;
      }},react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  try{
    const {StoreProvider}=await server.ssrLoadModule('/src/Store.jsx');
    StoreProvider({children:null});
    harness.states[4]='alice';
    const cleanup=harness.effects[1]();
    for(const event of ['SIGNED_IN','TOKEN_REFRESHED']){
      harness.listener(event,{user:{id:'alice'}});
      assert.equal(harness.states[4],'alice');
    }
    harness.listener('SIGNED_IN',{user:{id:'bob'}});
    assert.equal(harness.states[4],null);
    harness.states[4]='bob';
    harness.listener('SIGNED_OUT',null);
    assert.equal(harness.states[4],null);
    cleanup();
  }finally{await server.close();delete globalThis.gdAuthHarness;}
});
