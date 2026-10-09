import test from "node:test";
import assert from "node:assert/strict";
import { guestStorage, startGuestSession } from "../src/guest-session.js";

const guest = JSON.stringify({ user: { id: "guest-one", is_anonymous: true }, access_token: "fixture" });
const account = JSON.stringify({ user: { id: "account-one", is_anonymous: false }, access_token: "fixture" });
function device() {
  const values = new Map();
  return { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name) };
}
test("guest persistence requires explicit consent and never stores normal account tokens", () => {
  const disk = device(), storage = guestStorage("project", disk);
  storage.setItem("project", guest);
  assert.equal(storage.getItem("project"), guest);
  assert.equal(disk.getItem("project"), null);
  storage.setRemember(true);
  const restored = guestStorage("project", disk);
  assert.equal(restored.getItem("project"), guest);
  restored.setRemember(false);
  assert.equal(restored.getItem("project"), guest);
  restored.setRemember(true);
  assert.equal(disk.getItem("project"), guest);
  assert.equal(guestStorage("other-project", disk).getItem("other-project"), null);
  storage.setItem("project", account);
  assert.equal(storage.getItem("project"), account);
  assert.equal(disk.getItem("project"), null);
  assert.equal(guestStorage("project", disk).getItem("project"), null);
});
test("revoking consent and signout clear persistent guests; malformed/account sessions are refused", () => {
  const disk = device(), storage = guestStorage("project", disk);
  storage.setRemember(true); storage.setItem("project", guest);
  storage.setRemember(false);
  assert.equal(disk.getItem("project"), null);
  assert.equal(storage.getItem("project"), guest);
  storage.setRemember(true); storage.removeItem("project");
  assert.equal(storage.getItem("project"), null);
  for (const value of ["not-json", account, JSON.stringify({user:{is_anonymous:"true"}})]) {
    disk.setItem("project", value);
    assert.equal(guestStorage("project", disk).getItem("project"), null);
  }
});
test("blocked device storage preserves a memory session without crashing", () => {
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  const storage = guestStorage("project", blocked);
  storage.setRemember(true); storage.setItem("project", guest);
  assert.equal(storage.getItem("project"), guest);
  storage.removeItem("project"); assert.equal(storage.getItem("project"), null);
});
test("concurrent checkout starts share one identity and reuse existing accounts", async () => {
  let count = 0;
  const session = { user: { id: "guest" } };
  const auth = { getSession: async () => ({data:{session:null}}), signInAnonymously: async () => { count++; return {data:{session}}; } };
  assert.deepEqual(await Promise.all([startGuestSession(auth), startGuestSession(auth)]), [session,session]);
  assert.equal(count, 1);
  auth.getSession = async () => ({data:{session}});
  assert.equal(await startGuestSession(auth), session); assert.equal(count, 1);
});
test("failed guest start can retry and never returns an unauthenticated identity", async () => {
  const auth = { getSession: async () => ({data:{session:null}}), signInAnonymously: async () => ({error:Error("disabled")}) };
  await assert.rejects(startGuestSession(auth), /disabled/);
  auth.signInAnonymously = async () => ({data:{session:null}});
  await assert.rejects(startGuestSession(auth), /GUEST_SESSION_MISSING/);
  auth.signInAnonymously = async () => ({data:{session:{user:{id:"retry"}}}});
  assert.equal((await startGuestSession(auth)).user.id, "retry");
});
