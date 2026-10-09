// Generates a reviewable SQL file; never connects to any database.
import { readFile, readdir, writeFile } from "node:fs/promises";
const directory = new URL("../supabase/", import.meta.url);
const files = (await readdir(new URL("migrations/", directory)))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const guard = `-- ONLY run on https://supabase.com/dashboard/project/tgvozhrkolcpszyyrgth/sql
-- Fresh staging project only. Never run on production; never reset an existing database.
do $$
begin
  if to_regclass('public.gd_shop') is not null or exists(select 1 from auth.users) then raise exception 'STAGING_SETUP_REQUIRES_EMPTY_PROJECT'; end if;
end;
$$;
`;
const parts = [guard];
for (const file of files)
  parts.push(
    `-- ${file}\n${await readFile(new URL("migrations/" + file, directory), "utf8")}`,
  );
parts.push(await readFile(new URL("staging-init.sql", directory), "utf8"));
await writeFile(new URL("staging-setup.sql", directory), parts.join("\n"));
console.log(
  "Generated supabase/staging-setup.sql for the empty staging project only.",
);
