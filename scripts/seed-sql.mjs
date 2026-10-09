import { writeFile } from "node:fs/promises";
import { products } from "../src/catalog.js";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = products
  .map(
    (p) =>
      `(${p.id},${quote(p.name)},${quote(p.occasion)},${p.price},${quote(p.stems)},${quote(p.description)},${quote(p.image)},${p.featured})`,
  )
  .join(",\n");
await writeFile(
  new URL("../supabase/migrations/202610090003_catalog.sql", import.meta.url),
  `begin;\ninsert into public.gd_products(id,name,occasion,price,stems,description,image,featured) values\n${values}\non conflict(id) do nothing;\nselect setval('public.gd_products_id_seq',(select max(id) from public.gd_products));\ncommit;\n`,
);
