import { useEffect, useState } from 'react';
import { cartOwner } from './customer-cart.js';
const key = (environment, owner) => `gd-favorites-v2:${environment}:${owner}`;
export function readFavorites(storage, environment, owner) {
  try {
    const value = JSON.parse(storage?.getItem(key(environment, owner)) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(id => Number.isSafeInteger(id) && id > 0))] : [];
  } catch { return []; }
}
export function useCustomerFavorites({ session, authReady, environment }) {
  const owner = cartOwner(session, authReady);
  let storage;
  try { storage = globalThis.localStorage; } catch { /* Favorites work in memory. */ }
  const [selection, setSelection] = useState({ owner: null, ids: [] });
  useEffect(() => { try { storage?.removeItem('gd-favorites'); } catch { /* Never import ownerless legacy data. */ } }, [storage]);
  useEffect(() => {
    if (owner !== null && owner !== selection.owner) setSelection({ owner, ids: readFavorites(storage, environment, owner) });
  }, [owner, selection.owner, storage, environment]);
  useEffect(() => {
    if (owner !== null && selection.owner === owner) {
      try { storage?.setItem(key(environment, owner), JSON.stringify(selection.ids)); } catch { /* Favorites work in memory. */ }
    }
  }, [owner, selection, storage, environment]);
  return [owner !== null && selection.owner === owner ? selection.ids : [], update => setSelection(current =>
    current.owner === owner && owner !== null ? { owner, ids: typeof update === 'function' ? update(current.ids) : update } : current)];
}
