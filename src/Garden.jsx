import BloomLoader from "./BloomLoader.jsx";
import { useEffect, useState } from "react";
import { call } from "./backend.js";
import { useStore } from "./Store.jsx";
import Icon from "./Icons.jsx";

export default function Garden() {
  const { connected } = useStore();
  const [memories, setMemories] = useState([]),
    [count, setCount] = useState(0),
    [busy, setBusy] = useState(connected),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  async function load(append = false) {
    setBusy(true);
    setError("");
    try {
      const last = append ? memories.at(-1) : null;
      const rows = await call("gd_garden", {
        p_before: last?.createdAt || null,
        p_before_id: last?.id || null,
        p_limit: 24,
      });
      setMemories((old) => (append ? [...old, ...rows] : rows));
      setMore(rows.length === 24);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!connected) return;
    load();
    call("gd_memory_count")
      .then(setCount)
      .catch((e) => setError(e.message));
  }, [connected]);
  return (
    <>
      <section className="garden-intro">
        <span className="eyebrow">A GARDEN OF WORDS</span>
        <h1>
          Có những lời,
          <br />
          <em>ở lại thành hoa.</em>
        </h1>
        <p>
          Mỗi bó hoa đã đến tay người nhận, mỗi lời thương đã được gửi đi.
          <br />
          Một khu vườn lớn dần bằng những kỉ niệm.
        </p>
        <div className="garden-count">
          <Icon name="flower" />
          <strong>{new Intl.NumberFormat("vi-VN").format(count)}</strong>
          <span>dấu hoa từ những đơn hoàn tất</span>
        </div>
        <small>
          Lời nhắn chỉ xuất hiện khi người gửi chọn chia sẻ. Những kỉ niệm riêng
          vẫn được giữ riêng.
        </small>
      </section>
      <section
        className="memory-garden"
        aria-label="Những thông điệp được khách chia sẻ"
      >
        {memories.map((m, i) => (
          <a
            className={`memory-flower flower-tone-${i % 4}`}
            href={"#memory/" + m.token}
            key={m.id}
          >
            <div className="memory-flower-image">
              <img loading="lazy" src={m.flowerImage} alt={m.flowerName} />
              <Icon name="flower" />
            </div>
            <blockquote>{m.message}</blockquote>
            <span>{m.signature || "Một người gửi thương"}</span>
            <small>
              {new Intl.DateTimeFormat("vi-VN", {
                month: "long",
                year: "numeric",
              }).format(new Date(m.createdAt))}
            </small>
          </a>
        ))}
      </section>
      {!busy && !memories.length && !error && (
        <div className="portal-empty">
          <Icon name="flower" />
          <h2>
            Khu vườn đang chờ
            <br />
            <em>lời thương đầu tiên.</em>
          </h2>
          <p>
            {connected
              ? "Chưa có thông điệp được công khai."
              : "Cửa hàng đang ở bản trải nghiệm; chưa có đơn thật hoặc kỉ niệm thật được lưu."}
          </p>
          <a className="button outline" href="#collection">
            Chọn hoa cho một câu chuyện
          </a>
        </div>
      )}
      {more && (
        <button
          className="button outline garden-more"
          disabled={busy}
          onClick={() => load(true)}
        >
          Gặp thêm những lời thương
        </button>
      )}
      {busy && <BloomLoader label="Vườn kỉ niệm" />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function SharedMemory({ token }) {
  const { connected, shop } = useStore();
  const [memory, setMemory] = useState(null),
    [busy, setBusy] = useState(connected),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!connected) {
      setBusy(false);
      return;
    }
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        token,
      )
    ) {
      setBusy(false);
      return;
    }
    setBusy(true);
    call("gd_public_memory", { p_token: token })
      .then((data) => {
        if (active) setMemory(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [token, connected]);
  if (busy) return <BloomLoader label="Một lời thương" />;
  if (!memory)
    return (
      <div className="portal-empty">
        <Icon name="flower" />
        <h1>
          Tấm thiệp này
          <br />
          <em>đang được giữ riêng.</em>
        </h1>
        <p>
          {error ||
            "Đường dẫn không tồn tại, đã được rút chia sẻ hoặc cửa hàng chưa kết nối backend."}
        </p>
        <a className="button outline" href="#garden">
          Về vườn kỉ niệm
        </a>
      </div>
    );
  return (
    <article className="shared-card">
      <span className="eyebrow">A LITTLE LOVE, SENT WITH FLOWERS</span>
      <div className="shared-flower">
        <img src={memory.flowerImage} alt={memory.flowerName} />
      </div>
      <blockquote>{memory.message}</blockquote>
      <p className="shared-signature">
        {memory.signature
          ? "— " + memory.signature
          : "Một lời thương, từ người gửi ẩn danh."}
      </p>
      <div className="shared-card-footer">
        <Icon name="flower" />
        <p>
          Một dấu hoa tại {shop.name}
          <br />
          {new Intl.DateTimeFormat("vi-VN", {
            month: "long",
            year: "numeric",
          }).format(new Date(memory.createdAt))}
        </p>
      </div>
      <a className="text-link" href="#garden">
        Gặp những lời thương khác →
      </a>
    </article>
  );
}
