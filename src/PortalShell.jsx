import { useState } from "react";
import { backend, guestSessionStorage } from "./backend.js";
import { useStore } from "./Store.jsx";
import Icon from "./Icons.jsx";
import { shopAddress, displayPhone } from "./shop-contact.js";
import { Modal } from "./ShopDialogs.jsx";
import { authErrorMessage } from "./auth-error.js";

export function PortalShell({ children, cartCount = 0, onCart }) {
  const { shop, session, isAdmin } = useStore();
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false), [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true); setError("");
    try {
      const { error } = await backend.auth.signOut();
      if (error) throw error;
      guestSessionStorage.setRemember(false);
      setLeaving(false); location.hash = "#account";
    } catch { setError("Chưa đăng xuất được. Thử lại khi kết nối ổn định."); }
    finally { setBusy(false); }
  }
  return (
    <div className={'portal'+(location.hash==='#admin'?' admin-shell':'')}>
      <header className="portal-header">
        <a className="brand" href="/">
          <Icon name="flower" />
          <span>{shop.name}</span>
        </a>
        <nav aria-label="Điều hướng cửa hàng">
          {location.hash!=='#admin'&&<a href="/#collection">Bộ sưu tập</a>}
          {location.hash!=='#admin'&&<a href="/#story">Câu chuyện</a>}
          <a hidden={location.hash==='#admin'} href="#garden" aria-current={location.hash === '#garden' ? 'page' : undefined}>Vườn kỷ niệm</a>
          <a hidden={location.hash==='#admin'} href="#account" aria-current={location.hash === '#account' ? 'page' : undefined}>Góc của tôi</a>
          {isAdmin && <a href="#admin" aria-current={location.hash==='#admin'?'page':undefined}>Quản trị cửa hàng</a>}
        </nav>
        <button hidden={location.hash==='#admin'} className="cart-trigger portal-cart" onClick={onCart} aria-label={`Mở giỏ hoa, ${cartCount} bó`}><Icon name="bag" /><span>Giỏ hoa</span><span className="cart-count">{cartCount}</span></button>
        {session && (
          <button
            className="portal-signout"
            disabled={busy}
            onClick={() => session.user.is_anonymous ? setLeaving(true) : signOut()}
          >
            Đăng xuất
          </button>
        )}
      </header>
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      <main className="portal-main">{children}</main>
      {leaving && <Modal title="Rời phiên khách" className="info-dialog" onClose={() => { if (!busy) setLeaving(false); }}>
        <h2>Giữ lại <em>góc của bạn.</em></h2>
        <p>Đăng xuất sẽ mất đường truy cập lịch sử của phiên khách này. Gắn email và xác nhận tài khoản trong Góc của tôi trước khi rời phiên để giữ lại đơn và lời nhắn.</p>
        <button className="button primary" disabled={busy} onClick={() => setLeaving(false)}>Giữ phiên khách</button>
        <button className="button outline" disabled={busy} onClick={signOut}>Vẫn đăng xuất</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </Modal>}
      <footer className="portal-footer">
        {shop.name} · Những lời thương được giữ lại.
        <a href={`tel:${shop.phone}`}>{displayPhone(shop.phone)}</a>
        <a href={`https://zalo.me/${shop.phone.replace(/^\+84/, '0')}`} target="_blank" rel="noreferrer">Trao đổi qua Zalo</a>
        <address>{shop.address || shopAddress}</address><span className="shop-hours">Mở cửa {(shop.opens_at||'08:00').slice(0,5)}–{(shop.closes_at||'17:00').slice(0,5)}</span>
      </footer>
    </div>
  );
}
export function BackendNotice() {
  return (
    <div className="portal-empty">
      <Icon name="flower" />
      <h2>Một góc đang được chăm chút.</h2>
      <p>
        Tài khoản, đơn hoa và kỷ niệm sẽ khả dụng khi cửa hàng kết nối backend.
        Hiện chưa có dữ liệu khách hàng được lưu.
      </p>
      <a className="button outline" href="/#collection">
        Khám phá bộ sưu tập
      </a>
    </div>
  );
}
export function AuthPanel() {
  const { connected } = useStore();
  const [showPassword,setShowPassword]=useState(false);
  const [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  if (!connected) return <BackendNotice />;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "reset") {
        const { error } = await backend.auth.resetPasswordForEmail(
          fields.email,
          { redirectTo: location.origin + "/#account" },
        );
        if (error) throw error;
        setNotice(
          "Nếu địa chỉ hợp lệ, hướng dẫn khôi phục sẽ được gửi qua email.",
        );
      } else if (mode === "signup") {
        const { data, error } = await backend.auth.signUp({
          email: fields.email,
          password: fields.password,
          options: { emailRedirectTo: location.origin + "/#account" },
        });
        if (error) throw error;
        if (!data.session)
          setNotice(
            "Kiểm tra email để xác nhận tài khoản trước khi đăng nhập.",
          );
      } else {
        const { error } = await backend.auth.signInWithPassword({
          email: fields.email,
          password: fields.password,
        });
        if (error) throw error;
      }
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card" aria-busy={busy}>
      <span className="eyebrow">GÓC NHỎ CỦA BẠN</span>
      <h1>
        {mode === "reset" ? "Khôi phục" : mode === "signup" ? "Bắt đầu một" : "Trở về"}
        <br />
        <em>góc của bạn.</em>
      </h1>
      <p>{mode === "reset" ? "Nhập email của tài khoản để nhận liên kết đặt mật khẩu mới. Kiểm tra cả hộp thư và mục Spam." : "Lịch sử những bó hoa. Những lời thương bạn đã gửi."}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          {mode !== "reset" && (
            <label>
              Mật khẩu
              <input
                name="password"
                type={showPassword?"text":"password"}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={mode === "signup" ? 12 : 1}
                required
                maxLength={128}
              />
            </label>
          )}
          {mode!=="reset" && <button type="button" className="text-button password-toggle" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?"Ẩn mật khẩu":"Hiện mật khẩu"}</button>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="portal-notice" role="status">
              {notice}
            </p>
          )}
          <button className="button primary" type="submit">
            {busy
              ? "Đang xử lý…"
              : mode === "signup"
                ? "Tạo tài khoản"
                : mode === "reset"
                  ? "Gửi hướng dẫn khôi phục"
                  : "Đăng nhập"}
            <Icon name="arrow" />
          </button>
        </fieldset>
      </form>
      <div className="auth-options">
        {mode !== "signup" && (
          <button
            className="button outline"
            disabled={busy}
            onClick={() => {
              setMode("signup");
              setError("");
              setNotice("");
            }}
          >
            Tạo tài khoản
          </button>
        )}
        {mode !== "login" && (
          <button className="text-button" disabled={busy} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>
            Đăng nhập
          </button>
        )}
        {mode === "login" && (
          <button className="text-button" disabled={busy} onClick={() => { setMode("reset"); setError(""); setNotice(""); }}>
            Quên mật khẩu
          </button>
        )}
      </div>
      <small>
        Phiên đăng nhập được giữ trong tab này để bạn quay lại sau khi mở ứng dụng ngân hàng hoặc tải lại trang. Đóng tab sẽ kết thúc việc lưu phiên trong tab; dùng thiết bị chung hãy đăng xuất khi xong. Mật khẩu không được lưu trên website.
      </small>
    </section>
  );
}
