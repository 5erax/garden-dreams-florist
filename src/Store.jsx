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
} from "./backend.js";
import { products as demoProducts } from "./catalog.js";

const Store = createContext(null);
const demoShop = {
  name: "Garden Dreams",
  phone: "0832345780",
  about: "Hoa mang lời thương.",
  accepting_orders: false,
  cod_enabled: true,
  transfer_enabled: false,
};
export function StoreProvider({ children }) {
  const [shop, setShop] = useState(demoShop),
    [products, setProducts] = useState(demoProducts),
    [shipping, setShipping] = useState([]);
  const [session, setSession] = useState(null),
    [admin, setAdmin] = useState(false),
    [loading, setLoading] = useState(backendReady),
    [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [environmentVerified, setEnvironmentVerified] = useState(false);
  const refresh = useCallback(async () => {
    if (!backend) return;
    setLoading(true);
    setError("");
    try {
      await verifyEnvironment();
      setEnvironmentVerified(true);
      const [cfg, catalog, services] = await Promise.all([
        result(backend.from("gd_shop").select("*").eq("id", 1).single()),
        result(backend.from("gd_products").select("*").order("id")),
        result(backend.from("gd_shipping").select("*").order("name")),
      ]);
      setShop(cfg);
      setProducts(catalog.filter((p) => p.active));
      setShipping(services.filter((s) => s.active));
    } catch (e) {
      setEnvironmentVerified(false);
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
    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAdmin(false);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        window.location.hash = "#account";
      }
      if (!next) setRecovery(false);
    });
    backend.auth.getSession().then(({ data }) => setSession(data.session));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    if (!session) {
      setAdmin(false);
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
        if (active) setAdmin(Boolean(row));
      })
      .catch(() => {
        if (active) setAdmin(false);
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
        session,
        isAdmin: admin,
        loading,
        error,
        refresh,
        connected: backendReady && environmentVerified,
        recovery,
        setRecovery,
      }}
    >
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
