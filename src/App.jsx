import BloomSelect from "./BloomSelect.jsx";
import { readCatalogFilters, catalogFilterUrl } from "./catalog-filters.js";
import { robotsPolicy, applyRobots } from "./robots-policy.js";
import { useEffect, useRef, useState } from "react";
import ShopHeader from './ShopHeader.jsx';
import { occasions, money } from "./catalog.js";
import { normalizeCart, cartChoice, cartKey, removeOrderedItems,vietnamDate } from "./order.js";
import { useCustomerFavorites } from './customer-favorites.js';
import { useCustomerCart } from './customer-cart.js';
import { appEnvironment } from './backend.js';
import {
  CartDialog,
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
import { withinBudget, toggleComparison, matchesFlowerDescription, startingPrice } from './flower-selection.js';
const loadDemoCheckout = () => import("./DemoCheckout.jsx").then(module => ({default:module.CheckoutDialog}));
const loadCheckout = () => import("./LiveCheckout.jsx");
import { shopAddress, displayPhone } from "./shop-contact.js";
import { prepareReorder } from "./reorder.js";
import { normalizeSearch, productUrl, productFromPath, productTitle } from "./product-url.js";
import "./styles.css";
import "./portal.css";
import './commerce-upgrade.css';
import './uiux-issues.css';

const loadCustomer = () => import("./CustomerPortal.jsx");
const loadAdmin = () => import("./AdminPortal.jsx");
const loadGarden = () => import("./Garden.jsx");
const loadMemory = () => import("./Garden.jsx").then(module => ({ default: module.SharedMemory }));

function Reveal({ children, className = '' }) {
  const ref = useRef(null);
  const [visible,setVisible] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {setVisible(true);return;}
    const observer = new IntersectionObserver(entries => {
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{threshold:0.12});
    if(ref.current)observer.observe(ref.current);
    return()=>observer.disconnect();
  },[]);
  return <div ref={ref} className={`reveal-section ${className}`} data-visible={visible}>{children}</div>;
}

function Hero() {
  const { shop } = useStore();
  const [first, ...rest] = shop.name.split(/\s+/);
  const heroRef = useRef(null);
  const [inView,setInView] = useState(true);
  useEffect(()=>{
    if(!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:0.05});
    if(heroRef.current)observer.observe(heroRef.current);
    return()=>observer.disconnect();
  },[]);
  return (
    <section
      className="hero"
      ref={heroRef}
      data-in-view={inView}
      id="home"
      aria-label="Garden Dreams · Hoa mang lời thương"
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
      <div className="hero-copy">
        <p className="eyebrow">Hoa tươi · Long Thành, Đồng Nai</p>
        <h1>
          {first}
          <br />
          <em>{rest.join(" ")}</em>
        </h1>
        <p className="hero-subtitle">
          Một chút dịu dàng,
          <br className="mobile-break" /> dành cho người bạn thương.
        </p>
        <a className="button hero-cta" href="#collection">
          Chọn một bó hoa <Icon name="arrow" />
        </a>
      </div>
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
    recovery,
    loading,
    error: storeError,
  } = useStore();
  const [storedCart, setCart] = useCustomerCart({ session, authReady, environment: appEnvironment, products, loading, error: storeError });
  const cart = normalizeCart(storedCart, products);
  const [route, setRoute] = useState(location.hash);
  const [gardenVisited, setGardenVisited] = useState(location.hash === '#garden');
  useEffect(() => { if (route === '#garden') setGardenVisited(true); }, [route]);
  const isProductPage = location.pathname.startsWith('/hoa/');
  const pageProduct = productFromPath(location.pathname, products);
  useEffect(() => {
    const changed = () => setRoute(location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const initialRobots = useRef(typeof document === 'undefined' ? '' : document.querySelector?.('meta[name="robots"]')?.content || '');
  useEffect(() => {
    const section = { '#account': 'Tài khoản & đơn hoa', '#admin': 'Quản trị', '#garden': 'Vườn kỷ niệm', '#collection': 'Bộ sưu tập hoa tươi', '#story': 'Đặt & giao hoa' }[route];
    document.title = `${section || (pageProduct && productTitle(pageProduct)) || 'Hoa tươi, giao hoa Long Thành, Đồng Nai'} | Garden Dreams`;
    applyRobots(document, robotsPolicy(route, pageProduct, import.meta.env.VITE_APP_ENV, initialRobots.current));
  }, [route, pageProduct]);
  const [favorites, setFavorites] = useCustomerFavorites({ session, authReady, environment: appEnvironment });
  const initialFilters = useRef(readCatalogFilters(location.search));
  const [occasion, setOccasion] = useState(initialFilters.current.occasion);
  const [query, setQuery] = useState(initialFilters.current.query);
  const [sort, setSort] = useState(initialFilters.current.sort);
  const [budget, setBudget] = useState(initialFilters.current.budget);
  const [flowerColor, setFlowerColor] = useState(initialFilters.current.flowerColor);
  const [flowerType, setFlowerType] = useState(initialFilters.current.flowerType);
  const [saleOnly, setSaleOnly] = useState(initialFilters.current.saleOnly);
  const previousFilters = useRef(null);
  const restoringFilters = useRef(false);
  const collectionRef = useRef(null), toolsRef = useRef(null);
  const [filterShortcut, setFilterShortcut] = useState(false);
  const [comparison, setComparison] = useState([]);
  const compared = products.filter(p => comparison.includes(p.id));
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [animateCollection, setAnimateCollection] = useState(false);
  useEffect(() => {
    const restore = () => {
      const value = readCatalogFilters(location.search);
      if (previousFilters.current && Object.keys(value).every(key => value[key] === previousFilters.current[key])) return;
      restoringFilters.current = true;
      setOccasion(value.occasion); setQuery(value.query); setSort(value.sort); setBudget(value.budget);
      setFlowerColor(value.flowerColor); setFlowerType(value.flowerType); setSaleOnly(value.saleOnly);
      setOnlyFavorites(false); setShowAll(true);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    const current = {occasion,query,sort,budget,flowerColor,flowerType,saleOnly};
    const previous = previousFilters.current;
    previousFilters.current = current;
    if (!previous || restoringFilters.current) { restoringFilters.current = false; return; }
    const searchOnly = Object.keys(current).every(key => key === 'query' || current[key] === previous[key]);
    const timer = setTimeout(() => {
      const next = catalogFilterUrl(location.href, current);
      if (next !== location.pathname + location.search + location.hash)
        history[searchOnly ? 'replaceState' : 'pushState']({...history.state}, '', next);
    }, searchOnly ? 350 : 0);
    return () => clearTimeout(timer);
  }, [occasion,query,sort,budget,flowerColor,flowerType,saleOnly]);
  useEffect(() => {
    const update = () => {
      const section = collectionRef.current?.getBoundingClientRect();
      const tools = toolsRef.current?.getBoundingClientRect();
      setFilterShortcut(Boolean(section && tools && tools.bottom < 90 && section.bottom > 180));
    };
    update(); window.addEventListener('scroll', update, {passive:true});
    return () => window.removeEventListener('scroll', update);
  }, [route]);
  function openFilters() {
    const finder = collectionRef.current?.querySelector('.flower-finder');
    if (finder) finder.open = true;
    toolsRef.current?.scrollIntoView({behavior:'instant',block:'start'});
    toolsRef.current?.querySelector('input')?.focus({preventScroll:true});
  }
  const [selected, setSelected] = useState(null);
  const returnToCart = useRef(null);
  const [cartFocusKey, setCartFocusKey] = useState(null);
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
    if (returnToCart.current) { setCartFocusKey(returnToCart.current); returnToCart.current = null; setPanel('cart'); }
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
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (['#collection', '#story', '#home'].includes(route)) document.getElementById(route.slice(1))?.scrollIntoView({ behavior: 'instant' });
    else if (['#account'].includes(route) || route.startsWith('#memory/')) window.scrollTo(0, 0);
  }, [route]);
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
    if (isAdmin) return;
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
    if (isAdmin) return;
    add(id, quantity, variantId);
    if (selected) closeProduct();
    setPanel("checkout");
    setNotice("");
  }
  function reorder(items) {
    if (isAdmin || !connected || loading || storeError) return;
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
  function resetFilters() {
    setQuery("");
    setBudget(0);
    setFlowerColor("");
    setFlowerType("");
    setSaleOnly(true);
    selectOccasion("Tất cả");
  }
  const activeFilters = [
    query && {label:`Tìm: ${query}`,clear:()=>setQuery('')},
    occasion !== 'Tất cả' && {label:`Dịp: ${occasion}`,clear:()=>setOccasion('Tất cả')},
    flowerColor && {label:`Sắc hoa: ${flowerColor}`,clear:()=>setFlowerColor('')},
    flowerType && {label:`Loại hoa: ${flowerType}`,clear:()=>setFlowerType('')},
    budget > 0 && {label:`Tối đa ${money(budget)}`,clear:()=>setBudget(0)},
    !saleOnly && {label:'Gồm mẫu tham khảo',clear:()=>setSaleOnly(true)},
    onlyFavorites && {label:'Hoa yêu thích',clear:()=>setOnlyFavorites(false)},
  ].filter(Boolean);
  let filtered = products.filter(
    (p) =>
      (occasion === "Tất cả" || p.occasion === occasion || p.occasions?.includes(occasion)) &&
      (!onlyFavorites || favorites.includes(p.id)) &&
      withinBudget(p, budget, saleOnly) && (!saleOnly || Boolean(cartChoice({id:p.id},[p]))) &&
      matchesFlowerDescription(p, flowerColor, flowerType) &&
      normalizeSearch(`${p.name} ${p.stems}`).includes(normalizeSearch(query)),
  );
  if (sort === "low")
    filtered = [...filtered].sort((a, b) => startingPrice(a) - startingPrice(b));
  if (sort === "high")
    filtered = [...filtered].sort((a, b) => startingPrice(b) - startingPrice(a));
  const shown = showAll ? filtered : filtered.slice(0, 8);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const pendingNotice = pendingCheckout.current?.ownerId === session?.user.id && pendingCheckout.current && (
    <p className="store-status" role="status">
      Bạn có một yêu cầu đặt hoa cần kiểm tra. <button className="text-button" onClick={() => { location.hash = "#collection"; setPanel("checkout"); }}>Tiếp tục kiểm tra đơn</button>
    </p>
  );
  const shoppingDialogs = !isAdmin && <>
      {panel === "cart" && (
        <CartDialog
          cart={cart}
          onClose={() => setPanel(null)}
          onChange={changeCart}
          focusKey={cartFocusKey}
          onView={(product,line) => {returnToCart.current=cartKey(line);setPanel(null);openProduct({...product,cartVariantId:line.variantId});}}
          onCheckout={() => setPanel("checkout")}
        />
      )}

      {panel === "checkout" &&
        (connected ? (
          <RouteBoundary
            key={session?.user.id || 'guest'} load={loadCheckout} title="Đặt hoa & giao nhận" onClose={() => setPanel(null)}
            pageProps={{cart,pending:pendingCheckout,onClose:()=>setPanel(null),onEditCart:()=>setPanel('cart'),onComplete:request=>setCart(current=>removeOrderedItems(current,request.items,products))}}
          />
        ) : (
          <RouteBoundary load={loadDemoCheckout} title="Chuẩn bị bó hoa" onClose={()=>setPanel(null)} pageProps={{cart,onClose:()=>setPanel(null)}} />
        ))}
  </>;
  const customerHeader = <ShopHeader route={route} cartCount={count} onCart={() => {setCartFocusKey(null);setPanel('cart');}} onlyFavorites={onlyFavorites} notice={notice} onFavorites={() => {
    setOnlyFavorites(!onlyFavorites); setAnimateCollection(false); setShowAll(true); setOccasion('Tất cả');
    const collection = document.getElementById('collection');
    if (collection) collection.scrollIntoView({ behavior: 'smooth' });
    else location.hash = '#collection';
  }} />;
  if (isAdmin) return <PortalShell>
    {recovery || session.user.user_metadata?.gd_needs_password ? <RouteBoundary load={loadCustomer} title="Đặt mật khẩu quản trị" /> : isProductPage && pageProduct ? <ProductDialog key={pageProduct.id} inline readOnly shipping={shipping} product={pageProduct} /> :
    <RouteBoundary key={session.user.id} load={loadAdmin} title="Quản trị cửa hàng" />}
  </PortalShell>;
  if (
    route === "#account" ||
    route === "#admin" ||
    route === "#garden" ||
    route.startsWith("#memory/")
  )
    return (
      <><PortalShell header={customerHeader}>
        {pendingNotice}
        {(route === '#garden' || route.startsWith('#memory/')) ? <>
          {(gardenVisited || route === '#garden') && <div hidden={route !== '#garden'}><RouteBoundary key={`garden:${session?.user.id || 'visitor'}`} load={loadGarden} title="Vườn kỷ niệm" pageProps={{active:route === '#garden'}} /></div>}
          {route.startsWith('#memory/') && <RouteBoundary key={route} load={loadMemory} title="Một lời thương" pageProps={{token:route.slice(8)}} />}
        </> : <RouteBoundary key={`${route}:${session?.user.id || 'signed-out'}`} load={route === '#account' ? loadCustomer : loadAdmin} title={route === '#account' ? 'Góc của bạn' : 'Quản trị cửa hàng'} pageProps={route === '#account' ? {cart,onReorder:reorder} : {}} />}

      </PortalShell>{shoppingDialogs}</>
    );

  return (
    <>
      <a href={isProductPage ? '/#collection' : '#collection'} className="skip-link">
        Đến bộ sưu tập hoa
      </a>
      {customerHeader}
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
        <section ref={collectionRef} className="collection section-shell" id="collection">{products.some(p=>p.active&&p.occasions?.includes('20/10'))&&vietnamDate().slice(5)<='10-20'&&vietnamDate().slice(5)>='10-01'&&<div className="holiday-banner"><p><strong>20/10 · Một bó hoa cho người bạn thương</strong><br/>Còn {Math.ceil((Date.parse(vietnamDate().slice(0,4)+'-10-20T00:00:00+07:00')-Date.parse(vietnamDate()+'T00:00:00+07:00'))/86400000)} ngày. Ngày giao và giờ chốt được kiểm tra khi đặt.</p><button className="button outline" onClick={()=>selectOccasion('20/10')}>Chọn hoa 20/10</button></div>}
          <div className="collection-heading"><h2>Bộ sưu tập hoa</h2><p>Chọn dịp tặng, tìm tên hoa hoặc lọc theo ngân sách.</p></div>
          <div ref={toolsRef} className="collection-tools">
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
                maxLength={100}
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
          <p className="results-progress" role="status">Đang xem {shown.length}/{filtered.length} mẫu</p>
          {activeFilters.length > 0 && <div className="filter-chips" aria-label="Các bộ lọc đang áp dụng">
            {activeFilters.map(filter => <button key={filter.label} className="filter-chip" aria-label={`Bỏ ${filter.label}`} onClick={() => {filter.clear();setShowAll(true);}}>{filter.label} <span aria-hidden="true">×</span></button>)}
            <button className="text-button" onClick={resetFilters}>Xóa tất cả bộ lọc</button>
          </div>}
          <details className="flower-finder">
            <summary><span className="flower-finder-desktop-label">Tìm hoa vừa ý — sắc hoa, loại hoa & ngân sách</span><span className="flower-finder-mobile-label">Bộ lọc ({activeFilters.length})</span></summary>
            <div className="flower-finder-fields">
              <label>Sắc hoa<BloomSelect aria-label="Sắc hoa" value={flowerColor} onChange={e => { setFlowerColor(e.target.value); setShowAll(true); }}><option value="">Mọi sắc hoa</option>{['hồng','đỏ','trắng','vàng','tím','xanh'].map(value => <option key={value} value={value}>{value}</option>)}</BloomSelect></label>
              <label>Loại hoa<BloomSelect aria-label="Loại hoa" value={flowerType} onChange={e => { setFlowerType(e.target.value); setShowAll(true); }}><option value="">Mọi loại hoa</option>{['hồng','mẫu đơn','ly','cẩm tú cầu','cẩm chướng','hướng dương','tulip'].map(value => <option key={value} value={value}>{value}</option>)}</BloomSelect></label>
              <label>Ngân sách bó hoa<BloomSelect aria-label="Ngân sách bó hoa" value={budget} onChange={e => { setBudget(Number(e.target.value)); setShowAll(true); }}>
                <option value="0">Mọi mức giá</option>{[300000,500000,800000,1500000].map(value => <option key={value} value={value}>Tối đa {money(value)}</option>)}
              </BloomSelect></label>
              <label><input type="checkbox" checked={saleOnly} onChange={e => { setSaleOnly(e.target.checked); setShowAll(true); }} />Chỉ mẫu đang nhận đặt</label>
              {activeFilters.length > 0 &&<button className="button outline finder-reset" onClick={resetFilters}>Đặt lại lựa chọn</button>}
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
                onClick={resetFilters}
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
                Xem thêm <span>{filtered.length - shown.length}</span> mẫu
                <Icon name="arrow" />
              </button>
            </div>
          )}
          {filterShortcut && <button className={`filter-shortcut ${compared.length ? 'above-comparison' : ''}`} onClick={openFilters}>Tìm & lọc hoa{activeFilters.length ? ` (${activeFilters.length})` : ''}</button>}
          {compared.length > 0 && <div className="comparison-bar"><span>{compared.length}/3 bó hoa để so sánh{compared.length === 3 ? ' · Bỏ một mẫu để chọn mẫu khác' : ''}</span><button className="button primary" onClick={() => setPanel('compare')}>So sánh ngay</button><button className="text-button" onClick={() => setComparison([])}>Bỏ chọn tất cả</button></div>}
        </section>
        <section className="ordering-guide" id="story"><div className="section-shell">
          <h2>Đặt & giao hoa</h2>
          <p className="ordering-intro">Từ bó hoa bạn chọn đến lời nhắn được giữ lại.</p>
          <ol>
            <li><h3>Chọn bó & lời nhắn</h3><p>Chọn mẫu đang nhận đặt, cỡ bó và lời nhắn trên thiệp.</p></li>
            <li><h3>Xem phí & ca giao</h3><p>Nhập địa chỉ, chọn khu vực và ngày giao. Phí, lịch còn nhận và tổng tiền hiển thị trước khi gửi đơn.</p></li>
            <li><h3>Theo dõi & giữ kỷ niệm</h3><p>Theo dõi đơn trong Góc của tôi. Khi hoàn tất, bạn có thể giữ riêng hoặc chia sẻ lời nhắn.</p></li>
          </ol>
          <div className="ordering-links"><span>{deliveryCopy(shipping)}</span><button className="text-link" onClick={() => setPanel('delivery-zones')}>Xem khu vực & phí giao <Icon name="arrow" /></button><a className="text-link" href={isProductPage ? '/#account' : '#account'}>Góc của tôi <Icon name="arrow" /></a></div>
        </div></section>
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
          initialVariantId={selected?.cartVariantId ?? null}
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
