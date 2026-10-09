import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { occasions, money } from "./catalog.js";
import { normalizeCart, cartKey } from "./order.js";
import {
  CartDialog,
  CheckoutDialog,
  Modal,
  ProductDialog,
} from "./ShopDialogs.jsx";
import Icon from "./Icons.jsx";
import { useStore } from "./Store.jsx";
import { PortalShell } from "./PortalShell.jsx";
import CustomerPortal from "./CustomerPortal.jsx";
import AdminPortal from "./AdminPortal.jsx";
import Garden, { SharedMemory } from "./Garden.jsx";
import LiveCheckout from "./LiveCheckout.jsx";
import "./portal.css";

function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function Reveal({ children, className = "" }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Hero() {
  const { shop } = useStore();
  const [first, ...rest] = shop.name.split(/\s+/);
  const ref = useRef(null),
    video = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const videoY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  useEffect(() => {
    if (reduced) video.current?.pause();
  }, [reduced]);
  return (
    <section
      className="hero"
      id="home"
      ref={ref}
      aria-label="Garden Dreams — Hoa mang lời thương"
    >
      <motion.div className="hero-video" style={{ y: reduced ? 0 : videoY }}>
        <video
          ref={video}
          autoPlay={!reduced}
          loop
          muted
          playsInline
          preload="metadata"
          poster="/flowers/bouquet_5.webp"
          aria-hidden="true"
        >
          <source src="/hero_bg.mp4" type="video/mp4" />
        </video>
      </motion.div>
      <div className="hero-shade" />
      <img
        className="flower-frame frame-left"
        src="/flowers/cherry_blossom_frame.webp"
        alt=""
      />
      <img
        className="flower-frame frame-right"
        src="/flowers/cherry_blossom_frame.webp"
        alt=""
      />
      <div className="petals" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i
            key={i}
            style={{
              "--left": `${(i * 23 + 9) % 100}%`,
              "--delay": `${-i * 2.7}s`,
              "--duration": `${15 + (i % 5)}s`,
            }}
          />
        ))}
      </div>
      <motion.div
        className="hero-copy"
        style={{ y: reduced ? 0 : textY }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <p className="eyebrow">Hoa mang lời thương</p>
        <h1>
          {first}
          <br />
          <em>{rest.join(" ")}</em>
          <span className="hero-star">✳</span>
        </h1>
        <p className="hero-subtitle">
          Một chút dịu dàng,
          <br className="mobile-break" /> dành cho người bạn thương.
        </p>
        <a className="button hero-cta" href="#collection">
          Chọn một bó hoa <Icon name="arrow" />
        </a>
      </motion.div>
      <div className="hero-bottom">
        <p>
          Được tạo nên từ thiên nhiên.
          <br />
          Được chọn bằng cả tấm lòng.
        </p>
        <a href="#collection" className="scroll-cue">
          Cuộn để gặp những đóa hoa <span>↓</span>
        </a>
        <p className="hero-edition">
          The floral collection
          <br />
          <span>20 bó hoa · 20 lời thương</span>
        </p>
      </div>
    </section>
  );
}

export default function App() {
  const {
    products,
    shop,
    connected,
    session,
    isAdmin,
    loading,
    error: storeError,
  } = useStore();
  const [storedCart, setCart] = useState(() => readStored("gd-cart", []));
  const cart = normalizeCart(storedCart, products);
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const changed = () => setRoute(location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const [favorites, setFavorites] = useState(() => {
    const ids = readStored("gd-favorites", []);
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
  });
  const [occasion, setOccasion] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(null);
  const selectedProduct = products.find(p => p.id === selected?.id);
  const [panel, setPanel] = useState(null);
  const [notice, setNotice] = useState("");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    try {
      if (!loading && !storeError)
        localStorage.setItem("gd-cart", JSON.stringify(cart));
    } catch {
      /* Shopping still works when browser storage is unavailable. */
    }
  }, [storedCart, products, loading, storeError]);
  useEffect(() => {
    try {
      localStorage.setItem("gd-favorites", JSON.stringify(favorites));
    } catch {
      /* Favorites remain available for this visit. */
    }
  }, [favorites]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 60);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  function changeCart(id, quantity, variantId) {
    const key = cartKey({ id, variantId });
    setCart((current) =>
      normalizeCart(
        quantity === 0
          ? normalizeCart(current, products).filter((line) => cartKey(line) !== key)
          : [
              ...normalizeCart(current, products).filter(
                (line) => cartKey(line) !== key,
              ),
              { id, quantity, variantId },
            ],
        products,
      ),
    );
  }
  function add(id, quantity = 1, variantId) {
    setCart((current) =>
      normalizeCart(
        [...normalizeCart(current, products), { id, quantity, variantId }],
        products,
      ),
    );
    setNotice(`Đã thêm ${products.find((p) => p.id === id).name} vào giỏ hoa`);
  }
  function favorite(id) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  function selectOccasion(value) {
    setOccasion(value);
    setShowAll(false);
    setOnlyFavorites(false);
  }
  let filtered = products.filter(
    (p) =>
      (occasion === "Tất cả" || p.occasion === occasion) &&
      (!onlyFavorites || favorites.includes(p.id)) &&
      `${p.name} ${p.stems}`
        .toLocaleLowerCase("vi")
        .includes(query.trim().toLocaleLowerCase("vi")),
  );
  if (sort === "low")
    filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sort === "high")
    filtered = [...filtered].sort((a, b) => b.price - a.price);
  const shown = showAll ? filtered : filtered.slice(0, 8);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  if (
    route === "#account" ||
    route === "#admin" ||
    route === "#garden" ||
    route.startsWith("#memory/")
  )
    return (
      <PortalShell>
        {route === "#account" ? (
          <CustomerPortal />
        ) : route === "#admin" ? (
          <AdminPortal />
        ) : route === "#garden" ? (
          <Garden />
        ) : (
          <SharedMemory key={route} token={route.slice(8)} />
        )}
      </PortalShell>
    );

  return (
    <>
      <a href="#collection" className="skip-link">
        Đến bộ sưu tập hoa
      </a>
      <header className={`header ${scrolled ? "is-scrolled" : ""}`}>
        <a
          className="brand"
          href="#home"
          aria-label="Garden Dreams — về đầu trang"
        >
          <Icon name="flower" />
          <span>{shop.name}</span>
        </a>
        <nav aria-label="Điều hướng chính">
          <a href="#collection">Bộ sưu tập</a>
          <a href="#story">Câu chuyện</a>
          <a href="#garden">Vườn kỉ niệm</a>
        </nav>
        <div className="header-actions">
          <a
            href="#account"
            className="icon-button account-link"
            aria-label={
              session ? "Góc kỉ niệm của tôi" : "Tài khoản & lịch sử mua"
            }
          >
            <Icon name="user" />
          </a>
          <button
            className={`icon-button ${onlyFavorites ? "is-favorite" : ""}`}
            aria-label="Xem hoa yêu thích"
            onClick={() => {
              setOnlyFavorites(!onlyFavorites);
              setShowAll(true);
              setOccasion("Tất cả");
              document
                .getElementById("collection")
                .scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Icon name="heart" />
          </button>
          <button
            className="cart-trigger"
            onClick={() => setPanel("cart")}
            aria-label={`Mở giỏ hoa, ${count} bó`}
          >
            <Icon name="bag" />
            <span className="cart-label">Giỏ hoa</span>
            <span className="cart-count">{count}</span>
          </button>
        </div>
      </header>
      <main>
        <Hero />
        {(loading || storeError) && (
          <p className="store-status" role={storeError ? "alert" : "status"}>
            {storeError || "Đang tải bộ sưu tập của cửa hàng…"}
          </p>
        )}
        <div className="service-strip">
          <span>
            <Icon name="flower" /> Hoa, trong sắc màu tự nhiên
          </span>
          <i>✳</i>
          <span>
            <Icon name="heart" /> Lời nhắn trên từng tấm thiệp
          </span>
          <i>✳</i>
          <span>
            <Icon name="leaf" /> Chăm chút đến cánh hoa cuối
          </span>
        </div>
        <section className="collection section-shell" id="collection">
          <Reveal className="section-heading">
            <div>
              <span className="eyebrow">The floral collection / 01</span>
              <h2>
                Một bó hoa.
                <br />
                <em>Thay ngàn lời.</em>
              </h2>
            </div>
            <div className="section-intro">
              <Icon name="flower" />
              <p>
                Cho ngày đặc biệt. Cho một người đặc biệt.
                <br />
                Hay đơn giản, cho chính bạn.
              </p>
              <span>Chọn một bó hoa để bắt đầu câu chuyện.</span>
            </div>
          </Reveal>
          <div className="collection-tools">
            <div
              className="filters"
              role="group"
              aria-label="Chọn dịp tặng hoa"
            >
              {occasions.map((value) => (
                <button
                  key={value}
                  className={
                    occasion === value && !onlyFavorites ? "active" : ""
                  }
                  aria-pressed={occasion === value && !onlyFavorites}
                  onClick={() => selectOccasion(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="search">
              <Icon name="search" />
              <input
                type="search"
                aria-label="Tìm hoa"
                placeholder="Tìm một bó hoa…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowAll(true);
                }}
              />
            </label>
          </div>
          <div className="collection-meta">
            <span>
              {onlyFavorites
                ? "Những bó hoa bạn đã yêu thích"
                : `${filtered.length} bó hoa dành cho bạn`}
              {onlyFavorites && (
                <button
                  className="text-button"
                  onClick={() => setOnlyFavorites(false)}
                >
                  Xem tất cả
                </button>
              )}
            </span>
            <label>
              Sắp xếp{" "}
              <select
                aria-label="Sắp xếp hoa"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="featured">Theo bộ sưu tập</option>
                <option value="low">Giá thấp đến cao</option>
                <option value="high">Giá cao đến thấp</option>
              </select>
            </label>
          </div>
          <div className="product-grid">
            {shown.map((product, index) => (
              <Reveal key={product.id}>
                <article className="product-card">
                  <div className={`product-image tone-${index % 4}`}>
                    <button
                      className="product-open"
                      onClick={() => setSelected(product)}
                      aria-label={`Xem ${product.name}`}
                    >
                      <img
                        src={product.image}
                        alt={`Bó hoa ${product.name}`}
                        loading="lazy"
                        width="600"
                        height="700"
                      />
                    </button>
                    <button
                      className={`favorite-button ${favorites.includes(product.id) ? "is-favorite" : ""}`}
                      aria-label={`${favorites.includes(product.id) ? "Bỏ lưu" : "Lưu"} ${product.name}`}
                      aria-pressed={favorites.includes(product.id)}
                      onClick={() => favorite(product.id)}
                    >
                      <Icon name="heart" />
                    </button>
                    <button
                      className="quick-add"
                      onClick={() => product.variants?.length ? setSelected(product) : add(product.id)}
                      aria-label={product.variants?.length ? `Chọn cỡ ${product.name}` : `Thêm ${product.name} vào giỏ`}
                    >
                      {product.variants?.length ? "Chọn cỡ bó" : "Thêm vào giỏ"} <Icon name="plus" />
                    </button>
                  </div>
                  <div className="product-copy">
                    <span className="eyebrow">{product.occasion}</span>
                    {product.featured && (
                      <span className="product-label">Được yêu thích</span>
                    )}
                    <h3>
                      <button onClick={() => setSelected(product)}>
                        {product.name}
                      </button>
                    </h3>
                    <div className="product-details">
                      <span>{product.stems}</span>
                      <div className="product-price">
                        <span>Tiêu chuẩn</span>
                        <strong>{money(product.price)}</strong>
                      </div>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Icon name="flower" />
              <h3>Chưa tìm thấy bó hoa phù hợp</h3>
              <p>Thử một từ khóa khác hoặc khám phá lại bộ sưu tập.</p>
              <button
                className="button primary"
                onClick={() => {
                  setQuery("");
                  setOccasion("Tất cả");
                  setOnlyFavorites(false);
                }}
              >
                Xem tất cả hoa
              </button>
            </div>
          )}
          {!showAll && filtered.length > 8 && (
            <div className="collection-more">
              <button
                className="button outline"
                onClick={() => setShowAll(true)}
              >
                Khám phá cả bộ sưu tập <span>{filtered.length}</span>
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </section>
        <section className="story" id="story">
          <div className="section-shell">
            <Reveal className="story-top">
              <span className="eyebrow">Rooted in love / 02</span>
              <h2>
                Từ một khu vườn nhỏ,
                <br />
                <em>đến những trái tim.</em>
              </h2>
              <p>
                Hoa không cần nói nhiều.
                <br />
                Một cánh mềm, một sắc hồng, một mùi hương quen.
                <br />
                Đôi khi, thế là đủ để ai đó biết mình được thương.
              </p>
            </Reveal>
            <Reveal className="story-composition">
              <img
                className="story-floral"
                src="/flowers/cherry_blossom_frame.webp"
                alt=""
                loading="lazy"
              />
              <figure className="story-photo first">
                <img
                  src="/media/story-4.jpg"
                  alt="Một khu vườn xanh, nơi những mầm hoa bắt đầu"
                  loading="lazy"
                />
                <figcaption>01 — Từ thiên nhiên</figcaption>
              </figure>
              <div className="story-handwriting">
                with love,
                <br />
                always.
              </div>
              <figure className="story-photo second">
                <img
                  src="/media/story-3.jpg"
                  alt="Hoa được chọn để tạo nên một bó hoa riêng"
                  loading="lazy"
                />
                <figcaption>02 — Bằng cả tấm lòng</figcaption>
              </figure>
            </Reveal>
            <Reveal className="story-bottom">
              <span>✳</span>
              <p>
                Mỗi bó hoa là một lời nhắn nhỏ.
                <br />
                <em>Và mỗi người nhận, là một câu chuyện riêng.</em>
              </p>
              <a className="text-link" href="#collection">
                Tìm lời nhắn của bạn <Icon name="arrow" />
              </a>
            </Reveal>
          </div>
        </section>
        <section className="care section-shell" id="care">
          <Reveal className="care-heading">
            <span className="eyebrow">A little flower care / 03</span>
            <h2>
              Để dịu dàng
              <br />
              <em>ở lại lâu hơn.</em>
            </h2>
            <p>Một vài điều nhỏ, cho những ngày hoa vẫn đẹp.</p>
          </Reveal>
          <div className="care-steps">
            {[
              [
                "01",
                "Một chiếc bình sạch",
                "Rửa bình, thêm nước sạch và bỏ những chiếc lá nằm dưới mặt nước.",
              ],
              [
                "02",
                "Một lát cắt nhẹ",
                "Cắt chéo gốc khoảng 1–2 cm để cành hoa dễ hút nước hơn.",
              ],
              [
                "03",
                "Một góc thật dịu",
                "Thay nước thường xuyên; đặt hoa xa nắng gắt, nguồn nhiệt và trái cây chín.",
              ],
            ].map(([number, title, text]) => (
              <Reveal key={number}>
                <article>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
        <section className="closing">
          <Reveal>
            <span className="eyebrow">
              Some things are better said with flowers
            </span>
            <h2>
              Có những lời,
              <br />
              <em>để hoa nói giúp.</em>
            </h2>
            <a href="#collection" className="button primary">
              Gửi một chút thương <Icon name="arrow" />
            </a>
          </Reveal>
          <img
            src="/flowers/bouquet_6.webp"
            alt="Bó mẫu đơn hồng"
            loading="lazy"
          />
        </section>
      </main>
      <footer>
        <div className="footer-top">
          <a className="brand" href="#home">
            <Icon name="flower" />
            <span>{shop.name}</span>
          </a>
          <p>{shop.about}</p>
          <div className="footer-contact">
            <a href={`tel:${shop.phone}`}>{shop.phone}</a>
            <a
              className="text-link"
              href={`https://zalo.me/${shop.phone.replace(/^\+84/, "0")}`}
              target="_blank"
              rel="noreferrer"
            >
              Trao đổi qua Zalo <Icon name="arrow" />
            </a>
          </div>
          <a className="text-link" href="#home">
            Về đầu trang ↑
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {shop.name}
          </span>
          <a href="#account">Góc của tôi</a>
          <a href="#garden">Vườn kỉ niệm</a>
          {isAdmin && <a href="#admin">Quản trị</a>}
          <div>
            <button onClick={() => setPanel("privacy")}>
              Thông tin & riêng tư
            </button>
            <button onClick={() => setPanel("terms")}>
              Đặt hoa & giao nhận
            </button>
          </div>
          <span>
            {connected
              ? shop.accepting_orders
                ? "Made with love, on Earth."
                : "Cửa hàng chưa mở nhận đơn"
              : "Bản trải nghiệm · giá & bộ sưu tập mẫu"}
          </span>
        </div>
      </footer>
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        <Icon name="check" />
        {notice}
        <button
          onClick={() => {
            setPanel("cart");
            setNotice("");
          }}
        >
          Xem giỏ
        </button>
      </div>
      {selectedProduct && (
        <ProductDialog
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelected(null)}
          onAdd={add}
          favorite={favorites.includes(selected.id)}
          onFavorite={() => favorite(selected.id)}
        />
      )}
      {panel === "cart" && (
        <CartDialog
          cart={cart}
          onClose={() => setPanel(null)}
          onChange={changeCart}
          onCheckout={() => setPanel("checkout")}
        />
      )}
      {panel === "checkout" &&
        (connected ? (
          <LiveCheckout
            cart={cart}
            onClose={() => setPanel(null)}
            onComplete={() => setCart([])}
          />
        ) : (
          <CheckoutDialog
            cart={cart}
            onClose={() => setPanel(null)}
            onComplete={() => setCart([])}
          />
        ))}
      {["privacy", "terms"].includes(panel) && (
        <Modal
          title={
            panel === "privacy" ? "Thông tin & riêng tư" : "Đặt hoa & giao nhận"
          }
          onClose={() => setPanel(null)}
          className="info-dialog"
        >
          <span className="eyebrow">{shop.name}</span>
          <h2>
            {panel === "privacy" ? "Một chút riêng tư." : "Về đơn hoa của bạn."}
          </h2>
          {panel === "privacy" ? (
            <>
              <p>
                Giỏ hàng và hoa yêu thích được lưu trong trình duyệt của bạn.
                Tài khoản được dùng cho lịch sử mua và theo dõi đơn. Phiên đăng
                nhập giữ trong bộ nhớ, không lưu token vào localStorage.
              </p>
              <p>
                Trong chế độ xem thử, tên, số điện thoại, địa chỉ và lời nhắn
                chỉ dùng để hiển thị bản xem trước; không gửi đến máy chủ và
                không lưu trong trình duyệt.
              </p>
              <p>
                Khi cửa hàng bật nhận đơn, thông tin bạn gửi sẽ được lưu riêng
                tư để liên hệ xác nhận và giao hoa. Cửa hàng không công khai
                thông tin người nhận.
              </p>
              <p>
                Lời nhắn trên thiệp mặc định giữ riêng. Bạn có thể chia sẻ chính
                lời nhắn sau khi đơn hoàn tất; chỉ lời nhắn, hình hoa và chữ ký
                bạn chọn được công khai. Có thể rút chia sẻ bất cứ lúc nào.
                Thông tin giao hàng được xóa sau 90 ngày kể từ cập nhật cuối của
                đơn đã hoàn tất/hủy.
              </p>
            </>
          ) : (
            <>
              <p>
                {connected
                  ? "Đơn đặt được lưu riêng vào lịch sử của bạn. Cửa hàng kiểm tra hoa và địa chỉ giao trước khi xác nhận."
                  : "Website hiện dùng bộ sưu tập, hình ảnh và giá mẫu. Bản xem trước chưa phải đơn giao hoa và không thu tiền."}
              </p>
              <p>
                Khi nhận đơn thật, cửa hàng cần xác nhận tình trạng hoa, giá
                cuối cùng, khu vực giao, phí giao và khung giờ trước khi thực
                hiện. Thanh toán bằng COD hoặc chuyển khoản khi được bật; admin
                kiểm tra tiền nhận rồi mới ghi nhận đã trả. Không thu thông tin
                thẻ.
              </p>
              <p>
                Hoa theo mùa có thể khác ảnh. Mọi thay đổi và yêu cầu hủy cần
                được cửa hàng xác nhận trước khi bó hoa được chuẩn bị.
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
