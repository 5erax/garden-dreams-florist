import { useEffect, useState } from 'react';
import { useStore } from './Store.jsx';
import Icon from './Icons.jsx';

const preloadGarden = () => { import('./Garden.jsx').catch(() => {}); };
const preloadAccount = () => { import('./CustomerPortal.jsx').catch(() => {}); };

export default function ShopHeader({ route, cartCount, onCart, onFavorites, onlyFavorites, notice }) {
  const { shop, session } = useStore();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 60);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const prefix = location.pathname === '/' ? '' : '/';
  const solid = scrolled || prefix || ['#account', '#garden', '#admin'].includes(route) || route.startsWith('#memory/');
  return <header className={`header ${solid ? 'is-scrolled' : ''}`}>
    <a className="brand" href={`${prefix}#home`} aria-label="Garden Dreams — về đầu trang"><Icon name="flower" /><span>{shop.name}</span></a>
    <nav aria-label="Điều hướng chính">
      <a href={`${prefix}#collection`} aria-label="Bộ sưu tập" aria-current={route === '#collection' ? 'page' : undefined}><span className="nav-wide">Bộ sưu tập</span><span className="nav-short">Chọn hoa</span></a>
      <a href={`${prefix}#story`} aria-label="Đặt & giao hoa" aria-current={route === '#story' ? 'page' : undefined}><span className="nav-wide">Đặt & giao hoa</span><span className="nav-short">Đặt & giao</span></a>
      <a href={`${prefix}#garden`} aria-label="Vườn kỷ niệm" aria-current={route === '#garden' || route.startsWith('#memory/') ? 'page' : undefined} onPointerEnter={preloadGarden} onFocus={preloadGarden}><span className="nav-wide">Vườn kỷ niệm</span><span className="nav-short">Kỷ niệm</span></a>
    </nav>
    <div className="header-actions">
      <a href={`${prefix}#account`} className="icon-button account-link" aria-label={session ? 'Góc kỷ niệm của tôi' : 'Tài khoản & lịch sử mua'} aria-current={route === '#account' ? 'page' : undefined} onPointerEnter={preloadAccount} onFocus={preloadAccount}><Icon name="user" /></a>
      <button className={`icon-button ${onlyFavorites ? 'is-favorite' : ''}`} aria-label="Xem hoa yêu thích" aria-pressed={onlyFavorites} onClick={onFavorites}><Icon name="heart" /></button>
      <button className={`cart-trigger ${notice ? 'has-new-items' : ''}`} onClick={onCart} aria-label={`Mở giỏ hoa, ${cartCount} bó`}><Icon name="bag" /><span className="cart-label">Giỏ hoa</span><span className="cart-count">{cartCount}</span></button>
    </div>
  </header>;
}
