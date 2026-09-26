import { z } from "zod";

/**
 * Şifre saklama: PBKDF2-SHA256 + tuz + gizli "pepper" (Worker secret: AUTH_PEPPER).
 *
 * Workers Free planında istek başına CPU süresi kısıtlı olduğundan yineleme sayısı ölçülerek
 * seçilmiştir (~5 ms). Pepper veritabanında değil Worker secret'ında durur; veritabanı
 * sızsa bile pepper olmadan çevrimdışı şifre denemesi yapılamaz. Yineleme sayısı özetin
 * içinde saklandığı için ileride artırılabilir (girişte otomatik yükseltme).
 */
export const PBKDF2_ITERATIONS = 60_000;
export const SESSION_DAYS = 180;

const enc = new TextEncoder();

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Kullanıcı adı en az 3 karakter olmalı.")
  .max(24, "Kullanıcı adı en fazla 24 karakter olabilir.")
  .regex(/^[a-z0-9._-]+$/, "Kullanıcı adında yalnızca küçük harf (a-z), rakam, nokta, tire ve alt çizgi kullanılabilir.");

export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(128, "Şifre en fazla 128 karakter olabilir.");

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, pepper: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`${password}\u0000${pepper}`), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

/** Biçim: pbkdf2-sha256$<yineleme>$<tuz b64>$<özet b64> */
export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, pepper, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
  const bits = await derive(password, pepper, unb64(salt), Number(iter));
  return timingSafeEqual(new Uint8Array(bits), unb64(hash));
}

export function needsRehash(stored: string) {
  return Number(stored.split("$")[1]) < PBKDF2_ITERATIONS;
}

/** Kullanıcı bulunamadığında da aynı sürede cevap vermek için kullanılan sahte özet. */
export const DUMMY_HASH = `pbkdf2-sha256$${PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

/** 256 bit rastgele oturum token'ı (base64url). */
export function newSessionToken(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
