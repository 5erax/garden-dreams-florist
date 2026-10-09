import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const names = [
  '202610090006_product_albums.sql',
  '202610090007_product_variants.sql',
  '202610090008_variant_orders.sql',
  '202610090009_delivery_calendar.sql',
  '202610090010_operations_desk.sql',
  '202610090011_order_requests.sql',
];
export async function buildStagingUpgrade() {
  const pieces = [`-- ONLY staging project tgvozhrkolcpszyyrgth, with migrations 001–005 already installed.
-- Additive upgrade, one transaction. Do not run on production or rerun on a partial/newer schema.
begin;
do $$
declare runtime record;
begin
  if to_regclass('gd_private.runtime') is null or to_regclass('public.gd_orders') is null
    then raise exception 'UPGRADE_REQUIRES_BASELINE_005'; end if;
  select environment,project_ref into runtime from gd_private.runtime where id=1 for update;
  if runtime.environment is distinct from 'staging' or runtime.project_ref is distinct from 'tgvozhrkolcpszyyrgth'
    then raise exception 'UPGRADE_REQUIRES_EXACT_STAGING_PROJECT'; end if;
  if exists(select 1 from pg_attribute where attrelid='public.gd_products'::regclass and attname='images' and not attisdropped)
    or to_regclass('public.gd_product_variants') is not null
    or to_regclass('public.gd_delivery_settings') is not null
    or to_regclass('public.gd_order_staff_notes') is not null
    or to_regclass('public.gd_order_requests') is not null
    then raise exception 'UPGRADE_REQUIRES_BASELINE_005'; end if;
end;
$$;`];
  for (const name of names) {
    const source = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
    if (!/^begin;\s*\n/i.test(source) || !/\ncommit;\s*$/i.test(source))
      throw new Error(`Migration transaction wrapper changed: ${name}`);
    pieces.push(`-- ${name}\n${source.replace(/^begin;\s*\n/i, '').replace(/\ncommit;\s*$/i, '')}`);
  }
  pieces.push('commit;\nselect public.gd_environment() as upgraded_environment;');
  return pieces.join('\n\n') + '\n';
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await writeFile(new URL('../supabase/staging-upgrade-005-to-011.sql', import.meta.url), await buildStagingUpgrade());
  console.log('Prepared staging-upgrade-005-to-011.sql; no database connection or execution.');
}
