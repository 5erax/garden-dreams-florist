import{test}from'node:test';
import assert from'node:assert/strict';
import{createServer}from'vite';
import react from'@vitejs/plugin-react';
import{fileURLToPath}from'node:url';

test('order detail panels have unique sibling identities across payment and request updates',async()=>{
 const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,
  cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/detail-keys',import.meta.url)),
  plugins:[{name:'detail-fixture',enforce:'pre',resolveId(id){if(id==='virtual:detail-hooks')return id;},
   transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/OrderDetail.jsx'))return source.replace('from "react"','from "virtual:detail-hooks"');},
   load(id){if(id==='virtual:detail-hooks')return 'export const useEffect=()=>{};export const useState=initial=>[typeof initial===\'function\'?initial():initial,()=>{}];';if(id.replaceAll('\\','/').endsWith('/src/Store.jsx'))return 'export const useStore=()=>({features:{reconciliationLedger:true,orderRequests:true},session:{user:{id:"fixture"}}});';}
  },react()],define:{'import.meta.env.VITE_APP_ENV':'"demo"','import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
 try{
  const{default:Detail}=await server.ssrLoadModule('/src/OrderDetail.jsx');
  const order={id:'order-fixture',reference:'GD-TEST',status:'CONFIRMED',payment_status:'PARTIAL',payment_method:'VIETQR',items:[],shipping:{name:'Test',fee:0},delivery_date:'2026-10-21',delivery_time:'Chiều · 13–17h',subtotal:430000,total:430000};
  const visit=node=>{if(!node||typeof node!=='object')return;const children=[node.props?.children].flat(Infinity);const keys=children.filter(child=>child&&typeof child==='object'&&child.key!=null).map(child=>child.key);assert.equal(new Set(keys).size,keys.length,'duplicate sibling keys');children.forEach(visit);};
  visit(Detail({order,admin:true,onUpdated(){}}));
 }finally{await server.close();}
});
