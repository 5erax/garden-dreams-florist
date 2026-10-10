import referenceCatalog from './reference-catalog.json' with { type: 'json' };
import { productUrl } from './product-url.js';
export const shopOrigin = 'https://garden-dreams-florist.vercel.app';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const jsonScript = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const price = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const imageUrl = value => /^\/flowers\/[a-zA-Z0-9_.-]+$/.test(value || '') ? shopOrigin + value : /^https:\/\/[a-z0-9]{20}\.supabase\.co\/storage\/v1\/object\/public\/gd-product-images\//.test(value || '') ? value : shopOrigin + '/flowers/garden-dreams-share.jpg';

export function renderStorefront({ template, shop, products, product, preview = false }) {
  const url = shopOrigin + (product ? productUrl(product) : '/');
  const title = product ? `${product.name} — Hoa tươi Long Thành | Garden Dreams` : 'Garden Dreams — Hoa tươi, giao hoa Long Thành, Đồng Nai';
  const description = product ? `${product.description} ${product.reference_only ? `Mẫu hoa tham khảo tại Garden Dreams, Long Thành, Đồng Nai; chưa nhận đặt.` : `Đặt ${product.name} tại Garden Dreams, giao hoa Long Thành, Đồng Nai.`}` : 'Đặt hoa tươi tại Garden Dreams, Long Thành, Đồng Nai. Chọn bó hoa, ngày giao, lời nhắn và COD hoặc chuyển khoản VietQR trực tuyến.';
  const florist = { '@type': 'Florist', '@id': shopOrigin + '/#shop', name: shop.name, url: shopOrigin, telephone: shop.phone, image: imageUrl('/flowers/garden-dreams-share.jpg'), address: { '@type': 'PostalAddress', streetAddress: shop.address, addressLocality: 'Long Thành', addressRegion: 'Đồng Nai', addressCountry: 'VN' }, areaServed: ['Long Thành', 'Đồng Nai'] };
  const graph = [florist];
  const credit = referenceCatalog.find(item => item.image === product?.image)?.credit;
  const attribution = credit ? `<p>Ảnh tham khảo · <a href="${escapeHtml(credit.source)}">${escapeHtml(credit.author || 'Wikimedia Commons')}</a> · <a href="${escapeHtml(credit.licenseUrl)}">${escapeHtml(credit.license)}</a></p>` : '';
  if (product) graph.push({ '@type': 'Product', '@id': url + '#product', name: product.name, description: product.description, ...(product.image?.endsWith('-pending.svg') ? {} : { image: [imageUrl(product.image)] }), sku: product.slug || `GD-${product.id}`, url, brand: { '@type': 'Brand', name: shop.name }, ...(product.reference_only ? {} : { offers: { '@type': 'Offer', url, priceCurrency: 'VND', price: product.price, seller: { '@id': florist['@id'] } } }) });
  const cards = products.map(item => `<article><a href="${productUrl(item)}"><img src="${escapeHtml(imageUrl(item.image))}" width="600" height="750" loading="lazy" alt="${escapeHtml(item.name)}"><h2>${escapeHtml(item.name)}</h2></a><p>${escapeHtml(item.stems)}</p><strong>${item.reference_only ? "Giá dự kiến · " : ""}${price(item.price)}</strong></article>`).join('');
  const content = product ? `<nav><a href="/">Garden Dreams</a> / <a href="/#collection">Bộ sưu tập</a></nav><article class="seo-product"><img src="${escapeHtml(imageUrl(product.image))}" width="600" height="750" alt="${escapeHtml(product.name)}"><div><h1>${escapeHtml(product.name)}</h1><strong>${product.reference_only ? "Giá dự kiến · " : ""}${price(product.price)}</strong><p>${escapeHtml(product.description)}</p><p>${escapeHtml(product.stems)}</p>${attribution}<p>Miễn phí giao trong Long Thành. Phí khu vực khác được hiển thị khi đặt.</p>${product.reference_only ? `<p>Mẫu tham khảo, shop chưa nhận đặt mẫu này.</p>` : `<a class="button" href="#buy">Chọn cỡ và đặt hoa</a>`}</div></article>` : `<h1>Hoa tươi Long Thành, Đồng Nai</h1><p>${escapeHtml(shop.name)} · Hoa mang lời thương. Chọn một bó hoa, ngày giao và lời nhắn cho người bạn thương.</p><section class="seo-catalog" aria-label="Bộ sưu tập hoa">${cards}</section>`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/, `<meta name="description" content="${escapeHtml(description)}">`);
  for (const [property, value] of Object.entries({ 'og:title': title, 'og:description': description, 'og:url': url, 'og:type': product ? 'product' : 'website', 'og:image': imageUrl(product?.image || '/flowers/garden-dreams-share.jpg'), 'og:image:alt': product ? product.name : 'Garden Dreams — hoa mang lời thương' }))
    html = html.replace(new RegExp(`<meta\\s+property="${property}"[\\s\\S]*?>`), `<meta property="${property}" content="${escapeHtml(value)}">`);
  html = html.replace('</head>', `<link rel="canonical" href="${url}">${preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<script type="application/ld+json">${jsonScript({ '@context': 'https://schema.org', '@graph': graph })}</script>${product ? '' : '<link rel="preload" href="/flowers/garden-dreams-hero.webp" as="image" fetchpriority="high">'}</head>`);
  return html.replace('<div id="root"></div>', `<div id="root"><main class="seo-initial">${content}<footer>${escapeHtml(shop.address)} · <a href="tel:${escapeHtml(shop.phone)}">${escapeHtml(shop.phone)}</a></footer></main></div><script id="gd-public-catalog" type="application/json">${jsonScript({shop, products})}</script>`);
}

export function renderSitemap(products) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...products.map(productUrl)].map(path => `<url><loc>${escapeHtml(shopOrigin + path)}</loc></url>`).join('')}</urlset>`;
}
