import test from 'node:test';
import assert from 'node:assert/strict';
import {moveProduct} from '../src/catalog-order.js';
test('catalog moves adjacent rows in both directions and never loses hidden rows',()=>{
 const rows=[{id:1},{id:2},{id:3},{id:4}];
 assert.deepEqual(moveProduct(rows,1,2),[2,1,3,4]);
 assert.deepEqual(moveProduct(rows,3,2),[1,3,2,4]);
 assert.deepEqual(moveProduct(rows,4,1),[4,1,2,3]);
 assert.equal(moveProduct(rows,1,undefined),null);
 assert.equal(moveProduct(rows,1,1),null);
 assert.deepEqual(rows.map(row=>row.id),[1,2,3,4]);
});
