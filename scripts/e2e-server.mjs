// Local-only test transport; production uses Supabase Auth/PostgREST, never this server.
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const users = {
  "alice@example.test": {
    id: "11111111-1111-4111-8111-111111111111",
    email: "alice@example.test",
  },
  "bob@example.test": {
    id: "22222222-2222-4222-8222-222222222222",
    email: "bob@example.test",
  },
  "admin@example.test": {
    id: "33333333-3333-4333-8333-333333333333",
    email: "admin@example.test",
  },
};
const secret = "local-test-key-never-used-in-production";
const sign = (value) =>
  createHmac("sha256", secret).update(value).digest("base64url");
const token = (user) => {
  const value =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url");
  return value + "." + sign(value);
};
function decode(value) {
  try {
    const [h, p, s] = value.split("."),
      expected = sign(h + "." + p);
    if (
      s.length !== expected.length ||
      !timingSafeEqual(Buffer.from(s), Buffer.from(expected))
    )
      return null;
    const data = JSON.parse(Buffer.from(p, "base64url"));
    return Object.values(users).find(
      (u) => u.id === data.sub && data.exp > Date.now() / 1000,
    );
  } catch {
    return null;
  }
}
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
);
for (const u of Object.values(users))
  await db.query("insert into auth.users values($1)", [u.id]);
for (const file of (
  await readdir(new URL("../supabase/migrations/", import.meta.url))
)
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
await db.query("insert into public.gd_admins values($1)", [
  users["admin@example.test"].id,
]);
await db.exec(
  "update gd_private.runtime set environment='local',project_ref=null;",
);
await db.exec(
  "update public.gd_shop set accepting_orders=true,transfer_enabled=true,bank_bin='970436',bank_account='000000000000',bank_name='Ngân hàng kiểm thử — KHÔNG CHUYỂN TIỀN',account_name='TEST ONLY'; update public.gd_shipping set name='Giao hoa nội thành',area='Khu vực giả để kiểm thử',active=true,fee=30000;",
);
let queue = Promise.resolve();
const tables = new Set([
  "gd_shop",
  "gd_products",
  "gd_product_variants",
  "gd_shipping",
  "gd_admins",
  "gd_orders",
  "gd_order_events",
  "gd_memories",
  "gd_admin_audit",
]);
const functions = {
  gd_environment: [],
  gd_create_order: ["p_request"],
  gd_update_order: ["p_id", "p_version", "p_status", "p_payment", "p_note"],
  gd_share_memory: ["p_id", "p_visibility", "p_signature"],
  gd_public_memory: ["p_token"],
  gd_garden: ["p_before", "p_before_id", "p_limit"],
  gd_memory_count: [],
};
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5175");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 20000) {
      res.writeHead(413);
      res.end("{}");
      return;
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  } catch {
    res.writeHead(400);
    res.end("{}");
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:54321");
  const user = decode(
    (req.headers.authorization || "").replace(/^Bearer /, ""),
  );
  const send = (value, status = 200) => {
    res.writeHead(status);
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/auth/v1/token") {
    const u = users[body.email];
    if (!u || body.password !== "Garden-test-only-2026") {
      send(
        { msg: "Invalid credentials", error_code: "invalid_credentials" },
        400,
      );
      return;
    }
    send({
      access_token: token(u),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "test-refresh-only",
      user: {
        ...u,
        aud: "authenticated",
        role: "authenticated",
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
      },
    });
    return;
  }
  if (url.pathname === "/auth/v1/logout") {
    send({});
    return;
  }
  if (url.pathname === "/auth/v1/user") {
    send(
      user
        ? { ...user, app_metadata: {}, user_metadata: {} }
        : { msg: "Not authenticated" },
      user ? 200 : 401,
    );
    return;
  }
  if (!url.pathname.startsWith("/rest/v1/")) {
    send({ message: "Not found" }, 404);
    return;
  }
  const work = async () => {
    await db.exec(`set role ${user ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user?.id || "",
    ]);
    try {
      const resource = url.pathname.slice("/rest/v1/".length);
      if (resource.startsWith("rpc/")) {
        const name = resource.slice(4),
          keys = functions[name];
        if (!keys) throw new Error("Unknown function");
        const args = keys.map((k) => body[k] ?? null);
        send(
          (
            await db.query(
              `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
              args,
            )
          ).rows[0].value,
        );
        return;
      }
      if (!tables.has(resource)) throw new Error("Unknown table");
      const args = [],
        where = [];
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "limit", "or"].includes(key)) continue;
        if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid column");
        const op = value.slice(0, value.indexOf(".")),
          v = value.slice(value.indexOf(".") + 1);
        if (!["eq", "lt", "gt"].includes(op)) throw new Error("Invalid filter");
        args.push(v);
        where.push(
          `"${key}" ${op === "eq" ? "=" : op === "lt" ? "<" : ">"} $${args.length}`,
        );
      }
      const cursor = url.searchParams.get("or");
      if (cursor) {
        const match = cursor.match(
          /^\(created_at\.lt\.([^,]+),and\(created_at\.eq\.[^,]+,id\.lt\.([a-f0-9-]+)\)\)$/i,
        );
        if (!match) throw new Error("Invalid cursor");
        args.push(match[1], match[2]);
        where.push(
          `(created_at,id)<($${args.length - 1}::timestamptz,$${args.length}::uuid)`,
        );
      }
      const clause = where.length ? " where " + where.join(" and ") : "";
      let rows;
      if (req.method === "GET") {
        const columns = url.searchParams.get("select") || "*";
        if (!/^[a-z_*,]+$/.test(columns)) throw new Error("Invalid columns");
        const ordering = (url.searchParams.get("order") || "")
          .split(",")
          .filter(Boolean)
          .map((o) => {
            const [key, dir] = o.split(".");
            if (!/^[a-z_]+$/.test(key) || !["asc", "desc"].includes(dir))
              throw new Error("Invalid order");
            return `"${key}" ${dir}`;
          });
        const limit = Math.min(
          1000,
          Number(url.searchParams.get("limit")) || 1000,
        );
        rows = (
          await db.query(
            `select ${columns} from public.${resource}${clause}${ordering.length ? " order by " + ordering.join(",") : ""} limit ${limit}`,
            args,
          )
        ).rows;
      } else if (["POST", "PATCH"].includes(req.method)) {
        const fields = Object.keys(body);
        if (!fields.length || fields.some((k) => !/^[a-z_]+$/.test(k)))
          throw new Error("Invalid fields");
        if (req.method === "PATCH") {
          const sets = fields.map((k) => {
            args.push(body[k]);
            return `"${k}"=$${args.length}`;
          });
          rows = (
            await db.query(
              `update public.${resource} set ${sets.join(",")}${clause} returning *`,
              args,
            )
          ).rows;
        } else
          rows = (
            await db.query(
              `insert into public.${resource}(${fields.join(",")}) values(${fields.map((_, i) => "$" + (i + 1)).join(",")}) returning *`,
              fields.map((k) => body[k]),
            )
          ).rows;
      } else throw new Error("Invalid method");
      const object = req.headers.accept?.includes("vnd.pgrst.object");
      if (object && rows.length !== 1) {
        send(
          {
            code: "PGRST116",
            details: `The result contains ${rows.length} rows`,
            message: "JSON object requested, multiple (or no) rows returned",
          },
          406,
        );
        return;
      }
      send(object ? rows[0] : rows);
    } catch (e) {
      send({ message: e.message, code: e.code || "TEST_ERROR" }, 400);
    } finally {
      await db.exec("reset role");
    }
  };
  queue = queue.then(work, work);
  await queue;
});
server.listen(54321, "127.0.0.1", () =>
  console.log(
    "Local PostgreSQL test API on http://127.0.0.1:54321. Synthetic accounts only; no real orders/payments.",
  ),
);
