import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionUpgrade } from '../scripts/build-production-upgrade.mjs';
import { database, actors } from './helpers/database.js';

test('production upgrade preserves live orders, shop settings and prices, and refuses reruns', async () => {
  const fixture = await database({ through: '202610090004_audit.sql' });
  const { db, as, rpc, order } = fixture;
  try {
    await db.exec("alter table auth.users add column email text, add column email_confirmed_at timestamptz;");
    const sql = await buildProductionUpgrade();
    await assert.rejects(db.exec(sql), /PRODUCTION_UPGRADE_REQUIRES_CONFIRMED_OWNER/);
    await db.exec('rollback;');
    await db.query("update auth.users set email='dha260803@gmail.com',email_confirmed_at=now() where id=$1", [actors.admin]);
    const unpaid = await order();
    const pending = await order(actors.bob);
    const paid = await as(actors.admin, () => rpc('gd_update_order', [pending.id, pending.version, 'CONFIRMED', 'PAID', 'Fixture payment before upgrade']));
    const shop = (await db.query('select * from gd_shop')).rows;
    const products = (await db.query('select id,name,price,image,active,version from gd_products order by id')).rows;
    const broken = sql.replace('-- 202610100012_payment_ledger.sql', () => "do $$begin raise exception 'UPGRADE_FAILURE'; end$$;\n-- 202610100012_payment_ledger.sql");
    await assert.rejects(db.exec(broken), /UPGRADE_FAILURE/);
    await db.exec('rollback;');
    assert.equal((await db.query("select to_regclass('gd_private.runtime') value")).rows[0].value, null);
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from gd_shop')).rows, shop);
    assert.deepEqual((await db.query('select id,name,price,image,active,version from gd_products order by id')).rows, products);
    for (const original of [unpaid, paid]) {
      const current = (await db.query('select * from gd_orders where id=$1', [original.id])).rows[0];
      for (const key of ['owner_id','items','shipping','bank','total','status','payment_status','version','card_message'])
        assert.deepEqual(current[key], original[key], key);
      assert.equal(current.is_test, false);
    }
    const runtime = await rpc('gd_environment');
    assert.equal(runtime.environment, 'production');
    assert.equal(runtime.projectRef, 'ztzpipgptticvliotbsc');
    assert.equal(runtime.features.reconciliationLedger, true);
    assert.equal((await db.query('select enabled from gd_delivery_settings')).rows[0].enabled, false);
    const ledger = (await db.query('select source,effective_at,amount from gd_payment_ledger')).rows;
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].source, 'LEGACY');
    assert.equal(ledger[0].effective_at, null);
    assert.equal(Number(ledger[0].amount), Number(paid.total));
    await assert.rejects(db.exec(sql), /PRODUCTION_UPGRADE_REQUIRES_BASELINE_004/);
    await db.exec('rollback;');
  } finally { await fixture.close(); }
});
