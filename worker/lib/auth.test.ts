import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, newSessionToken, passwordSchema, usernameSchema, verifyPassword } from "./auth";

describe("şifre özeti", () => {
  it("doğru şifreyi kabul eder, yanlışı ve farklı pepper'ı reddeder", async () => {
    const h = await hashPassword("gizli-parola-1", "pepper");
    expect(h.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(await verifyPassword("gizli-parola-1", h, "pepper")).toBe(true);
    expect(await verifyPassword("gizli-parola-2", h, "pepper")).toBe(false);
    expect(await verifyPassword("gizli-parola-1", h, "baska")).toBe(false);
  });
  it("aynı şifre için her seferinde farklı tuz", async () => {
    expect(await hashPassword("abcdefgh", "p")).not.toBe(await hashPassword("abcdefgh", "p"));
  });
  it("bozuk özet reddedilir", async () => expect(await verifyPassword("x", "bozuk", "p")).toBe(false));
  it("düşük yinelemeli özet yükseltilmeli", () => expect(needsRehash("pbkdf2-sha256$1000$a$b")).toBe(true));
});

describe("doğrulama şemaları", () => {
  it("kullanıcı adı küçük harfe çevrilir", () => expect(usernameSchema.parse("  Aras.Okur ")).toBe("aras.okur"));
  it("Türkçe karakter ve boşluk reddedilir", () => {
    expect(usernameSchema.safeParse("ayşe").success).toBe(false);
    expect(usernameSchema.safeParse("ali veli").success).toBe(false);
  });
  it("kısa şifre reddedilir", () => expect(passwordSchema.safeParse("1234567").success).toBe(false));
  it("token 43 karakter base64url", () => expect(newSessionToken()).toMatch(/^[A-Za-z0-9_-]{43}$/));
});
