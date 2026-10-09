import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function buildProductionUpgrade() {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name =>
    name >= '202610090005_environment.sql' && name <= '202610100012_payment_ledger.sql' && name.endsWith('.sql')).sort();
  if (names.length !== 8) throw new Error('Production upgrade requires migrations 005 through 012');
  const pieces = [`-- Production ztzpipgptticvliotbsc only. Additive baseline 004 to 012 upgrade.
-- Apply through the project-scoped connection. Existing shop, orders and prices are preserved.
begin;
set local lock_timeout = '10s';
lock table public.gd_shop, public.gd_products, public.gd_orders in share row exclusive mode;
do $$
begin
  if to_regclass('gd_private.runtime') is not null
    or to_regclass('public.gd_product_variants') is not null
    or to_regclass('public.gd_payment_ledger') is not null
    or to_regclass('public.gd_admin_audit') is null
    or exists(select 1 from pg_attribute where attrelid='public.gd_orders'::regclass
      and attname='is_test' and not attisdropped)
    then raise exception 'PRODUCTION_UPGRADE_REQUIRES_BASELINE_004'; end if;
  if not exists(select 1 from public.gd_admins a join auth.users u on u.id=a.user_id
    where lower(u.email)='dha260803@gmail.com' and u.email_confirmed_at is not null)
    then raise exception 'PRODUCTION_UPGRADE_REQUIRES_CONFIRMED_OWNER'; end if;
end;
$$;`];
  for (const name of names) {
    const source = await readFile(new URL(name, directory), 'utf8');
    if (!/^begin;\s*\n/i.test(source) || !/\ncommit;\s*$/i.test(source))
      throw new Error(`Migration transaction wrapper changed: ${name}`);
    pieces.push(`-- ${name}\n${source.replace(/^begin;\s*\n/i, '').replace(/\ncommit;\s*$/i, '')}`);
  }
  pieces.push("notify pgrst, 'reload schema';\ncommit;\nselect public.gd_environment() as upgraded_environment;");
  return pieces.join('\n\n') + '\n';
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await writeFile(new URL('../supabase/production-upgrade-004-to-012.sql', import.meta.url), await buildProductionUpgrade());
  console.log('Prepared production upgrade; no database connection or execution.');
}
