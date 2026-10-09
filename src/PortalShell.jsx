import { useState } from "react";
import { backend, guestSessionStorage } from "./backend.js";
import { useStore } from "./Store.jsx";
import Icon from "./Icons.jsx";
import { shopAddress } from "./shop-contact.js";
import { Modal } from "./ShopDialogs.jsx";

export function PortalShell({ children }) {
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
    <div className="portal">
      <header className="portal-header">
        <a className="brand" href="#home">
          <Icon name="flower" />
          <span>{shop.name}</span>
        </a>
        <nav aria-label="Điều hướng cửa hàng">
          <a href="#collection">Chọn hoa</a>
          <a href="#garden">Vườn kỉ niệm</a>
          <a href="#account">Góc của tôi</a>
          {isAdmin && <a href="#admin">Quản trị</a>}
        </nav>
        {session && (
          <button
            className="text-button"
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
        <a href={`tel:${shop.phone}`}>{shop.phone}</a>
        <address>{shop.address || shopAddress}</address>
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
        Tài khoản, đơn hoa và kỉ niệm sẽ khả dụng khi cửa hàng kết nối backend.
        Hiện chưa có dữ liệu khách hàng được lưu.
      </p>
      <a className="button outline" href="#collection">
        Khám phá bộ sưu tập
      </a>
    </div>
  );
}
export function AuthPanel() {
  const { connected } = useStore();
  const [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  if (!connected) return <BackendNotice />;
  async function submit(event) {
    event.preventDefault();
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
    } catch {
      setError(
        "Chưa thực hiện được. Kiểm tra email, mật khẩu và kết nối rồi thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card">
      <span className="eyebrow">YOUR LITTLE CORNER</span>
      <h1>
        {mode === "signup" ? "Bắt đầu một" : "Trở về"}
        <br />
        <em>góc của bạn.</em>
      </h1>
      <p>Lịch sử những bó hoa. Những lời thương bạn đã gửi.</p>
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
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={mode === "signup" ? 12 : 1}
                required
                maxLength={128}
              />
            </label>
          )}
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
            className="text-button"
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
          <button className="text-button" onClick={() => setMode("login")}>
            Đăng nhập
          </button>
        )}
        {mode === "login" && (
          <button className="text-button" onClick={() => setMode("reset")}>
            Quên mật khẩu
          </button>
        )}
      </div>
      <small>
        Phiên đăng nhập chỉ được giữ trong bộ nhớ của tab. Cửa hàng không lưu
        mật khẩu hay token trong localStorage.
      </small>
    </section>
  );
}
