import { useEffect, useRef, useState } from 'react';
const editableForms = 'form.admin-edit-form,.admin-edit-form form,.inventory-editor form';
export function formSnapshot(form) {
  return JSON.stringify([...form.elements].flatMap(field => {
    if (!field.name || ['submit','button','reset'].includes(field.type) || ['checkbox','radio'].includes(field.type) && !field.checked) return [];
    const values = field.type === 'select-multiple' ? [...field.selectedOptions].map(o=>o.value) : field.type === 'file' ? [...field.files].map(f=>f.name) : [field.value];
    return values.map(value=>[field.name,value]);
  }));
}
export function markFormSaved(form) { form?.dispatchEvent(new CustomEvent('gd:form-saved',{bubbles:true})); }
export function useUnsavedForms(root) {
  const records = useRef(new Map()), dirty = useRef(false);
  const [hasChanges,setHasChanges] = useState(false);
  const confirmDiscard = () => {
    if (dirty.current && !window.confirm('Bạn có chỉnh sửa chưa lưu. Bỏ thay đổi và tiếp tục?')) return false;
    return true;
  };
  useEffect(() => {
    const element=root.current;
    if (!element) return;
    let frame;
    const check = () => {
      for(const form of element.querySelectorAll(editableForms)) if(!records.current.has(form)) records.current.set(form,formSnapshot(form));
      for(const form of records.current.keys()) if(!form.isConnected) records.current.delete(form);
      dirty.current=[...records.current].some(([form,snapshot])=>formSnapshot(form)!==snapshot);
      setHasChanges(dirty.current);
    };
    const schedule = () => {cancelAnimationFrame(frame); frame=requestAnimationFrame(check);};
    const saved = event => { records.current.set(event.target,formSnapshot(event.target)); check(); };
    const beforeUnload = event => {check();if(dirty.current){event.preventDefault();event.returnValue='';}};
    let allowedUrl = null;
    const click = event => {
      const target=event.target.closest?.('[data-discard-changes],a[href],.portal-signout,.portal-header button');
      if(target?.tagName==='A' && (target.hasAttribute('download') || target.target==='_blank' || target.href===location.href)) return;
      if(target && dirty.current) {
        if(!confirmDiscard()){event.preventDefault();event.stopImmediatePropagation();}
        else if(target.tagName==='A') allowedUrl=target.href;
      }
    };
    let currentUrl=location.href;
    const navigate = () => {
      if(location.href===allowedUrl){allowedUrl=null;currentUrl=location.href;return;}
      if(dirty.current && !confirmDiscard()) history.replaceState(history.state,'',currentUrl);
      else currentUrl=location.href;
    };
    check();
    const observer=new MutationObserver(schedule);
    observer.observe(element,{subtree:true,childList:true,attributes:true,attributeFilter:['value','checked']});
    element.addEventListener('focusin',check);element.addEventListener('input',schedule);element.addEventListener('change',schedule);element.addEventListener('gd:form-saved',saved);
    document.addEventListener('click',click,true);window.addEventListener('beforeunload',beforeUnload);window.addEventListener('popstate',navigate);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);element.removeEventListener('focusin',check);element.removeEventListener('input',schedule);element.removeEventListener('change',schedule);element.removeEventListener('gd:form-saved',saved);document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('popstate',navigate);};
  }, []);
  return {confirmDiscard,hasChanges};
}
