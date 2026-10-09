export function guestStorage(key, storage) {
  const memory = new Map();
  const preference = `${key}-remember`;
  const read = name => { try { return storage?.getItem(name); } catch { return null; } };
  const write = (name, value) => { try { value == null ? storage?.removeItem(name) : storage?.setItem(name, value); } catch {} };
  const anonymous = value => { try { return JSON.parse(value)?.user?.is_anonymous === true; } catch { return false; } };
  let remember = read(preference) === "true";
  return {
    getItem(name) {
      if (memory.has(name)) return memory.get(name);
      const value = name === key && remember ? read(key) : null;
      if (!anonymous(value)) return null;
      memory.set(name, value);
      return value;
    },
    setItem(name, value) {
      memory.set(name, value);
      if (name === key) write(key, remember && anonymous(value) ? value : null);
    },
    removeItem(name) { memory.delete(name); write(name, null); },
    get remember() { return remember; },
    setRemember(value) {
      remember = value;
      write(preference, value ? "true" : null);
      const session = memory.get(key);
      write(key, value && anonymous(session) ? session : null);
    },
  };
}

const pending = new WeakMap();
export function startGuestSession(auth) {
  if (!pending.has(auth)) {
    const request = (async () => {
      const { data, error } = await auth.getSession();
      if (error) throw error;
      if (data.session) return data.session;
      const result = await auth.signInAnonymously();
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error("GUEST_SESSION_MISSING");
      return result.data.session;
    })().finally(() => pending.delete(auth));
    pending.set(auth, request);
  }
  return pending.get(auth);
}
