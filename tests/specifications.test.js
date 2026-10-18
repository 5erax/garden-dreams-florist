import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database, actors } from './helpers/database.js';
import { bouquetSpecification } from '../src/bouquet-specification.js';
import { formSnapshot } from '../src/unsaved-forms.js';
test('size descriptions never accidentally inherit another size and blank data invents no measurements',()=>{
  const p={specification:'Bó tròn gói giấy nâu',variants:[{id:1,size_name:'Lớn',specification:'Bó lớn gói hai lớp'},{id:2,size_name:'Nhỏ',specification:''}]};
  assert.equal(bouquetSpecification(p),'Bó tròn gói giấy nâu');
  assert.equal(bouquetSpecification(p,1),'Bó lớn gói hai lớp');
  assert.match(bouquetSpecification(p,2),/Cỡ Nhỏ/);assert.doesNotMatch(bouquetSpecification(p,2),/\d|hai lớp/);
});
test('form changes include custom-select hidden values and checks, independent of busy disabled state',()=>{
  const text={name:'name',value:'Hoa',type:'text',disabled:false};
  const checked={name:'active',value:'on',type:'checkbox',checked:true};
  const form={elements:[text,checked,{name:'size',type:'hidden',value:'M'}]};
  const original=formSnapshot(form);text.disabled=true;assert.equal(formSnapshot(form),original);
  checked.checked=false;assert.notEqual(formSnapshot(form),original);
});
test('public specification text stays admin-writable, bounded and RLS protected',async()=>{
  const f=await database();
  try {
    await f.as(actors.admin,()=>f.db.query('update gd_products set specification=$1 where id=1',['Bó tiêu chuẩn: giấy nâu']));
    const publicRows=await f.as(null,()=>f.db.query('select specification from gd_products where id=1'));
    assert.equal(publicRows.rows[0].specification,'Bó tiêu chuẩn: giấy nâu');
    const denied=await f.as(actors.alice,()=>f.db.query('update gd_products set specification=$1 where id=1 returning id',['INVALID']));
    assert.equal(denied.rows.length,0);
    await assert.rejects(f.as(actors.admin,()=>f.db.query('update gd_products set specification=$1 where id=1',['x'.repeat(1201)])),/check constraint/);
  } finally {await f.db.close();}
});
