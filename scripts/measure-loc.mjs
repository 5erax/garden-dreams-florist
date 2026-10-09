import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const sourceRoots = ["src", "api", "scripts", "tests", "supabase/migrations"];
export function lineCounts(content) {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return { physical: lines.length, nonblank: lines.filter(line => line.trim()).length };
}

export async function measureLoc(root = new URL("../", import.meta.url)) {
  const groups = [];
  for (const name of sourceRoots) {
    const directory = new URL(`${name}/`, root);
    let files = 0, physical = 0, nonblank = 0;
    for (const entry of await readdir(directory, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !/\.(js|jsx|mjs|css|sql)$/.test(entry.name)) continue;
      const content = await readFile(resolve(entry.parentPath, entry.name), "utf8");
      const count = lineCounts(content);
      files++; physical += count.physical; nonblank += count.nonblank;
    }
    groups.push({ directory: name, files, physical, nonblank });
  }
  return {
    measuredAt: new Date().toISOString(),
    policy: "Canonical authored source, SQL migrations and tests; includes comments, excludes blank lines from nonblank; excludes dependencies, docs, lockfiles, build output and duplicated setup bundles.",
    groups,
    total: groups.reduce((sum, group) => ({ files: sum.files + group.files, physical: sum.physical + group.physical, nonblank: sum.nonblank + group.nonblank }), { files: 0, physical: 0, nonblank: 0 }),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await measureLoc(), null, 2));
}
