import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Account, Achievement, Child } from "../../shared/api-types";
import { api, ApiRequestError, CHILD_KEY, PARENT_KEY, SESSION_KEY } from "../api/client";
import { load, save } from "./storage";

interface AppState {
  account: Account | null;
  children: Child[];
  child: Child | null;
  loading: boolean;
  error: string | null;
  /** Hesapsız (yalnızca bu cihaz) aile oluşturulduğunda. */
  signInDevice: (parentId: string) => Promise<void>;
  /** Kullanıcı adı/şifreyle kayıt, giriş veya hesap bağlama sonrası. */
  signInWithSession: (token: string, account: Account) => void;
  logout: () => Promise<void>;
  selectChild: (id: string | null) => void;
  refresh: () => Promise<void>;
  /** Yeni kazanılan rozetleri kutlama bildirimi olarak gösterir. */
  celebrate: (items: Achievement[]) => void;
  celebrations: Achievement[];
  dismissCelebration: () => void;
}

const Ctx = createContext<AppState | null>(null);

const hasIdentity = () => !!(load(SESSION_KEY) || load(PARENT_KEY));

export function AppStateProvider({ children: node }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [childId, setChildId] = useState<string | null>(() => load(CHILD_KEY));
  const [loading, setLoading] = useState(hasIdentity);
  const [error, setError] = useState<string | null>(null);
  const [celebrations, setCelebrations] = useState<Achievement[]>([]);

  const clearLocal = useCallback(() => {
    save(SESSION_KEY, null);
    save(PARENT_KEY, null);
    save(CHILD_KEY, null);
    setAccount(null);
    setChildId(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!hasIdentity()) {
      setAccount(null);
      setLoading(false);
      return;
    }
    try {
      setAccount(await api.me());
      setError(null);
    } catch (e) {
      if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        // Oturum süresi doldu, başka cihazda şifre değişti ya da kayıt silindi.
        clearLocal();
      } else {
        setError(e instanceof Error ? e.message : "Bir sorun oluştu.");
      }
    } finally {
      setLoading(false);
    }
  }, [clearLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signInDevice = useCallback(
    async (parentId: string) => {
      save(SESSION_KEY, null);
      save(PARENT_KEY, parentId);
      await refresh();
    },
    [refresh],
  );

  const signInWithSession = useCallback((token: string, acc: Account) => {
    save(SESSION_KEY, token);
    save(PARENT_KEY, null); // Hesaplı ailede cihaz kimliği artık geçerli değildir.
    setAccount(acc);
    setError(null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (load(SESSION_KEY)) await api.logout();
    } catch {
      /* çevrimdışı olsa da yerel oturum kapatılır */
    }
    clearLocal();
  }, [clearLocal]);

  const selectChild = useCallback((id: string | null) => {
    save(CHILD_KEY, id);
    setChildId(id);
  }, []);

  const children = account?.children ?? [];
  const child = children.find((c) => c.id === childId) ?? (children.length === 1 ? children[0] : null);

  const value: AppState = {
    account,
    children,
    child,
    loading,
    error,
    signInDevice,
    signInWithSession,
    logout,
    selectChild,
    refresh,
    celebrate: (items) => items.length && setCelebrations((prev) => [...prev, ...items]),
    celebrations,
    dismissCelebration: () => setCelebrations((prev) => prev.slice(1)),
  };
  return <Ctx.Provider value={value}>{node}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppStateProvider eksik");
  return v;
}

/** Basit veri yükleme kancası. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Bir sorun oluştu."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
