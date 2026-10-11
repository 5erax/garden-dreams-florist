import { useEffect, useState } from 'react';
import { normalizeCart } from './order.js';

export const cartOwner = (session, ready) => ready ? session?.user?.id || 'visitor' : null;
const key = (environment, owner) => `gd-cart-v2:${environment}:${owner}`;
export function readCustomerCart(storage, environment, owner) {
  try {
    const items = JSON.parse(storage?.getItem(key(environment, owner)) || '[]');
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}
export function switchCustomerCart(previous, owner, anonymous, storage, environment) {
  if (previous.owner === owner) return previous;
  // Only the visitor who starts an anonymous checkout may carry their selections forward.
  const carry = (previous.owner === 'visitor' && anonymous) || (previous.owner === null && owner === 'visitor');
  const signedOut = previous.owner && previous.owner !== 'visitor' && owner === 'visitor';
  return { owner, items: signedOut ? [] : carry && previous.items.length ? previous.items : readCustomerCart(storage, environment, owner) };
}
export function clearCustomerCart(storage, environment, owner) {
  try { storage?.removeItem(key(environment, owner)); } catch { /* Memory cart still works. */ }
}
export function saveCustomerCart(storage, environment, owner, items) {
  try { storage?.setItem(key(environment, owner), JSON.stringify(items)); } catch { /* Memory cart still works. */ }
}

export function useCustomerCart({ session, authReady, environment, products, loading, error }) {
  const owner = cartOwner(session, authReady);
  const anonymous = session?.user?.is_anonymous === true;
  let storage;
  try { storage = globalThis.sessionStorage; } catch { /* Storage may be disabled. */ }
  const [selection, setSelection] = useState({ owner: null, items: [] });
  useEffect(() => {
    // The legacy shared cart has no verifiable owner and must never be imported.
    try { globalThis.localStorage?.removeItem('gd-cart'); } catch { /* Storage may be disabled. */ }
  }, []);
  useEffect(() => {
    if (owner === null || selection.owner === owner) return;
    const next = switchCustomerCart(selection, owner, anonymous, storage, environment);
    if (selection.owner === 'visitor' && owner !== 'visitor') clearCustomerCart(storage, environment, 'visitor');
    if (selection.owner && selection.owner !== 'visitor' && owner === 'visitor') {
      clearCustomerCart(storage, environment, selection.owner);
      clearCustomerCart(storage, environment, 'visitor');
    }
    setSelection(next);
  }, [owner, anonymous, selection, storage, environment]);
  useEffect(() => {
    if (owner !== null && selection.owner === owner && !loading && !error)
      saveCustomerCart(storage, environment, owner, normalizeCart(selection.items, products));
  }, [selection, owner, storage, environment, products, loading, error]);
  // Hide the previous account's cart immediately, before the switch effect runs.
  const items = selection.owner === owner ? selection.items : [];
  const setCart = update => setSelection(current => {
    // A delayed checkout completion must not edit a replacement account's cart.
    if (current.owner !== owner) return current;
    return { owner, items: typeof update === 'function' ? update(current.items) : update };
  });
  return [items, setCart];
}
