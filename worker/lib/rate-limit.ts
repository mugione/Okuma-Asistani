/**
 * Bağımlılıksız, ücretsiz, en iyi çaba (best-effort) hız sınırlayıcı.
 *
 * Sayaçlar Worker isolate belleğinde tutulur; Cloudflare aynı istemcinin isteklerini
 * çoğunlukla aynı isolate'e yönlendirdiği için kötüye kullanımı (ör. döngüyle binlerce
 * kayıt açmayı) büyük ölçüde keser. Kesin bir kota değildir. Daha güçlü koruma için
 * özel alan adında Cloudflare WAF hız sınırı kuralı eklenebilir.
 */
interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_KEYS = 20_000;

export interface Rule {
  name: string;
  limit: number;
  windowMs: number;
}

export const RULES = {
  /** Tüm API istekleri. */
  api: { name: "api", limit: 240, windowMs: 60_000 },
  /** Yazma istekleri (POST/PUT). */
  write: { name: "write", limit: 60, windowMs: 60_000 },
  /** Yeni aile/çocuk kaydı (okul ağında aynı IP arkasındaki bir sınıf için yeterli). */
  signup: { name: "signup", limit: 30, windowMs: 60 * 60_000 },
  /** Giriş denemeleri (IP ve kullanıcı adı başına ayrı ayrı). */
  login: { name: "login", limit: 10, windowMs: 10 * 60_000 },
} satisfies Record<string, Rule>;

/** İzin verildiyse null, aşıldıysa yeniden deneme süresini (sn) döndürür. */
export function hit(rule: Rule, client: string, now = Date.now()): number | null {
  const key = `${rule.name}:${client}`;
  let w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) prune(now);
    w = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, w);
  }
  w.count++;
  return w.count > rule.limit ? Math.ceil((w.resetAt - now) / 1000) : null;
}

function prune(now: number) {
  for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
  // Hâlâ doluysa en eski anahtarları at (bellek sınırı).
  const overflow = buckets.size - MAX_KEYS / 2;
  if (overflow > 0) [...buckets.keys()].slice(0, overflow).forEach((k) => buckets.delete(k));
}

/** Testler için. */
export function resetRateLimits() {
  buckets.clear();
}
