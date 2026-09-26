export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Şifre özetlerine eklenen gizli değer (wrangler secret). Yerelde .dev.vars içinde. */
  AUTH_PEPPER?: string;
}

export interface Variables {
  /** İsteği yapan aile: Bearer oturum token'ından ya da (hesabı olmayan aileler için) X-Parent-Id'den. */
  parentId: string | null;
  /** Bearer oturumla gelindiyse token özeti (çıkış için). */
  sessionHash: string | null;
}

export type AppEnv = { Bindings: Env; Variables: Variables };
