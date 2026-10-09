import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildStagingUpgrade, buildStagingPaymentUpgrade } from '../scripts/build-staging-upgrade.mjs';
import { database, actors } from './helpers/database.js';
import { vietnamDate } from '../src/order.js';

let db, sql, order;
const alice = '11111111-1111-4111-8111-111111111111';
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql') && name < '202610090006').sort())
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
  sql = await buildStagingUpgrade();
});
after(async () => { await db?.close(); });
async function rejected(statement, error) {
  await assert.rejects(db.exec(statement), error);
  await db.exec('rollback;');
}
test('staging upgrade refuses production and the wrong project before any schema mutation', async () => {
  await rejected(sql, /UPGRADE_REQUIRES_EXACT_STAGING_PROJECT/);
  await db.exec("update gd_private.runtime set environment='staging',project_ref='aaaaaaaaaaaaaaaaaaaa'");
  await rejected(sql, /UPGRADE_REQUIRES_EXACT_STAGING_PROJECT/);
  assert.equal((await db.query("select to_regclass('public.gd_order_requests') value")).rows[0].value, null);
});
test('failed additive upgrade rolls back all intermediate schema/data writes', async () => {
  await db.exec("update gd_private.runtime set environment='staging',project_ref='tgvozhrkolcpszyyrgth'");
  const broken = sql.replace('-- 202610090007_product_variants.sql', () => "do $$begin raise exception 'FIXTURE_UPGRADE_FAILURE'; end$$;\n-- 202610090007_product_variants.sql");
  await rejected(broken, /FIXTURE_UPGRADE_FAILURE/);
  assert.equal((await db.query("select count(*)::int count from pg_attribute where attrelid='gd_products'::regclass and attname='images' and not attisdropped")).rows[0].count, 0);
  assert.equal((await db.query('select count(*)::int count from gd_products')).rows[0].count, 20);
});
test('upgrading existing staging preserves old orders/prices and enables capabilities without opening policy', async () => {
  await db.query('insert into auth.users values($1)', [alice]);
  await db.exec('update gd_shop set accepting_orders=true; update gd_shipping set active=true');
  const shipping = (await db.query('select id from gd_shipping limit 1')).rows[0].id;
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
  const payload = { requestId: '44444444-4444-4444-8444-444444444444', name: 'Khách fixture', phone: '0900000000',
    address: 'Địa chỉ giả trong fixture', message: 'PRIVATE CARD', consent: true,
    deliveryDate: vietnamDate(new Date(Date.now() + 86400000)), deliveryTime: 'Chiều · 13–17h',
    items: [{ id: 1, quantity: 1 }], shippingId: shipping, paymentMethod: 'COD', expectedTotal: 390000 };
  order = (await db.query('select gd_create_order($1) value', [payload])).rows[0].value;
  await db.exec('update gd_shop set accepting_orders=false');
  await db.exec(sql);
  const restored = (await db.query('select * from gd_orders where id=$1', [order.id])).rows[0];
  for (const key of ['owner_id', 'reference', 'address', 'recipient_name', 'card_message', 'shipping', 'items', 'status', 'payment_status', 'version'])
    assert.deepEqual(restored[key], order[key], key);
  assert.equal(Number(restored.total), Number(order.total));
  assert.equal(restored.delivery_rule_id, null);
  assert.equal((await db.query('select accepting_orders from gd_shop')).rows[0].accepting_orders, false);
  assert.equal((await db.query('select enabled from gd_delivery_settings')).rows[0].enabled, false);
  const runtime = (await db.query('select gd_environment() value')).rows[0].value;
  assert.equal(runtime.environment, 'staging');
  assert.equal(runtime.features.orderRequests, true);
  assert.equal(runtime.features.operationsDesk, true);
  assert.equal(runtime.features.deliveryCalendar, true);
  await rejected(sql, /UPGRADE_REQUIRES_BASELINE_005/);
  assert.equal((await db.query('select count(*)::int count from gd_orders')).rows[0].count, 1);
});

test('005-to-012 upgrades payments atomically with opening balances and refuses production or reruns', async () => {
  const existing = await database({ through: '202610090005_environment.sql' });
  try {
    const upgrade = await buildStagingPaymentUpgrade();
    await assert.rejects(existing.db.exec(upgrade), /UPGRADE_REQUIRES_EXACT_STAGING_PROJECT/);
    await existing.db.exec('rollback;');
    await existing.db.exec("update gd_private.runtime set environment='staging',project_ref='tgvozhrkolcpszyyrgth'");
    let paid = await existing.order();
    paid = await existing.as(actors.admin, () => existing.rpc('gd_update_order', [paid.id, paid.version, 'CONFIRMED', 'PAID', 'Existing verified payment']));
    await existing.db.exec('update gd_shop set accepting_orders=false');
    const broken = upgrade.replace('-- 202610100012_payment_ledger.sql', () => "do $$begin raise exception 'PAYMENT_UPGRADE_FAILURE'; end$$;\n-- 202610100012_payment_ledger.sql");
    await assert.rejects(existing.db.exec(broken), /PAYMENT_UPGRADE_FAILURE/);
    await existing.db.exec('rollback;');
    assert.equal((await existing.db.query("select to_regclass('gd_product_variants') value")).rows[0].value, null);
    await existing.db.exec(upgrade);
    const current = (await existing.db.query('select * from gd_orders where id=$1', [paid.id])).rows[0];
    for (const key of ['owner_id','total','items','shipping','card_message','status','payment_status','version']) assert.deepEqual(current[key], paid[key]);
    const ledger = (await existing.db.query('select source,effective_at,amount from gd_payment_ledger')).rows;
    assert.equal(ledger.length, 1);assert.equal(ledger[0].source, 'LEGACY');assert.equal(ledger[0].effective_at, null);
    assert.equal(Number(ledger[0].amount), Number(paid.total));
    assert.equal((await existing.rpc('gd_environment')).features.reconciliationLedger, true);
    assert.equal((await existing.db.query('select accepting_orders from gd_shop')).rows[0].accepting_orders, false);
    await assert.rejects(existing.db.exec(upgrade), /UPGRADE_REQUIRES_BASELINE_005/);
    await existing.db.exec('rollback;');
  } finally { await existing.close(); }
});
