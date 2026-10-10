import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withinBudget, toggleComparison } from '../src/flower-selection.js';

test('budget includes its boundary, reference prices remain distinguishable from purchasable models', () => {
  const product = { price:500000, active:true, reference_only:false };
  assert.equal(withinBudget(product,500000,true),true);
  assert.equal(withinBudget({price:390000},500000,true),true);
  assert.equal(withinBudget(product,300000,false),false);
  assert.equal(withinBudget({...product,active:false,reference_only:true},0,true),false);
  assert.equal(withinBudget({...product,reference_only:true},0,false),true);
});
test('comparison caps at three and deselects before adding another without mutating stored selection', () => {
  const ids=[1,2,3]; assert.deepEqual(toggleComparison(ids,4),ids);
  assert.deepEqual(toggleComparison(toggleComparison(ids,2),4),[1,3,4]);
  assert.deepEqual(ids,[1,2,3]);
});
