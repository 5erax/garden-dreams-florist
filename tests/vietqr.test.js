import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, vietqrPayload } from "../src/vietqr.js";
const fields = (s) => {
  const out = {};
  for (let i = 0; i < s.length; ) {
    const id = s.slice(i, i + 2),
      n = Number(s.slice(i + 2, i + 4));
    out[id] = s.slice(i + 4, i + 4 + n);
    i += 4 + n;
  }
  return out;
};
test("VietQR includes bank, beneficiary, exact VND amount/reference and a valid CRC", () => {
  assert.equal(crc16("123456789"), "29B1");
  const text = vietqrPayload(
    { bin: "970436", account: "123456789" },
    810000,
    "GD-ABCDEF1234567890",
  );
  const f = fields(text),
    merchant = fields(f["38"]),
    account = fields(merchant["01"]);
  assert.equal(f["01"], "12");
  assert.equal(f["53"], "704");
  assert.equal(f["54"], "810000");
  assert.equal(f["58"], "VN");
  assert.deepEqual(account, { "00": "970436", "01": "123456789" });
  assert.equal(merchant["00"], "A000000727");
  assert.equal(fields(f["62"])["08"], "GD-ABCDEF1234567890");
  assert.equal(f["63"], crc16(text.slice(0, -4)));
  assert.throws(() =>
    vietqrPayload({ bin: "bad", account: "1234" }, 1, "GD-1"),
  );
  assert.throws(() =>
    vietqrPayload({ bin: "970436", account: "1234" }, 1.1, "GD-1"),
  );
});
