import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

test('recipe snapshots normalize restored values and retry success saves only the original form',async()=>{
  const data={enabled:false,ingredients:[{id:1,name:'Test stem',unit:'STEM',minimum_stock:0}],batches:[],recipes:[],movements:[]};
  const h={states:[],refs:[],stateIndex:0,refIndex:0,requests:[],saved:[],data};
  h.call=async(name,request)=>{if(name==='gd_inventory_state')return data;h.requests.push(request);if(h.requests.length===1)throw Error('Ambiguous network failure');return {};};
  globalThis.inventoryRetryTest=h;
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,
    cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/inventory-retry',import.meta.url)),
    plugins:[{name:'inventory-fixture',enforce:'pre',resolveId(id){if(id==='virtual:inventory-hooks')return id;},
      transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/AdminInventory.jsx'))return source.replace("from 'react'","from 'virtual:inventory-hooks'");},
      load(id){
        if(id==='virtual:inventory-hooks')return `export const useEffect=()=>{};export const useState=initial=>{const h=globalThis.inventoryRetryTest,i=h.stateIndex++;if(!(i in h.states))h.states[i]=typeof initial==='function'?initial():initial;return[h.states[i],v=>{h.states[i]=typeof v==='function'?v(h.states[i]):v;}];};export const useRef=value=>{const h=globalThis.inventoryRetryTest;return h.refs[h.refIndex++]||={current:value};};`;
        if(id.replaceAll('\\','/').endsWith('/src/Store.jsx'))return `export const useStore=()=>({products:[{id:1,name:'Test flower',price:390000,active:true}],session:{user:{id:'local-admin'}}});`;
        if(id.replaceAll('\\','/').endsWith('/src/backend.js'))return 'export const call=(...args)=>globalThis.inventoryRetryTest.call(...args);';
        if(id.replaceAll('\\','/').endsWith('/src/unsaved-forms.js'))return 'export const markFormSaved=form=>globalThis.inventoryRetryTest.saved.push(form);';
      }
    },react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  const nodes=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];
  try {
    const {default:Inventory}=await server.ssrLoadModule('/src/AdminInventory.jsx');
    const render=()=>{h.stateIndex=0;h.refIndex=0;return nodes(Inventory());};render();
    h.states[2]=data;h.states[8]=[{ingredientId:1,quantity:1}];
    const snapshot=()=>render().find(n=>n.props?.name==='recipeState').props.value;
    const original=snapshot();h.states[6]='1';h.states[8]=[{ingredientId:'1',quantity:'1'}];assert.equal(snapshot(),original);
    const form={reset(){throw Error('Controlled recipe must not be reset');}};
    const tree=render();const recipeForm=tree.find(n=>n.type==='form'&&nodes(n).some(child=>child.props?.name==='recipeState'));
    recipeForm.props.onSubmit({preventDefault(){},currentTarget:form});await new Promise(setImmediate);
    assert.equal(h.saved.length,0);assert.equal(h.requests.length,1);
    const retry=render().find(n=>n.type==='button'&&n.props.children==='Kiểm tra lại thao tác vừa gửi');assert.ok(retry);
    retry.props.onClick();await new Promise(setImmediate);
    assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1],h.requests[0]);assert.deepEqual(h.saved,[form]);
    assert.equal(h.requests[0].p_body.lines[0].quantity,1);
  } finally {delete globalThis.inventoryRetryTest;await server.close();}
});
