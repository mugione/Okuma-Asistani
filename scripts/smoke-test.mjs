// Kullanım: node scripts/smoke-test.mjs [BASE_URL]   (varsayılan http://127.0.0.1:8787)
// Test verisi "Duman Testi" adlı bir aile altında oluşturulur; sonunda ebeveyn kimliği yazdırılır.
const BASE = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
let parentId = null;
let token = null;
let failures = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : parentId ? { "x-parent-id": parentId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json, text, headers: res.headers };
}
function check(name, cond, info) {
  console.log(`${cond ? "✅" : "❌"} ${name}${!cond && info !== undefined ? " → " + JSON.stringify(info).slice(0, 300) : ""}`);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const health = await call("GET", "/api/health");
check("GET /api/health", health.status === 200 && health.json.data?.db === "ok", health.json);

const home = await fetch(BASE + "/");
const html = await home.text();
check("Frontend açılışı (/)", home.status === 200 && html.includes('id="root"'), home.status);
const spa = await fetch(BASE + "/ebeveyn");
check("SPA yönlendirmesi", spa.status === 200 && (await spa.text()).includes('id="root"'), spa.status);

// PWA
const manifest = await fetch(BASE + "/manifest.webmanifest");
const mjson = await manifest.json().catch(() => ({}));
check("PWA manifest", manifest.ok && mjson.short_name === "OkuHız" && mjson.icons?.some((i) => i.sizes === "512x512"), mjson);
const sw = await fetch(BASE + "/sw.js");
const swText = await sw.text();
check("Service worker", sw.ok && /javascript/.test(sw.headers.get("content-type") ?? "") && swText.includes("okuhiz-shell-") && !swText.includes("= __PRECACHE__"), sw.status);
const icon = await fetch(BASE + "/icons/icon-192.png");
check("PWA ikonları", icon.ok && icon.headers.get("content-type") === "image/png", icon.status);

// Güvenlik başlıkları
const csp = home.headers.get("content-security-policy") ?? "";
check("Frontend CSP (script-src 'self')", csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'none'"), csp);
check("Frontend nosniff", home.headers.get("x-content-type-options") === "nosniff");
check("Üçüncü taraf font isteği yok", !html.includes("fonts.googleapis.com"));
check("API güvenlik başlıkları", health.headers.get("x-content-type-options") === "nosniff" && (health.headers.get("content-security-policy") ?? "").includes("default-src 'none'"));
const foreign = await fetch(BASE + "/api/parents", { method: "POST", headers: { "content-type": "application/json", origin: "https://kotu-site.example" }, body: JSON.stringify({ name: "x" }) });
check("Yabancı Origin'den yazma reddedilir", foreign.status === 403, foreign.status);
const big = await fetch(BASE + "/api/parents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "x".repeat(20000) }) });
check("Büyük istek gövdesi reddedilir (413)", big.status === 413, big.status);

const texts = await call("GET", "/api/texts");
check("Metin listeleme (≥100)", texts.json.success && texts.json.data.length >= 100, texts.json.data?.length);
const detail = await call("GET", `/api/texts/${texts.json.data[0].id}`);
check("Metin detayı + sorular", detail.json.success && detail.json.data.questions.length >= 3, detail.json);
check("Doğru cevap istemciye sızmıyor", !detail.text.includes("correct_option"));

const bad = await call("POST", "/api/children", { name: "" });
check("Zod doğrulama hatası formatı", bad.status === 400 && bad.json.success === false && bad.json.error.code === "VALIDATION_ERROR", bad.json);

const parent = await call("POST", "/api/parents", { name: "Duman Testi" });
check("Ebeveyn oluşturma", parent.status === 201, parent.json);
parentId = parent.json.data.id;

const child = await call("POST", "/api/children", { parentId, name: "Test Çocuk", grade: 3, birthYear: 2017, avatar: "avatar-2" });
check("Çocuk profili oluşturma", child.status === 201 && child.json.data.target_wpm > 0, child.json);
const childId = child.json.data.id;

const forbidden = await fetch(`${BASE}/api/children/${childId}`, { headers: { "x-parent-id": crypto.randomUUID() } });
check("Başka ebeveyn erişemez (403)", forbidden.status === 403, forbidden.status);

const upd = await call("PUT", `/api/children/${childId}`, { avatar: "avatar-5" });
check("Çocuk profili güncelleme", upd.json.data?.avatar === "avatar-5", upd.json);

const today = await call("GET", `/api/children/${childId}/today`);
check("Bugün ekranı", today.json.success && today.json.data.placementTextId, today.json);

// Seviye testi
const placementId = today.json.data.placementTextId;
const placement = await call("GET", `/api/texts/${placementId}`);
const start = await call("POST", "/api/reading/start", { childId, textId: placementId, mode: "placement" });
check("Okuma oturumu başlatma", start.status === 201, start.json);
const sid = start.json.data.sessionId;

const early = await call("POST", `/api/reading/${sid}/answers`, { answers: [{ questionId: 1, selectedOption: "a" }] });
check("Bitirmeden cevap verilemez", early.status === 409, early.json);
const tooFast = await call("POST", `/api/reading/${sid}/finish`, { durationSeconds: 5 });
check("Gerçek dışı hız reddedilir", tooFast.status === 422, tooFast.json);
const tooLong = await call("POST", `/api/reading/${sid}/finish`, { durationSeconds: 900 });
check("Oturumdan uzun süre reddedilir", tooLong.status === 400, tooLong.json);

console.log("… gerçekçi okuma süresi için 22 sn bekleniyor");
await sleep(22_000);
const wc = placement.json.data.word_count;
const finish = await call("POST", `/api/reading/${sid}/finish`, { durationSeconds: 36, errorCount: 2, wpm: 9999 });
const expectedWpm = Math.round((wc / (36 / 60)) * 10) / 10;
check(`WPM backend'de hesaplanır (${expectedWpm})`, finish.json.data?.wpm === expectedWpm, finish.json);
check("İstatistik: XP kazanıldı", finish.json.data?.xpEarned >= 10, finish.json);

const qs = placement.json.data.questions;
const answers = await call("POST", `/api/reading/${sid}/answers`, {
  answers: qs.map((q) => ({ questionId: q.id, selectedOption: "a" })),
});
check("Anlama backend'de puanlanır", answers.json.success && typeof answers.json.data.comprehension === "number", answers.json);
const again = await call("POST", `/api/reading/${sid}/answers`, { answers: qs.map((q) => ({ questionId: q.id, selectedOption: "a" })) });
check("Cevaplar iki kez gönderilemez", again.status === 409, again.json);

const game = await call("POST", "/api/games/result", {
  childId, gameType: "word_catch", totalItems: 10, correctItems: 9, avgReactionMs: 900, displayMs: 700, durationSeconds: 60,
});
check("Oyun sonucu kaydı", game.status === 201, game.json);

const stats = await call("GET", `/api/children/${childId}/stats?range=7`);
check("İstatistik kaydı (7 gün)", stats.json.data?.sessionCount === 1 && stats.json.data.gamesPlayed === 1, stats.json);
const progress = await call("GET", `/api/children/${childId}/progress?range=30`);
check("Gelişim serisi", progress.json.data?.points.length === 30 && progress.json.data.points.at(-1).wpm === expectedWpm, progress.json);
const t2 = await call("GET", `/api/children/${childId}/today`);
check("Günlük özet + seri", t2.json.data?.streak === 1 && t2.json.data.child.placement_completed === 1 && t2.json.data.today.trainingDone, t2.json);
const hist = await call("GET", `/api/children/${childId}/reading-history`);
check("Okuma geçmişi (seviye testi hariç)", hist.json.success && Array.isArray(hist.json.data) && hist.json.data.length === 0, hist.json);
const ach = await call("GET", `/api/children/${childId}/achievements`);
check("Rozetler", ach.json.data?.some((a) => a.id === "first_reading" && a.earned_at), ach.json);

// Soru havuzu: normal okumada havuzdan QUESTIONS_PER_SESSION soru gelir.
const poolText = texts.json.data.find((t) => t.slug === "kar-taneleri") ?? texts.json.data[1];
const poolDetail = await call("GET", `/api/texts/${poolText.id}`);
const poolStart = await call("POST", "/api/reading/start", { childId, textId: poolText.id, mode: "normal" });
check(
  `Soru havuzu (${poolDetail.json.data?.questions.length} sorudan 5 seçilir)`,
  poolStart.json.data?.questions?.length === Math.min(5, poolDetail.json.data?.questions.length ?? 0),
  poolStart.json,
);

// --- Hesap: kullanıcı adı + şifre -------------------------------------------
const anonParentId = parentId;
const username = `duman-${Math.random().toString(36).slice(2, 10)}`;
const password = `Test-${crypto.randomUUID()}`;
parentId = null;
const weak = await call("POST", "/api/auth/register", { name: "Duman Testi", username, password: "kisa" });
check("Kısa şifre reddedilir", weak.status === 400, weak.json);
const reg = await call("POST", "/api/auth/register", { name: "Duman Testi", username, password });
check("Kullanıcı adı + şifre ile kayıt", reg.status === 201 && typeof reg.json.data?.token === "string", reg.json);
check("Şifre özeti yanıtta yok", !reg.text.includes("password_hash") && !reg.text.includes("pbkdf2"));
const dup = await call("POST", "/api/auth/register", { name: "Duman Testi", username, password });
check("Aynı kullanıcı adı alınamaz", dup.status === 409, dup.json);
const regParentId = reg.json.data?.account?.id;

token = reg.json.data?.token;
const me = await call("GET", "/api/auth/me");
check("Oturumla hesap bilgisi (/api/auth/me)", me.json.data?.username === username && me.json.data?.has_password === true, me.json);
const kid = await call("POST", "/api/children", { parentId: regParentId, name: "Hesaplı Çocuk", avatar: "avatar-4" });
check("Oturumla çocuk ekleme", kid.status === 201, kid.json);
token = null;

parentId = regParentId;
const bypass = await call("GET", "/api/auth/me");
check("Hesaplı aileye X-Parent-Id ile erişilemez", bypass.status === 401, bypass.json);
parentId = null;

const badLogin = await call("POST", "/api/auth/login", { username, password: "yanlis-sifre-123" });
check("Yanlış şifre reddedilir", badLogin.status === 401 && badLogin.json.error?.code === "INVALID_CREDENTIALS", badLogin.json);
const noUser = await call("POST", "/api/auth/login", { username: `${username}x`, password });
check("Olmayan kullanıcıda aynı hata", noUser.status === 401 && noUser.json.error?.code === "INVALID_CREDENTIALS", noUser.json);
const login = await call("POST", "/api/auth/login", { username: username.toUpperCase(), password });
check("Başka cihazdan giriş (büyük/küçük harf duyarsız)", login.json.data?.account?.children?.length === 1, login.json);

token = login.json.data?.token;
const out = await call("POST", "/api/auth/logout");
check("Çıkış", out.json.data?.loggedOut === true, out.json);
const afterOut = await call("GET", "/api/auth/me");
check("Çıkıştan sonra token geçersiz", afterOut.status === 401, afterOut.json);
token = null;

parentId = anonParentId;
const creds = await call("POST", "/api/auth/credentials", { username: `${username}-b`, password });
check("Hesapsız aileye kullanıcı adı/şifre ekleme", creds.json.success && !!creds.json.data?.token, creds.json);
const oldId = await call("GET", "/api/auth/me");
check("Hesap eklenince cihaz kimliği geçersizleşir", oldId.status === 401, oldId.json);
parentId = null;

const nf = await call("GET", "/api/yok");
check("API 404 formatı", nf.status === 404 && nf.json.error?.code === "NOT_FOUND", nf.json);

console.log(`\nTest ebeveyn kimliği: ${parentId}`);
console.log(failures ? `❌ ${failures} test başarısız` : "✅ Tüm testler geçti");
process.exit(failures ? 1 : 0);
