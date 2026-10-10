import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  backend,
  backendReady,
  result,
  appEnvironment,
  verifyEnvironment,
  authCallbackPending,
  guestCheckoutEnabled,
} from "./backend.js";
import { authCallbackRoute } from "./auth-callback.js";
import { products as demoProducts } from "./catalog.js";

const Store = createContext(null);
let initialCatalog;
try { initialCatalog = JSON.parse(globalThis.document?.getElementById('gd-public-catalog')?.textContent || 'null'); } catch { /* Live refresh recovers an absent snapshot. */ }
export function sessionIsAdmin(session, adminUserId) {
  return Boolean(session?.user?.id && session.user.id === adminUserId);
}
const demoShop = {
  name: "Garden Dreams",
  phone: "0832345780",
  about: "Hoa mang lời thương.",
  accepting_orders: false,
  cod_enabled: true,
  transfer_enabled: false,
};
export function StoreProvider({ children }) {
  const [shop, setShop] = useState(initialCatalog?.shop || demoShop),
    [products, setProducts] = useState(initialCatalog?.products || demoProducts),
    [shipping, setShipping] = useState([]);
  const [session, setSession] = useState(null),
    [adminUserId, setAdminUserId] = useState(null),
    [loading, setLoading] = useState(backendReady),
    [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [authError, setAuthError] = useState("");
  const [environmentVerified, setEnvironmentVerified] = useState(false);
  const [features, setFeatures] = useState({});
  const [guestEnabled, setGuestEnabled] = useState(false);
  const refresh = useCallback(async () => {
    if (!backend) return;
    setLoading(true);
    setError("");
    guestCheckoutEnabled().then(setGuestEnabled);
    try {
      const runtime = await verifyEnvironment();
      setFeatures(runtime.features || {});
      setEnvironmentVerified(true);
      const [cfg, catalog, services, variants] = await Promise.all([
        result(backend.from("gd_shop").select("*").eq("id", 1).single()),
        result(backend.from("gd_products").select("*").order("id")),
        result(backend.from("gd_shipping").select("*").order("name")),
        runtime.features?.variantOrders ? result(backend.from("gd_product_variants").select("*").eq("active", true).order("id")) : [],
      ]);
      setShop(cfg);
      setProducts(catalog.filter((p) => p.active || p.reference_only).map(p => ({ ...p, variants: variants.filter(v => v.product_id === p.id) })));
      setShipping(services.filter((s) => s.active));
    } catch (e) {
      setEnvironmentVerified(false);
      setFeatures({});
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!backend) return;
    let active = true;
    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAdminUserId(null);
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")
        setAuthError("");
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        window.location.hash = "#account";
      }
      if (!next) setRecovery(false);
    });
    backend.auth
      .initialize()
      .then(({ error }) => {
        if (!active || !authCallbackPending) return;
        setAuthError(
          error
            ? "Link xác nhận hoặc khôi phục chưa hợp lệ, đã dùng hoặc hết hạn. Vui lòng yêu cầu một email mới."
            : "",
        );
      })
      .catch(() => {
        if (active && authCallbackPending)
          setAuthError(
            "Chưa mở được link tài khoản. Kiểm tra kết nối rồi thử lại.",
          );
      })
      .finally(() => {
        if (!active || !authCallbackPending) return;
        window.history.replaceState(
          window.history.state,
          "",
          authCallbackRoute(window.location),
        );
        window.dispatchEvent(new Event("hashchange"));
      });
    backend.auth.getSession().then(({ data }) => setSession(data.session));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!session) {
      setAdminUserId(null);
      return;
    }
    result(
      backend
        .from("gd_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle(),
    )
      .then((row) => {
        if (active) setAdminUserId(row ? session.user.id : null);
      })
      .catch(() => {
        if (active) setAdminUserId(null);
      });
    return () => {
      active = false;
    };
  }, [session]);
  return (
    <Store.Provider
      value={{
        shop,
        products,
        shipping,
        features,
        session,
        isAdmin: sessionIsAdmin(session, adminUserId),
        loading,
        error,
        refresh,
        connected: backendReady && environmentVerified,
        recovery,
        guestEnabled,
        setRecovery,
      }}
    >
      {authError && (
        <p className="portal-error" role="alert">
          {authError}
        </p>
      )}
      {backendReady && appEnvironment !== "production" && (
        <p className="portal-notice" role="status">
          Môi trường thử nghiệm · Đơn hoa và kỉ niệm ở đây là dữ liệu thử. Không
          chuyển tiền hoặc giao hoa theo các đơn này.
        </p>
      )}
      {children}
    </Store.Provider>
  );
}
export const useStore = () => useContext(Store);
