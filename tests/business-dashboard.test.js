import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, actors } from './helpers/database.js';

test('dashboard gates admin and dates, separates booking from money, omits private customer data', async () => {
  const f = await database();
  try {
    await f.db.exec("update gd_shop set transfer_enabled=true,bank_bin='970422',bank_account='0000000000',account_name='FIXTURE SHOP'");
    const report = () => f.as(actors.admin, () => f.rpc('gd_business_dashboard', ['2030-01-10', '2030-01-10']));
    await assert.rejects(f.as(actors.alice, () => f.rpc('gd_business_dashboard', ['2030-01-10','2030-01-10'])), /ADMIN_REQUIRED/);
    await assert.rejects(f.as(null, () => f.rpc('gd_business_dashboard', ['2030-01-10','2030-01-10'])), /permission denied/);
    await assert.rejects(f.as(actors.admin, () => f.rpc('gd_business_dashboard', ['2030-01-10','2030-12-10'])), /INVALID_REPORT_PERIOD/);
    const first = await f.order();
    const second = await f.order(actors.alice, { paymentMethod: 'VIETQR' });
    const cancelled = await f.order(actors.bob);
    await f.as(actors.admin, () => f.rpc('gd_update_order', [cancelled.id, cancelled.version, 'CANCELLED', 'UNPAID', 'fixture cancellation']));
    await f.db.query("update gd_orders set created_at='2030-01-09T17:00:00Z' where id=any($1::uuid[])", [[first.id, second.id, cancelled.id]]);
    let data = await report();
    assert.equal(data.orders.count,3); assert.equal(data.orders.bookedValue,780000);
    assert.equal(data.orders.cancelled,1); assert.equal(data.orders.buyers,1);
    assert.equal(data.repeatBuyersAllTime,1); assert.equal(data.receivableNow,780000);
    assert.equal(data.cash.received,0); assert.equal(data.daily[0].orders,3);
    assert.equal(data.flowers[0].quantity,2); assert.equal(data.methods.length,2);
    const receipt = await f.as(actors.admin, () => f.rpc('gd_reconcile_payment', [randomUUID(), first.id, first.version, 'RECEIPT', 'PRIVATE PROOF', 'PRIVATE BANK REF']));
    await f.db.query("update gd_payment_ledger set effective_at='2030-01-10T16:59:59Z' where id=$1", [receipt.event.id]);
    data = await report();
    assert.equal(data.cash.received,390000); assert.equal(data.receivableNow,390000);
    assert.equal(data.daily[0].netCash,390000);
    const refund = await f.as(actors.admin, () => f.rpc('gd_reconcile_payment', [randomUUID(), first.id, receipt.order.version, 'REFUND', 'PRIVATE REFUND', '']));
    await f.db.query("update gd_payment_ledger set effective_at='2030-01-10T17:00:00Z' where id=$1", [refund.event.id]);
    data = await report(); assert.equal(data.cash.refunded,0);
    const next = await f.as(actors.admin, () => f.rpc('gd_business_dashboard', ['2030-01-11','2030-01-11']));
    assert.equal(next.cash.refunded,390000); assert.equal(next.daily[0].netCash,-390000);
    assert.doesNotMatch(JSON.stringify(data), /PRIVATE|0900000000|owner_id|recipient_name|address|password|token/);
    await f.db.exec('alter table gd_orders disable trigger classify_order');
    await f.db.query('update gd_orders set is_test=true where id=$1', [first.id]);
    await f.db.exec('alter table gd_orders enable trigger classify_order');
    data = await report();
    assert.equal(data.orders.count,2); assert.equal(data.cash.received,0);
    assert.equal(data.orders.bookedValue,390000); assert.equal(data.repeatBuyersAllTime,0);
  } finally { await f.close(); }
});
