import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutContacts, normalizePhone } from '../src/checkout-contacts.js';
test('buyer and recipient accept the same formatted Vietnamese numbers without guessing digits',()=>{
  for (const value of ['090 123 4567','090.123.4567','090-123-4567','+84 90 123 4567']) {
    const result=checkoutContacts({buyerPhone:value,phone:value});
    assert.deepEqual(result.errors,{}); assert.equal(result.values.phone,normalizePhone(value));
  }
  for(const value of ['123','090123456789','+850901234567','090abc4567']) {
    assert.deepEqual(Object.keys(checkoutContacts({buyerPhone:value,phone:value}).errors),['buyerPhone','phone']);
  }
});
