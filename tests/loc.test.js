import test from "node:test";
import assert from "node:assert/strict";
import { lineCounts, measureLoc } from "../scripts/measure-loc.mjs";

test("LOC treats CRLF, a final newline and blank lines consistently", () => {
  assert.deepEqual(lineCounts("first\r\n\r\n  \r\nlast\r\n"), {physical:4,nonblank:2});
  assert.deepEqual(lineCounts(""), {physical:0,nonblank:0});
  assert.deepEqual(lineCounts("last"), {physical:1,nonblank:1});
});
test("LOC excludes duplicated setup SQL and only counts the agreed source roots", async () => {
  const report = await measureLoc();
  assert.equal(report.groups.some(group => group.directory === "supabase"), false);
  assert.equal(report.total.nonblank, report.groups.reduce((total, group) => total + group.nonblank, 0));
  assert.ok(report.total.physical >= report.total.nonblank);
});
