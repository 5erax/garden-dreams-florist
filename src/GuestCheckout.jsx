import { useState } from "react";
import { backend, guestSessionStorage } from "./backend.js";
import { startGuestSession } from "./guest-session.js";
import { AuthPanel } from "./PortalShell.jsx";

export function RememberGuest() {
  const [remember, setRemember] = useState(guestSessionStorage.remember);
  return <label className="consent guest-remember">
    <input type="checkbox" checked={remember} onChange={event => {
      setRemember(event.target.checked);
      guestSessionStorage.setRemember(event.target.checked);
    }} />
    <span>Giữ phiên khách trên thiết bị này để xem lại đơn. Không chọn nếu dùng máy chung; nếu không giữ, hãy tạo tài khoản trước khi rời trang.</span>
  </label>;
}

export default function GuestCheckout() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [login, setLogin] = useState(false);
  if (login) return <><button className="text-button" onClick={() => setLogin(false)}>← Đặt hoa với tư cách khách</button><AuthPanel /></>;
  return <section className="guest-start">
    <span className="eyebrow">ĐẶT HOA TRONG VÀI BƯỚC</span>
    <h2>Gửi một bó hoa.<br /><em>Không cần tạo tài khoản.</em></h2>
    <p>Chọn ngày giao, điền người nhận và thanh toán trong cùng một bước. Lịch sử đơn và lời nhắn được giữ riêng cho phiên khách của bạn.</p>
    <RememberGuest />
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try { await startGuestSession(backend.auth); }
      catch { setError("Chưa mở được phiên khách. Thử lại hoặc đăng nhập để tiếp tục."); }
      finally { setBusy(false); }
    }}>{busy ? "Đang mở bước đặt hoa…" : "Tiếp tục đặt hoa"}</button>
    <button className="text-button" disabled={busy} onClick={() => setLogin(true)}>Đã có tài khoản? Đăng nhập</button>
  </section>;
}
