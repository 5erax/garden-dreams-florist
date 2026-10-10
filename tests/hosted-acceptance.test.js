import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database, actors } from './helpers/database.js';

test('hosted staging rehearsal exercises real RPCs and leaves no synthetic order, payment or admin', async () => {
  const fixture = await database();
  try {
    await fixture.db.exec("alter table auth.users add column email_confirmed_at timestamptz, add column is_anonymous boolean default false;");
    await fixture.db.query('update auth.users set email_confirmed_at=now() where id=$1', [actors.alice]);
    const sql = await readFile(new URL('../supabase/staging-acceptance.sql', import.meta.url), 'utf8');
    await assert.rejects(fixture.db.exec(sql), /ACCEPTANCE_REQUIRES_STAGING/);
    await fixture.db.exec('rollback;');
    await fixture.db.exec("update gd_private.runtime set environment='staging',project_ref='tgvozhrkolcpszyyrgth';");
    const adminCount = (await fixture.db.query('select count(*)::int count from gd_admins')).rows[0].count;
    await fixture.db.exec(sql);
    for (const table of ['gd_orders', 'gd_memories', 'gd_payment_ledger'])
      assert.equal((await fixture.db.query(`select count(*)::int count from ${table}`)).rows[0].count, 0);
    assert.equal((await fixture.db.query('select count(*)::int count from gd_admins')).rows[0].count, adminCount);
    assert.equal((await fixture.db.query("select count(*)::int count from gd_shipping where name like 'QA %'")).rows[0].count, 0);
  } finally { await fixture.close(); }
});

test('stock rehearsal is staging-only and rolls back stock, recipes, orders and temporary admin', async () => {
  const fixture=await database();
  try {
    await fixture.db.exec('alter table auth.users add column email_confirmed_at timestamptz, add column is_anonymous boolean default false;');
    await fixture.db.query('update auth.users set email_confirmed_at=now() where id=$1',[actors.alice]);
    const sql=await readFile(new URL('../supabase/staging-inventory-acceptance.sql',import.meta.url),'utf8');
    await assert.rejects(fixture.db.exec(sql),/ACCEPTANCE_REQUIRES_STAGING/);await fixture.db.exec('rollback');
    await fixture.db.exec("update gd_private.runtime set environment='staging',project_ref='tgvozhrkolcpszyyrgth'");
    await fixture.db.exec(sql);
    for(const table of ['gd_orders','gd_ingredients','gd_stock_batches','gd_stock_movements','gd_recipes','gd_stock_allocations','gd_inventory_operations']) assert.equal((await fixture.db.query(`select count(*)::int n from ${table}`)).rows[0].n,0);
    assert.equal((await fixture.db.query('select enabled from gd_inventory_settings')).rows[0].enabled,false);
    assert.equal((await fixture.db.query('select count(*)::int n from gd_admins')).rows[0].n,1);
  } finally {await fixture.close();}
});
