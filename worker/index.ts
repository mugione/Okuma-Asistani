import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./env";
import { sha256Hex } from "./lib/auth";
import { first, nowIso } from "./lib/db";
import { ApiError, fail, ok } from "./lib/http";
import { hit, RULES } from "./lib/rate-limit";
import { auth } from "./routes/auth";
import { children } from "./routes/children";
import { games } from "./routes/games";
import { minute } from "./routes/minute";
import { parents } from "./routes/parents";
import { reading } from "./routes/reading";
import { texts } from "./routes/texts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const app = new Hono<AppEnv>();

// API yanıtları için güvenlik başlıkları (statik dosyalar için bkz. public/_headers).
app.use(
  "/api/*",
  secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    crossOriginResourcePolicy: "same-origin",
    referrerPolicy: "no-referrer",
    xFrameOptions: "DENY",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
  }),
);

app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  const isWrite = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  // Tarayıcıdan gelen yazma isteklerinde köken kontrolü (CSRF'ye karşı ek katman).
  // Sunucudan sunucuya istemcilerde Origin başlığı olmadığı için etkilenmezler.
  if (isWrite) {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(c.req.url).origin) {
      return fail(c, 403, "FORBIDDEN_ORIGIN", "Bu kaynaktan istek kabul edilmiyor.");
    }
  }

  // Hız sınırlama (istemci IP'si Cloudflare tarafından sağlanır).
  const client = c.req.header("CF-Connecting-IP") ?? "local";
  const signup =
    method === "POST" && ["/api/parents", "/api/children", "/api/auth/register", "/api/auth/credentials"].includes(c.req.path);
  const retry =
    hit(RULES.api, client) ?? (isWrite ? hit(RULES.write, client) : null) ?? (signup ? hit(RULES.signup, client) : null);
  if (retry !== null) {
    c.header("Retry-After", String(retry));
    return fail(c, 429, "RATE_LIMITED", "Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.");
  }

  // Kimlik: 1) kullanıcı adı/şifreyle açılmış oturum (Authorization: Bearer <token>)
  //         2) hesabı olmayan aileler için cihazda saklanan X-Parent-Id.
  //            Kullanıcı adı/şifre belirlenmiş bir aile X-Parent-Id ile ERİŞİLEMEZ.
  c.set("parentId", null);
  c.set("sessionHash", null);
  const bearer = c.req.header("Authorization")?.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/)?.[1];
  if (bearer) {
    const hash = await sha256Hex(bearer);
    const session = await first<{ parent_id: string }>(
      c.env.DB, "SELECT parent_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?", hash, nowIso());
    if (session) {
      c.set("parentId", session.parent_id);
      c.set("sessionHash", hash);
    }
  } else {
    const header = c.req.header("X-Parent-Id");
    if (header && UUID_RE.test(header)) {
      const id = header.toLowerCase();
      const row = await first<{ username: string | null }>(c.env.DB, "SELECT username FROM parents WHERE id = ?", id);
      if (row && row.username === null) c.set("parentId", id);
    }
  }
  await next();
  c.header("Cache-Control", "no-store");
});

// En büyük meşru istek (5 cevap) ~1 KB'tır; 16 KB üzeri reddedilir.
app.use(
  "/api/*",
  bodyLimit({ maxSize: 16 * 1024, onError: (c) => fail(c, 413, "PAYLOAD_TOO_LARGE", "İstek çok büyük.") }),
);

app.get("/api/health", async (c) => {
  let db: "ok" | "error" = "ok";
  let textCount = 0;
  try {
    textCount = (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) n FROM texts"))?.n ?? 0;
  } catch {
    db = "error";
  }
  return ok(c, { status: db === "ok" ? "ok" : "degraded", db, textCount, time: new Date().toISOString() }, db === "ok" ? 200 : 503);
});

app.route("/api/auth", auth);
app.route("/api/parents", parents);
app.route("/api/children", children);
app.route("/api/texts", texts);
app.route("/api/reading", reading);
app.route("/api/games", games);
app.route("/api/minute", minute);

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) return fail(c, 404, "NOT_FOUND", "İstenen API adresi bulunamadı.");
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  if (err instanceof ApiError) return fail(c, err.status, err.code, err.message, err.details);
  // Ayrıntılar yalnızca Worker loglarına yazılır; istemciye genel mesaj döner.
  console.error("Beklenmeyen hata:", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  return fail(c, 500, "INTERNAL_ERROR", "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.");
});

export default app;
