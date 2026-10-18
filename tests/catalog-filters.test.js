import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCatalogFilters, catalogFilterUrl } from '../src/catalog-filters.js';
test('shareable filters round trip without losing quick-view or hash and never contain favorite IDs', () => {
  const filters=readCatalogFilters('?q=mau+don&color=hồng&type=mẫu+đơn&budget=500000&sort=low&references=1');
  const path=catalogFilterUrl('https://example.test/?flower=rose#collection',filters);
  assert.deepEqual(readCatalogFilters(new URL(path,'https://example.test').search),filters);
  assert.match(path,/flower=rose/); assert.match(path,/#collection$/); assert.doesNotMatch(path,/favorites/);
  assert.equal(readCatalogFilters('?color=unknown&budget=-1&sort=evil&occasion=unknown').budget,0);
  assert.equal(readCatalogFilters('?q='+ 'x'.repeat(500)).query.length,100);
});
