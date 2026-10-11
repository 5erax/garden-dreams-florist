import BloomSelect from "./BloomSelect.jsx";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useInView } from "motion/react";
import { occasions, money } from "./catalog.js";
import { normalizeCart, cartChoice, cartKey, removeOrderedItems,vietnamDate } from "./order.js";
import { useCustomerCart } from './customer-cart.js';
import { appEnvironment } from './backend.js';
import {
  CartDialog,
  CheckoutDialog,
  Modal,
  ProductDialog,
} from "./ShopDialogs.jsx";
import Icon from "./Icons.jsx";
import { useStore } from "./Store.jsx";
import { PortalShell } from "./PortalShell.jsx";
import RouteBoundary from "./RouteBoundary.jsx";
import BloomLoader from "./BloomLoader.jsx";
import { deliveryCopy } from './delivery-copy.js';
import { quickViewUrl, quickViewFromUrl } from './quick-view.js';
import FlowerCard from './FlowerCard.jsx';
import FlowerComparison from './FlowerComparison.jsx';
import { withinBudget, toggleComparison, matchesFlowerDescription } from './flower-selection.js';
import LiveCheckout from "./LiveCheckout.jsx";
import { shopAddress, displayPhone } from "./shop-contact.js";
import { prepareReorder } from "./reorder.js";
import { normalizeSearch, productUrl, productFromPath, productTitle } from "./product-url.js";
import "./styles.css";
import "./portal.css";
import './commerce-upgrade.css';

const loadCustomer = () => import("./CustomerPortal.jsx");
const loadAdmin = () => import("./AdminPortal.jsx");
const loadGarden = () => import("./Garden.jsx");
const loadMemory = () => import("./Garden.jsx").then(module => ({ default: module.SharedMemory }));

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
      initial={reduced ? false : { transform: "translateY(12px)" }}
      whileInView={{ transform: "translateY(0px)" }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Hero() {
  const { shop } = useStore();
  const [first, ...rest] = shop.name.split(/\s+/);
  const reduced = useReducedMotion();
  const heroRef = useRef(null);
  const inView = useInView(heroRef, { amount: 0.05 });
  return (
    <section
      className="hero"
      ref={heroRef}
      data-in-view={inView}
      id="home"
      aria-label="Garden Dreams — Hoa mang lời thương"
    >
      <div className="hero-video">
        <img
          src="/flowers/garden-dreams-hero.webp"
          alt=""
          width="1536"
          height="1024"
          fetchPriority="high"
        />
      </div>
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
        {Array.from({ length: 6 }, (_, i) => (
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
        initial={reduced ? false : { opacity: 0, transform: "translateY(12px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: 0.65, ease: [0.23, 1, 0.32, 1] }}
      >
        <p className="eyebrow">Hoa tươi · Long Thành, Đồng Nai</p>
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
    </section>
  );
}

export default function App() {
  const {
    products,
    shipping,
    shop,
    connected,
    session,
    authReady,
    isAdmin,
    loading,
    error: storeError,
  } = useStore();
  const [storedCart, setCart] = useCustomerCart({ session, authReady, environment: appEnvironment, products, loading, error: storeError });
  const cart = normalizeCart(storedCart, products);
  const [route, setRoute] = useState(location.hash);
  const isProductPage = location.pathname.startsWith('/hoa/');
  const pageProduct = productFromPath(location.pathname, products);
  useEffect(() => {
    const changed = () => setRoute(location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const section = { '#account': 'Tài khoản & đơn hoa', '#admin': 'Quản trị', '#garden': 'Vườn kỷ niệm', '#collection': 'Bộ sưu tập hoa tươi' }[route];
    document.title = `${section || (pageProduct && productTitle(pageProduct)) || 'Hoa tươi, giao hoa Long Thành, Đồng Nai'} | Garden Dreams`;
    let robots = document.querySelector('meta[name="robots"]');
    if (['#account', '#admin'].includes(route)) {
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
      robots.content = 'noindex,nofollow';
    } else if (import.meta.env.VITE_APP_ENV === 'production') robots?.remove();
  }, [route, pageProduct?.name]);
  const [favorites, setFavorites] = useState(() => {
    const ids = readStored("gd-favorites", []);
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
  });
  const [occasion, setOccasion] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [budget, setBudget] = useState(0);
  const [flowerColor, setFlowerColor] = useState('');
  const [flowerType, setFlowerType] = useState('');
  const [saleOnly, setSaleOnly] = useState(true);
  const [comparison, setComparison] = useState([]);
  const compared = products.filter(p => comparison.includes(p.id));
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [animateCollection, setAnimateCollection] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const restore = () => setSelected(quickViewFromUrl(location.search, products));
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [products]);
  function openProduct(product) {
    history.pushState({ ...history.state, gdQuickView: true }, '', quickViewUrl(location.href, product));
    setSelected(product);
  }
  function closeProduct() {
    setSelected(null);
    if (history.state?.gdQuickView) history.back();
    else history.replaceState(history.state, '', quickViewUrl(location.href, null));
  }
  const selectedProduct = products.find(p => p.id === selected?.id);
  const [panel, setPanel] = useState(null);
  const pendingCheckout = useRef(null);
  const previousCustomer = useRef(null);
  useEffect(() => {
    if (pendingCheckout.current?.ownerId !== session?.user.id)
      pendingCheckout.current = null;
    if (previousCustomer.current && previousCustomer.current !== session?.user.id) {
      setPanel(null);
      setNotice("");
    }
    previousCustomer.current = session?.user.id || null;
  }, [session?.user.id]);
  const [notice, setNotice] = useState("");
  const [scrolled, setScrolled] = useState(false);
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
  function buy(id, quantity, variantId) {
    add(id, quantity, variantId);
    if (selected) closeProduct();
    setPanel("checkout");
    setNotice("");
  }
  function reorder(items) {
    if (!connected || loading || storeError) return;
    const plan = prepareReorder(items, cart, products);
    if (!plan.addedQuantity) return;
    setCart(current => prepareReorder(items, current, products).cart);
    setSelected(null);
    setNotice("Đã thêm hoa theo giá hiện tại. Chọn ngày và người nhận mới trước khi đặt.");
    location.hash = "#collection";
    setPanel("cart");
  }
  function selectOccasion(value) {
    setOccasion(value);
    setShowAll(false);
    setOnlyFavorites(false);
  }
  let filtered = products.filter(
    (p) =>
      (occasion === "Tất cả" || p.occasion === occasion || p.occasions?.includes(occasion)) &&
      (!onlyFavorites || favorites.includes(p.id)) &&
      withinBudget(p, budget, saleOnly) && (!saleOnly || Boolean(cartChoice({id:p.id},[p]))) &&
      matchesFlowerDescription(p, flowerColor, flowerType) &&
      normalizeSearch(`${p.name} ${p.stems}`).includes(normalizeSearch(query)),
  );
  if (sort === "low")
    filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sort === "high")
    filtered = [...filtered].sort((a, b) => b.price - a.price);
  const shown = showAll ? filtered : filtered.slice(0, 8);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const pendingNotice = pendingCheckout.current?.ownerId === session?.user.id && pendingCheckout.current && (
    <p className="store-status" role="status">
      Bạn có một yêu cầu đặt hoa cần kiểm tra. <button className="text-button" onClick={() => { location.hash = "#collection"; setPanel("checkout"); }}>Tiếp tục kiểm tra đơn</button>
    </p>
  );
  const shoppingDialogs = <>
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
            key={session?.user.id || "guest"}
            cart={cart}
            pending={pendingCheckout}
            onClose={() => setPanel(null)}
            onComplete={(request) => setCart(current => removeOrderedItems(current, request.items, products))}
          />
        ) : (
          <CheckoutDialog
            cart={cart}
            onClose={() => setPanel(null)}
            onComplete={() => setCart([])}
          />
        ))}
  </>;
  if (
    route === "#account" ||
    route === "#admin" ||
    route === "#garden" ||
    route.startsWith("#memory/")
  )
    return (
      <><PortalShell cartCount={count} onCart={() => setPanel("cart")}>
        {pendingNotice}
        <RouteBoundary
          key={`${route}:${session?.user.id || "signed-out"}`}
          load={route === "#account" ? loadCustomer : route === "#admin" ? loadAdmin : route === "#garden" ? loadGarden : loadMemory}
          title={route === "#account" ? "Góc của bạn" : route === "#admin" ? "Quản trị cửa hàng" : "Vườn kỷ niệm"}
          pageProps={route.startsWith("#memory/") ? { token: route.slice(8) } : route === "#account" ? { cart, onReorder: reorder } : {}}
        />
      </PortalShell>{shoppingDialogs}</>
    );

  return (
    <>
      <a href={isProductPage ? '/#collection' : '#collection'} className="skip-link">
        Đến bộ sưu tập hoa
      </a>
      <header className={`header ${scrolled || isProductPage ? "is-scrolled" : ""}`}>
        <a
          className="brand"
          href={isProductPage ? '/#home' : '#home'}
          aria-label="Garden Dreams — về đầu trang"
        >
          <Icon name="flower" />
          <span>{shop.name}</span>
        </a>
        <nav aria-label="Điều hướng chính">
          <a href={isProductPage ? '/#collection' : '#collection'} aria-current={route === '#collection' ? 'page' : undefined}>Bộ sưu tập</a>
          <a href={isProductPage ? '/#story' : '#story'}>Câu chuyện</a>
          <a href="#garden" aria-current={route === "#garden" ? "page" : undefined} onPointerEnter={() => { loadGarden().catch(() => {}); }} onFocus={() => { loadGarden().catch(() => {}); }}>Vườn kỷ niệm</a>
        </nav>
        <div className="header-actions">
          <a
            href="#account"
            onPointerEnter={() => { loadCustomer().catch(() => {}); }} onFocus={() => { loadCustomer().catch(() => {}); }}
            className="icon-button account-link"
            aria-label={
              session ? "Góc kỷ niệm của tôi" : "Tài khoản & lịch sử mua"
            }
          >
            <Icon name="user" />
          </a>
          <button
            className={`icon-button ${onlyFavorites ? "is-favorite" : ""}`}
            aria-label="Xem hoa yêu thích"
            onClick={() => {
              setOnlyFavorites(!onlyFavorites);
              setAnimateCollection(false);
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
            className={`cart-trigger ${notice ? "has-new-items" : ""}`}
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
        {isProductPage ? <section className="product-route section-shell">
          <a className="text-link" href="/#collection">← Bộ sưu tập hoa</a>
          {pageProduct ? <><ProductDialog key={pageProduct.id} inline shipping={shipping} product={pageProduct} onAdd={add} onBuy={buy} favorite={favorites.includes(pageProduct.id)} onFavorite={() => favorite(pageProduct.id)} /></> : loading ? <BloomLoader label="Bó hoa của bạn" /> : <p>Bó hoa này hiện không được bán.</p>}
        </section> : <Hero />}
        {panel !== "checkout" && pendingNotice}
        {storeError ? <p className="store-status" role="alert">{storeError}</p> : loading && !products.length && <BloomLoader />}
        <div className="service-strip">
          <span>
            <Icon name="flower" /><span>{deliveryCopy(shipping)} <a href="#delivery-zones" onClick={event=>{event.preventDefault();setPanel('delivery-zones');}}>Xem khu vực & phí giao</a></span>
          </span>
          <i>✳</i>
          <span>
            <Icon name="heart" /> Lời nhắn trên từng tấm thiệp
          </span>
          <i>✳</i>
          <span>
            <Icon name="leaf" /> COD hoặc chuyển khoản VietQR
          </span>
        </div>
        <section className="collection section-shell" id="collection">{products.some(p=>p.active&&p.occasions?.includes('20/10'))&&vietnamDate().slice(5)<='10-20'&&vietnamDate().slice(5)>='10-01'&&<div className="holiday-banner"><p><strong>20/10 · Một bó hoa cho người bạn thương</strong><br/>Còn {Math.ceil((Date.parse(vietnamDate().slice(0,4)+'-10-20T00:00:00+07:00')-Date.parse(vietnamDate()+'T00:00:00+07:00'))/86400000)} ngày. Ngày giao và giờ chốt được kiểm tra khi đặt.</p><button className="button outline" onClick={()=>selectOccasion('20/10')}>Chọn hoa 20/10</button></div>}
          <Reveal className="section-heading">
            <div>
              <span className="eyebrow">Bộ sưu tập hoa tươi / 01</span>
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
              {[...new Set([...occasions,...products.flatMap(product=>product.occasions||[])])].map((value) => (
                <button
                  key={value}
                  className={
                    occasion === value && !onlyFavorites ? "active" : ""
                  }
                  aria-pressed={occasion === value && !onlyFavorites}
                  onClick={event => { setAnimateCollection(event.detail > 0); selectOccasion(value); }}
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
                  setAnimateCollection(false);
                  setShowAll(true);
                }}
              />
            </label>
          </div>
          <div className="collection-meta">
            <span>
              {onlyFavorites
                ? "Những bó hoa bạn đã yêu thích"
                : `${filtered.length} bó hoa phù hợp${saleOnly?' đang nhận đặt':' (gồm mẫu tham khảo)'}`}
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
              <BloomSelect
                aria-label="Sắp xếp hoa"
                value={sort}
                onChange={event => { setAnimateCollection(false); setSort(event.target.value); }}
              >
                <option value="featured">Theo bộ sưu tập</option>
                <option value="low">Giá thấp đến cao</option>
                <option value="high">Giá cao đến thấp</option>
              </BloomSelect>
            </label>
          </div>
          <details className="flower-finder" open={typeof window==='undefined'||window.innerWidth>650}>
            <summary><span className="flower-finder-desktop-label">Tìm hoa vừa ý — sắc hoa, loại hoa & ngân sách</span><span className="flower-finder-mobile-label">Bộ lọc ({[occasion!=='Tất cả',budget>0,Boolean(flowerColor),Boolean(flowerType),!saleOnly].filter(Boolean).length})</span></summary>
            <div className="flower-finder-fields">
              <label>Sắc hoa<BloomSelect aria-label="Sắc hoa" value={flowerColor} onChange={e => { setFlowerColor(e.target.value); setShowAll(true); }}><option value="">Mọi sắc hoa</option>{['hồng','đỏ','trắng','vàng','tím','xanh'].map(value => <option key={value} value={value}>{value}</option>)}</BloomSelect></label>
              <label>Loại hoa<BloomSelect aria-label="Loại hoa" value={flowerType} onChange={e => { setFlowerType(e.target.value); setShowAll(true); }}><option value="">Mọi loại hoa</option>{['hồng','mẫu đơn','ly','cẩm tú cầu','cẩm chướng','hướng dương','tulip'].map(value => <option key={value} value={value}>{value}</option>)}</BloomSelect></label>
              <label>Ngân sách bó hoa<BloomSelect aria-label="Ngân sách bó hoa" value={budget} onChange={e => { setBudget(Number(e.target.value)); setShowAll(true); }}>
                <option value="0">Mọi mức giá</option>{[300000,500000,800000,1500000].map(value => <option key={value} value={value}>Tối đa {money(value)}</option>)}
              </BloomSelect></label>
              <label><input type="checkbox" checked={saleOnly} onChange={e => { setSaleOnly(e.target.checked); setShowAll(true); }} />Chỉ mẫu đang nhận đặt</label>
              {(occasion!=='Tất cả'||budget||flowerColor||flowerType||!saleOnly||query)&&<button className="button outline finder-reset" onClick={() => { setBudget(0); setFlowerColor(''); setFlowerType(''); setSaleOnly(true); setQuery(''); selectOccasion('Tất cả'); }}>Đặt lại lựa chọn</button>}
            </div>
            <p>Tìm theo dịp tặng, tên hoa hoặc ngân sách. Bỏ chọn trạng thái nhận đặt để xem thêm mẫu tham khảo. Ngân sách chưa gồm phí giao; mẫu tham khảo dùng giá dự kiến và chưa nhận đặt.</p>
          </details>
          <div className="product-grid" data-motion={animateCollection}>
            {shown.map((product, index) => (
              <div key={product.id} className="product-reveal" style={{ transitionDelay: `${Math.min(index, 2) * 40}ms` }}>
                <FlowerCard product={product} tone={index % 4} favorite={favorites.includes(product.id)} compared={comparison.includes(product.id)} comparisonFull={comparison.length >= 3}
                  onView={() => openProduct(product)} onAdd={() => add(product.id)} onFavorite={() => favorite(product.id)} onCompare={() => setComparison(ids => toggleComparison(ids, product.id))} />
              </div>
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
                  setBudget(0); setSaleOnly(false);
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
                onClick={event => { setAnimateCollection(event.detail > 0); setShowAll(true); }}
              >
                Khám phá cả bộ sưu tập <span>{filtered.length}</span>
                <Icon name="arrow" />
              </button>
            </div>
          )}
          {compared.length > 0 && <div className="comparison-bar"><span>{compared.length}/3 bó hoa để so sánh{compared.length === 3 ? ' · Bỏ một mẫu để chọn mẫu khác' : ''}</span><button className="button primary" onClick={() => setPanel('compare')}>So sánh ngay</button><button className="text-button" onClick={() => setComparison([])}>Bỏ chọn tất cả</button></div>}
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
                  width="720" height="900" src="/media/story-4.jpg"
                  alt="Một khu vườn xanh, nơi những mầm hoa bắt đầu"
                  loading="lazy"
                />
                <figcaption>01 — Từ thiên nhiên</figcaption>
              </figure>
              <div className="story-handwriting">
                bằng tất cả
                <br />
                lời thương.
              </div>
              <figure className="story-photo second">
                <img
                  width="720" height="900" src="/media/story-3.jpg"
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
              <a className="text-link" href={isProductPage ? '/#collection' : '#collection'}>
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
              Để hoa thay lời muốn nói
            </span>
            <h2>
              Có những lời,
              <br />
              <em>để hoa nói giúp.</em>
            </h2>
            <a href={isProductPage ? '/#collection' : '#collection'} className="button primary">
              Chọn một bó hoa <Icon name="arrow" />
            </a>
          </Reveal>
          <img
            src="/flowers/bouquet_6.webp"
            alt="Bó mẫu đơn hồng"
            loading="lazy"
          />
        </section>
      </main>
      {panel==='delivery-zones'&&<Modal title="Khu vực & phí giao" className="info-dialog" onClose={()=>setPanel(null)}><h2>Khu vực giao hoa</h2>{shipping.map(zone=><p key={zone.id}><strong>{zone.name} · {money(zone.fee)}</strong><br/>{zone.area||'Liên hệ shop để xác nhận địa chỉ thuộc khu vực này trước khi đặt.'}</p>)}</Modal>}<footer className="shop-footer">
        <div className="footer-top">
          <div className="footer-story">
            <a className="brand" href={isProductPage ? '/#home' : '#home'}><Icon name="flower" /><span>{shop.name}</span></a>
            <p>{shop.about}</p>
            <address>{shop.address || shopAddress}</address><p className="shop-hours">Giờ mở cửa: {(shop.opens_at||'08:00').slice(0,5)}–{(shop.closes_at||'17:00').slice(0,5)}</p>{shop.legal_name && <p>{shop.legal_name}{shop.registration_number && ` · Mã đăng ký: ${shop.registration_number}`}</p>}
          </div>
          <nav className="footer-navigation" aria-label="Khám phá cửa hàng">
            <h3>Cửa hàng</h3>
            <a href={isProductPage ? '/#collection' : '#collection'}>Chọn hoa</a>
            <a href="#account">Góc của tôi</a>
            <a href="#garden">Vườn kỷ niệm</a>
            {isAdmin && <a href="#admin">Quản trị</a>}
          </nav>
          <div className="footer-contact">
            <h3>Gặp Garden Dreams</h3>
            <a className="footer-phone" href={`tel:${shop.phone}`}>{displayPhone(shop.phone)}</a>
            <a
              className="text-link"
              href={`https://zalo.me/${shop.phone.replace(/^\+84/, "0")}`}
              target="_blank"
              rel="noreferrer"
            >
              Trao đổi qua Zalo <Icon name="arrow" />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {shop.name}
          </span>
          <div className="footer-policies">
            <button onClick={() => setPanel("privacy")}>
              Thông tin & riêng tư
            </button>
            <button onClick={() => setPanel("terms")}>
              Đặt hoa & giao nhận
            </button>
          </div>
          <a href={isProductPage ? '/#home' : '#home'} className="footer-back">Về đầu trang ↑</a>
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
          shipping={shipping}
          product={selectedProduct}
          onClose={closeProduct}
          onAdd={add}
          onBuy={buy}
          favorite={favorites.includes(selected.id)}
          onFavorite={() => favorite(selected.id)}
        />
      )}
      {shoppingDialogs}
      {panel === 'compare' && <FlowerComparison products={compared} onClose={() => setPanel(null)} onChoose={p => { setPanel(null); openProduct(p); }} onRemove={id => setComparison(ids => toggleComparison(ids, id))} />}
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
                nhập tài khoản giữ trong bộ nhớ. Chỉ khi bạn chọn giữ phiên khách trên thiết bị, token của phiên khách mới lưu vào localStorage để xem lại đơn; không chọn trên máy chung. Xóa dữ liệu trình duyệt hoặc đăng xuất sẽ mất đường truy cập phiên khách chưa gắn email.
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
              <p>{shop.returns_policy || "Hoa theo mùa có thể khác ảnh. Shop trao đổi trước mọi thay đổi. Khi giao sai hoặc hoa hỏng, liên hệ shop qua điện thoại/Zalo kèm mã đơn và ảnh để kiểm tra, thống nhất đổi bó hoặc hoàn tiền. Mọi khoản hoàn do shop xử lý và đối soát."}</p>
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
