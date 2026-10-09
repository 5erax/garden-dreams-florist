import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../src/auth-error.js";

test("server errors are distinguished from credentials without exposing provider details", () => {
  assert.match(authErrorMessage({ status: 500, code: "unexpected_failure", message: "Error sending confirmation email" }), /Chưa gửi được email xác nhận/);
  const message = authErrorMessage({ status: 500, code: "unexpected_failure", message: "SMTP secret and private@example.com" });
  assert.match(message, /Dịch vụ tài khoản đang gặp lỗi/);
  assert.doesNotMatch(message, /SMTP|secret|private@|mật khẩu/);
  assert.equal(authErrorMessage({ status: 503 }), message);
});
test("known account and sending errors offer appropriate recovery", () => {
  assert.match(authErrorMessage({ code: "invalid_credentials" }), /khôi phục mật khẩu/);
  assert.match(authErrorMessage({ code: "email_not_confirmed" }), /Spam/);
  assert.match(authErrorMessage({ code: "weak_password" }), /12 ký tự/);
  for (const code of ["over_email_send_rate_limit", "over_request_rate_limit"])
    assert.match(authErrorMessage({ code }), /Chờ vài phút/);
  assert.match(authErrorMessage({ status: 429 }), /Chờ vài phút/);
  for (const code of ["email_address_not_authorized", "email_provider_disabled", "signup_disabled"])
    assert.match(authErrorMessage({ code }), /liên hệ cửa hàng/);
});
test("network and unknown failures remain safe including account-existence errors", () => {
  assert.match(authErrorMessage({ name: "AuthRetryableFetchError" }), /Kiểm tra Internet/);
  assert.match(authErrorMessage(new TypeError("sensitive transport data")), /Kiểm tra Internet/);
  for (const error of [null, undefined, { code: "email_exists", message: "private@example.com" }, { code: "toString" }]) {
    const message = authErrorMessage(error);
    assert.equal(typeof message, "string");
    assert.doesNotMatch(message, /private@|đã tồn tại|sensitive/);
  }
});

test("password recovery failures give a safe next action without provider text", () => {
  assert.match(authErrorMessage({ code: "same_password", message: "private@example.com" }), /khác mật khẩu hiện tại/);
  for (const code of ["session_not_found", "session_expired", "otp_expired"]) {
    const message = authErrorMessage({ code, message: "private@example.com token=secret" });
    assert.match(message, /email khôi phục mới/);
    assert.doesNotMatch(message, /private@|secret|token=/);
  }
});
