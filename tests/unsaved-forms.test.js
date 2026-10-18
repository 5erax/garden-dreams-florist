import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

test('local discard and saving another editor retain original dirty baselines of surviving forms',async()=>{
  const harness={effects:[],refs:[],index:0,dirty:false};
  globalThis.unsavedTest=harness;
  const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,envDir:false,
    cacheDir:fileURLToPath(new URL('../node_modules/.vite/tests/unsaved',import.meta.url)),
    plugins:[{name:'unsaved-hooks',enforce:'pre',resolveId(id){if(id==='virtual:unsaved-hooks')return id;},
      transform(source,id){if(id.replaceAll('\\','/').endsWith('/src/unsaved-forms.js'))return source.replace("from 'react'","from 'virtual:unsaved-hooks'");},
      load(id){if(id==='virtual:unsaved-hooks')return `export const useEffect=fn=>globalThis.unsavedTest.effects.push(fn);export const useState=()=>[false,v=>{globalThis.unsavedTest.dirty=v;}];export const useRef=value=>{const h=globalThis.unsavedTest;return h.refs[h.index++]||=( {current:value} );};`;}
    }],server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  const names=['window','document','location','history','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
  const original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const events=()=>({listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},removeEventListener(name){this.listeners.delete(name);}});
  const field=value=>({type:'text',name:'name',value});
  const first={elements:[field('Original')],isConnected:true},second={elements:[field('Size')],isConnected:true};
  const forms=[first,second],root={...events(),querySelectorAll:()=>forms.filter(f=>f.isConnected)};
  let allow=false,confirmations=0,cleanup;
  try {
    Object.assign(globalThis,{window:{...events(),confirm:()=>{confirmations++;return allow;}},document:events(),location:{href:'https://example.test/#admin'},history:{replaceState(){}},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){}});
    const {useUnsavedForms}=await server.ssrLoadModule('/src/unsaved-forms.js');
    const hook=useUnsavedForms({current:root});cleanup=harness.effects[0]();
    first.elements[0].value='Changed';root.listeners.get('input')();assert.equal(harness.dirty,true);
    assert.equal(hook.confirmDiscard(),false);assert.equal(first.elements[0].value,'Changed');
    allow=true;assert.equal(hook.confirmDiscard(),true);
    second.isConnected=false;root.listeners.get('input')();assert.equal(harness.dirty,true);
    let prevented=false;window.listeners.get('beforeunload')({preventDefault(){prevented=true;}});assert.equal(prevented,true);
    second.isConnected=true;root.listeners.get('input')();second.elements[0].value='New size';root.listeners.get('gd:form-saved')({target:second});assert.equal(harness.dirty,true);
    root.listeners.get('gd:form-saved')({target:first});assert.equal(harness.dirty,false);
    first.elements.push({type:'hidden',name:'photoEditorState',value:'changed album'});root.listeners.get('input')();assert.equal(harness.dirty,true);
    const link={tagName:'A',href:'https://example.test/#collection',hasAttribute:()=>false};
    document.listeners.get('click')({target:{closest:()=>link}});const before=confirmations;location.href=link.href;window.listeners.get('popstate')();assert.equal(confirmations,before);
  } finally {
    cleanup?.();for(const [name,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
    delete globalThis.unsavedTest;await server.close();
  }
});
