import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { vietnamDate } from '../../src/order.js';

export const actors = {
  alice: '11111111-1111-4111-8111-111111111111',
  bob: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333',
};
export async function database({ through } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;`);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql') && (!through || file<=through)).sort())
    await db.exec(await readFile(new URL(file, directory), 'utf8'));
  await db.query('insert into auth.users values($1),($2),($3)', Object.values(actors));
  await db.query('insert into gd_admins values($1)', [actors.admin]);
  await db.exec('update gd_shop set accepting_orders=true; update gd_shipping set active=true');
  const shipping = (await db.query('select id from gd_shipping order by id limit 1')).rows[0].id;
  // One in-memory engine serializes statements; this harness never claims multi-connection concurrency.
  async function as(actor, operation) {
    await db.exec(`set role ${actor ? 'authenticated' : 'anon'}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor || '']);
    try { return await operation(); }
    finally { await db.exec('reset role'); }
  }
  async function rpc(name, values = []) {
    if (!/^gd_[a-z_]+$/.test(name)) throw new Error('Invalid fixture function identifier');
    const placeholders = values.map((_, index) => `$${index + 1}`).join(',');
    return (await db.query(`select public.${name}(${placeholders}) value`, values)).rows[0].value;
  }
  function payload(changes = {}) {
    return {
      requestId: randomUUID(), name: 'Khách fixture', phone: '0900000000',
      address: 'Địa chỉ giả dùng trong fixture', message: 'PRIVATE CARD', consent: true,
      deliveryDate: vietnamDate(new Date(Date.now() + 2 * 86400000)), deliveryTime: 'Chiều · 13–17h',
      items: [{ id: 1, quantity: 1 }], shippingId: shipping, paymentMethod: 'COD', expectedTotal: 390000,
      ...changes,
    };
  }
  const order = (actor = actors.alice, changes = {}) => as(actor, () => rpc('gd_create_order', [payload(changes)]));
  return { db, as, rpc, shipping, payload, order, close: () => db.close() };
}
