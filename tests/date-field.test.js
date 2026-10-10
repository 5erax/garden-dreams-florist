import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateObject, dateISO, dateText, dateFromText } from '../src/date-field.js';
import { readAdminTab } from '../src/admin-navigation.js';

test('calendar displays Vietnam date order, round trips without UTC day shifts, rejects nonexistent dates', () => {
  for (const iso of ['2026-10-01','2024-02-29','2030-12-31']) {
    assert.equal(dateISO(dateObject(iso)),iso);
    assert.equal(dateFromText(dateText(iso)),iso);
  }
  assert.equal(dateText('2026-10-01'),'01/10/2026');
  for (const input of ['30/02/2026','29/02/2025','10/13/2026','1/10/2026','10/10/0000']) assert.equal(dateFromText(input),'');
  assert.equal(dateObject('2026-02-30'),undefined);
});
test('admin navigation is scoped to account, recognizes current capabilities, and tolerates denied storage', () => {
  const storage={getItem:key => ({'gd-admin-tab:alice':'inventory','gd-admin-tab:bob':'products'})[key]};
  assert.equal(readAdminTab('alice',{inventory:true},storage),'inventory');
  assert.equal(readAdminTab('alice',{},storage),'orders');
  assert.equal(readAdminTab('bob',{},storage),'products');
  assert.equal(readAdminTab('other',{},storage),'orders');
  assert.equal(readAdminTab('alice',{}, {getItem(){throw Error('blocked');}}),'orders');
});
