import { useState } from "react";
import { backend } from "./backend.js";
import { RememberGuest } from "./GuestCheckout.jsx";

export default function GuestAccount() {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  return <section className="guest-account">
    <h2>Góc riêng của phiên khách</h2>
    <RememberGuest />
    <p>Để xem đơn trên thiết bị khác và giữ lịch sử lâu dài, bạn có thể gắn email với phiên này. Các đơn và lời nhắn vẫn thuộc cùng tài khoản.</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setNotice(""); setError("");
      const email = new FormData(event.currentTarget).get("email");
      try {
        const { error } = await backend.auth.updateUser({ email, data: { gd_needs_password: true } }, { emailRedirectTo: location.origin + "/#account" });
        if (error) throw error;
        setNotice("Mở email xác nhận trên thiết bị này, rồi đặt mật khẩu tại Góc của tôi. Chỉ rời phiên khách sau khi đã hoàn tất; nếu email đã có tài khoản, dùng một email khác.");
      } catch { setError("Chưa gắn được email. Kiểm tra email và kết nối; không tạo tài khoản khác để thay thế lịch sử của phiên này."); }
      finally { setBusy(false); }
    }}>
      <label>Email của bạn<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></label>
      <button className="button outline" disabled={busy}>Gắn email để giữ lịch sử</button>
    </form>
    {notice && <p className="portal-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
