import { cartChoice } from './order.js';

export function robotsPolicy(route, product, environment, initial = '') {
  if (['#account', '#admin'].includes(route)) return 'noindex,nofollow';
  if (environment !== 'production') return initial || 'noindex,nofollow';
  return product && !cartChoice({ id: product.id }, [product]) ? 'noindex,follow' : '';
}

export function applyRobots(document, content) {
  const nodes = [...document.querySelectorAll('meta[name="robots"]')];
  let node = nodes.shift();
  nodes.forEach(extra => extra.remove());
  if (!content) { node?.remove(); return; }
  if (!node) { node = document.createElement('meta'); node.name = 'robots'; document.head.append(node); }
  node.content = content;
}
