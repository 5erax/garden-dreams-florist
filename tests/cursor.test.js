import { test } from "node:test";
import assert from "node:assert/strict";
import { beforeCursor } from "../src/cursor.js";
test("order cursors preserve PostgreSQL microseconds and reject filter injection", () => {
  let filter;
  const query = {
    or(value) {
      filter = value;
      return this;
    },
  };
  const last = {
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-10-09T12:34:56.123456+00:00",
  };
  assert.equal(beforeCursor(query, null), query);
  assert.equal(beforeCursor(query, last), query);
  assert.ok(filter.includes(last.created_at));
  assert.ok(filter.includes("id.lt." + last.id));
  assert.throws(() =>
    beforeCursor(query, { ...last, created_at: last.created_at + ",id.gt.0" }),
  );
  assert.throws(() => beforeCursor(query, { ...last, id: "bad-id" }));
});
