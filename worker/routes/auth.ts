import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AuthResult } from "../../shared/api-types";
import type { AppEnv } from "../env";
import {
  DUMMY_HASH,
  hashPassword,
  needsRehash,
  newSessionToken,
  passwordSchema,
  SESSION_DAYS,
  sha256Hex,
  usernameSchema,
  verifyPassword,
} from "../lib/auth";
import { first, newId, nowIso } from "../lib/db";
import { ApiError, ok, parse, readJson } from "../lib/http";
import { loadAccount } from "../lib/parents";
import { hit, RULES } from "../lib/rate-limit";

const registerSchema = z.object({ name: z.string().trim().min(1).max(60), username: usernameSchema, password: passwordSchema });
const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) });
const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

export const auth = new Hono<AppEnv>();

function pepper(c: Context<AppEnv>) {
  if (!c.env.AUTH_PEPPER) console.warn("AUTH_PEPPER tanımlı değil: şifreler pepper olmadan özetleniyor.");
  return c.env.AUTH_PEPPER ?? "";
}

async function createSession(c: Context<AppEnv>, parentId: string): Promise<string> {
  const token = newSessionToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(now.toISOString()),
    c.env.DB.prepare("INSERT INTO auth_sessions (token_hash, parent_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
      .bind(await sha256Hex(token), parentId, now.toISOString(), expires, now.toISOString()),
  ]);
  return token;
}

async function authResult(c: Context<AppEnv>, parentId: string, token: string): Promise<AuthResult> {
  const account = await loadAccount(c.env.DB, parentId);
  if (!account) throw new ApiError(404, "NOT_FOUND", "Hesap bulunamadı.");
  return { token, account };
}

const isUniqueError = (e: unknown) => String(e).includes("UNIQUE");
const usernameTaken = () => new ApiError(409, "USERNAME_TAKEN", "Bu kullanıcı adı alınmış. Başka bir tane deneyin.");

/** Yeni aile + kullanıcı adı/şifre (e-posta yok). */
auth.post("/register", async (c) => {
  const body = parse(registerSchema, await readJson(c));
  const id = newId();
  const now = nowIso();
  const hash = await hashPassword(body.password, pepper(c));
  try {
    await c.env.DB.prepare(
      "INSERT INTO parents (id, name, email, username, password_hash, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?)",
    )
      .bind(id, body.name, body.username, hash, now, now)
      .run();
  } catch (e) {
    if (isUniqueError(e)) throw usernameTaken();
    throw e;
  }
  return ok(c, await authResult(c, id, await createSession(c, id)), 201);
});

auth.post("/login", async (c) => {
  const body = parse(loginSchema, await readJson(c));
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  // Kaba kuvvet denemelerine karşı hem IP hem kullanıcı adı başına sınır.
  const retry = hit(RULES.login, `ip:${ip}`) ?? hit(RULES.login, `u:${body.username}`);
  if (retry !== null) {
    c.header("Retry-After", String(retry));
    throw new ApiError(429, "RATE_LIMITED", "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.");
  }
  const row = await first<{ id: string; password_hash: string | null }>(
    c.env.DB, "SELECT id, password_hash FROM parents WHERE username = ?", body.username);
  // Kullanıcı yoksa da aynı hesaplamayı yap (zamanlamadan kullanıcı adı tahmin edilemesin).
  const valid = await verifyPassword(body.password, row?.password_hash ?? DUMMY_HASH, pepper(c));
  if (!row || !row.password_hash || !valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Kullanıcı adı veya şifre hatalı.");
  }
  if (needsRehash(row.password_hash)) {
    await c.env.DB.prepare("UPDATE parents SET password_hash = ? WHERE id = ?")
      .bind(await hashPassword(body.password, pepper(c)), row.id).run();
  }
  return ok(c, await authResult(c, row.id, await createSession(c, row.id)));
});

/** Hesabı olmayan (yalnızca bu cihazda kayıtlı) aileye kullanıcı adı ve şifre ekler. */
auth.post("/credentials", async (c) => {
  const parentId = c.get("parentId");
  if (!parentId) throw new ApiError(401, "UNAUTHORIZED", "Önce bu cihazda bir aile oluşturulmalı.");
  const body = parse(credentialsSchema, await readJson(c));
  const current = await first<{ username: string | null }>(c.env.DB, "SELECT username FROM parents WHERE id = ?", parentId);
  if (!current) throw new ApiError(404, "NOT_FOUND", "Hesap bulunamadı.");
  if (current.username) throw new ApiError(409, "ALREADY_HAS_ACCOUNT", "Bu ailenin zaten bir kullanıcı adı var.");
  const hash = await hashPassword(body.password, pepper(c));
  try {
    await c.env.DB.prepare("UPDATE parents SET username = ?, password_hash = ?, updated_at = ? WHERE id = ? AND username IS NULL")
      .bind(body.username, hash, nowIso(), parentId)
      .run();
  } catch (e) {
    if (isUniqueError(e)) throw usernameTaken();
    throw e;
  }
  return ok(c, await authResult(c, parentId, await createSession(c, parentId)));
});

/** Şifre değiştirme; bu cihaz dışındaki tüm oturumlar kapatılır. */
auth.post("/password", async (c) => {
  const parentId = c.get("parentId");
  const sessionHash = c.get("sessionHash");
  if (!parentId || !sessionHash) throw new ApiError(401, "UNAUTHORIZED", "Oturum açmanız gerekiyor.");
  const body = parse(changePasswordSchema, await readJson(c));
  const row = await first<{ password_hash: string | null }>(c.env.DB, "SELECT password_hash FROM parents WHERE id = ?", parentId);
  if (!row?.password_hash || !(await verifyPassword(body.currentPassword, row.password_hash, pepper(c)))) {
    throw new ApiError(400, "INVALID_CREDENTIALS", "Mevcut şifre hatalı.");
  }
  const hash = await hashPassword(body.newPassword, pepper(c));
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE parents SET password_hash = ?, updated_at = ? WHERE id = ?").bind(hash, nowIso(), parentId),
    c.env.DB.prepare("DELETE FROM auth_sessions WHERE parent_id = ? AND token_hash != ?").bind(parentId, sessionHash),
  ]);
  return ok(c, { changed: true });
});

auth.post("/logout", async (c) => {
  const sessionHash = c.get("sessionHash");
  if (sessionHash) await c.env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(sessionHash).run();
  return ok(c, { loggedOut: true });
});

auth.get("/me", async (c) => {
  const parentId = c.get("parentId");
  if (!parentId) throw new ApiError(401, "UNAUTHORIZED", "Oturum bulunamadı.");
  const account = await loadAccount(c.env.DB, parentId);
  if (!account) throw new ApiError(401, "UNAUTHORIZED", "Oturum bulunamadı.");
  return ok(c, account);
});
