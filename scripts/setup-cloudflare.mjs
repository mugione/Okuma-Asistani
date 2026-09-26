// OkuHız – Cloudflare tam otomatik kurulum ve dağıtım (yalnızca Free plan servisleri).
//
//   1. API token doğrulama + Account ID bulma
//   2. D1 veritabanı "okuhiz-db" oluşturma (varsa yeniden kullanma)
//   3. database_id'yi wrangler.jsonc'ye yazma
//   4. Migration'ları yerel ve uzak veritabanına uygulama + doğrulama
//   5. Build + Workers deploy (gerekirse workers.dev alt alanı kaydı)
//   6. Canlı URL üzerinde duman testi + test verisinin temizlenmesi
//
// Kimlik bilgileri ortam değişkenlerinden veya git'e girmeyen .env dosyasından okunur.
// Token değeri hiçbir zaman yazdırılmaz.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const DB_NAME = "okuhiz-db";
const WORKER_NAME = "okuhiz";
const CONFIG = "wrangler.jsonc";
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

// --- .env (varsa) ---------------------------------------------------------
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error("❌ CLOUDFLARE_API_TOKEN bulunamadı. Ortam değişkeni olarak veya .env dosyasında tanımlayın.");
  process.exit(1);
}

const step = (msg) => console.log(`\n▶ ${msg}`);
const redact = (s) => String(s).split(token).join("***");

function wrangler(args, { json = false, allowFail = false } = {}) {
  const res = spawnSync("npx", ["wrangler", ...args], { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const out = redact((res.stdout ?? "") + (res.stderr ?? ""));
  if (res.status !== 0 && !allowFail) {
    console.error(out);
    throw new Error(`wrangler ${args.slice(0, 3).join(" ")} başarısız oldu`);
  }
  if (json) {
    const start = res.stdout.search(/[[{]/);
    return JSON.parse(res.stdout.slice(start));
  }
  return { ok: res.status === 0, out };
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// --- 1. Token + hesap --------------------------------------------------------
step("API token doğrulanıyor");
const verify = await cf("/user/tokens/verify");
let tokenOk = verify.json?.success && verify.json.result?.status === "active";
if (!tokenOk && process.env.CLOUDFLARE_ACCOUNT_ID) {
  // Hesap düzeyinde (account-owned) token'lar farklı bir doğrulama ucu kullanır.
  const v2 = await cf(`/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/tokens/verify`);
  tokenOk = v2.json?.success && v2.json.result?.status === "active";
}
if (!tokenOk) {
  console.error("❌ Token doğrulanamadı:", JSON.stringify(verify.json?.errors ?? verify.status));
  process.exit(1);
}
console.log("✅ Token aktif");

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  const accounts = await cf("/accounts?per_page=50");
  const list = accounts.json?.result ?? [];
  if (list.length === 1) {
    process.env.CLOUDFLARE_ACCOUNT_ID = list[0].id;
    console.log(`✅ Hesap bulundu: ${list[0].name}`);
  } else {
    console.error(
      list.length
        ? `❌ Token ${list.length} hesaba erişebiliyor; CLOUDFLARE_ACCOUNT_ID tanımlayın:\n` + list.map((a) => `   ${a.id}  ${a.name}`).join("\n")
        : "❌ Hesap listelenemedi. Token'a 'Account Settings: Read' izni verin veya CLOUDFLARE_ACCOUNT_ID tanımlayın.",
    );
    process.exit(1);
  }
}
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const who = wrangler(["whoami"], { allowFail: true });
console.log(who.ok ? "✅ wrangler whoami başarılı" : "⚠️  wrangler whoami uyarı verdi (devam ediliyor)");

// --- 2–3. D1 veritabanı -----------------------------------------------------
step(`D1 veritabanı: ${DB_NAME}`);
let db = wrangler(["d1", "list", "--json"], { json: true }).find((d) => d.name === DB_NAME);
if (db) {
  console.log(`✅ Mevcut veritabanı kullanılıyor (${db.uuid})`);
} else {
  wrangler(["d1", "create", DB_NAME]);
  db = wrangler(["d1", "list", "--json"], { json: true }).find((d) => d.name === DB_NAME);
  if (!db) throw new Error("Veritabanı oluşturuldu ancak listede bulunamadı.");
  console.log(`✅ Veritabanı oluşturuldu (${db.uuid ?? db.database_id})`);
}
db.uuid ??= db.database_id;
const config = readFileSync(CONFIG, "utf8");
const updated = config.replace(/("database_id"\s*:\s*")[^"]*(")/, `$1${db.uuid}$2`);
if (updated !== config) {
  writeFileSync(CONFIG, updated);
  console.log(`✅ database_id ${CONFIG} dosyasına yazıldı`);
} else if (!config.includes(db.uuid)) {
  throw new Error(`${CONFIG} içinde database_id alanı bulunamadı.`);
}

// --- 4. Migration'lar --------------------------------------------------------
step("Migration'lar uygulanıyor (yerel + uzak)");
wrangler(["d1", "migrations", "apply", DB_NAME, "--local"]);
console.log("✅ Yerel veritabanı güncel");
wrangler(["d1", "migrations", "apply", DB_NAME, "--remote"]);
console.log("✅ Uzak (production) veritabanı güncel");

step("Uzak veritabanı doğrulanıyor");
const check = wrangler(
  ["d1", "execute", DB_NAME, "--remote", "--json", "--command",
    `SELECT
      (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN
        ('parents','children','texts','questions','reading_sessions','question_answers','game_sessions','achievements','child_achievements','daily_stats')) tables,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%') indexes,
      (SELECT COUNT(*) FROM texts) texts,
      (SELECT COUNT(*) FROM questions) questions,
      (SELECT COUNT(*) FROM achievements) achievements`],
  { json: true },
)[0].results[0];
console.log(`   tablolar: ${check.tables}/10 · indexler: ${check.indexes} · metinler: ${check.texts} · sorular: ${check.questions} · rozetler: ${check.achievements}`);
if (check.tables !== 10 || check.indexes < 6 || check.texts < 20 || check.questions < 60 || check.achievements < 1) {
  throw new Error("Veritabanı doğrulaması başarısız.");
}
console.log("✅ Tablolar, indexler ve seed verileri doğrulandı");

// --- 4b. Şifre "pepper" secret'ı ---------------------------------------------
// Yalnızca YOKSA oluşturulur. Değiştirilirse mevcut tüm şifreler geçersiz olur!
step("AUTH_PEPPER secret'ı");
const secrets = wrangler(["secret", "list", "--format", "json"], { allowFail: true });
let hasPepper = false;
if (secrets.ok) {
  try {
    hasPepper = JSON.parse(secrets.out.slice(secrets.out.search(/[[{]/))).some((s) => s.name === "AUTH_PEPPER");
  } catch {
    hasPepper = false;
  }
}
if (hasPepper) {
  console.log("✅ AUTH_PEPPER zaten tanımlı (değiştirilmedi)");
} else {
  const put = spawnSync("npx", ["wrangler", "secret", "put", "AUTH_PEPPER"], {
    input: randomBytes(32).toString("base64url"),
    encoding: "utf8",
    env: process.env,
  });
  if (put.status !== 0) throw new Error("AUTH_PEPPER oluşturulamadı: " + redact(put.stderr));
  console.log("✅ AUTH_PEPPER oluşturuldu (değeri hiçbir yerde gösterilmez)");
}
if (!existsSync(".dev.vars")) {
  writeFileSync(".dev.vars", `AUTH_PEPPER=${randomBytes(32).toString("base64url")}\n`, { mode: 0o600 });
  console.log("✅ Yerel geliştirme için .dev.vars oluşturuldu (git'e girmez)");
}

// --- 5. Build + deploy -------------------------------------------------------
step("Frontend derleniyor");
execFileSync("npm", ["run", "build"], { stdio: "inherit" });

step("Cloudflare Workers'a dağıtılıyor");
let deploy = wrangler(["deploy"], { allowFail: true });
if (!deploy.ok && /workers\.dev subdomain|register a workers.dev/i.test(deploy.out)) {
  const sub = (process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || `okuhiz-${accountId.slice(0, 6)}`).toLowerCase();
  console.log(`   workers.dev alt alanı kaydediliyor: ${sub}`);
  const reg = await cf(`/accounts/${accountId}/workers/subdomain`, { method: "PUT", body: JSON.stringify({ subdomain: sub }) });
  if (!reg.json?.success) throw new Error("workers.dev alt alanı kaydedilemedi: " + JSON.stringify(reg.json?.errors));
  deploy = wrangler(["deploy"], { allowFail: true });
}
if (!deploy.ok) {
  console.error(deploy.out);
  throw new Error("Deploy başarısız.");
}
const url = deploy.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
if (!url) {
  console.log(deploy.out);
  throw new Error("Canlı URL deploy çıktısında bulunamadı.");
}
console.log(`✅ Yayında: ${url}`);

// --- 6. Canlı test -------------------------------------------------------------
step("Canlı ortamda duman testi");
let passed = false;
for (let attempt = 1; attempt <= 3 && !passed; attempt++) {
  if (attempt > 1) {
    console.log("   Yeni dağıtımın yayılması bekleniyor…");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  passed = spawnSync("node", ["scripts/smoke-test.mjs", url], { stdio: "inherit" }).status === 0;
}

step("Duman testi verileri temizleniyor");
wrangler(
  ["d1", "execute", DB_NAME, "--remote", "--command",
    `DELETE FROM question_answers WHERE session_id IN (SELECT rs.id FROM reading_sessions rs JOIN children c ON c.id = rs.child_id JOIN parents p ON p.id = c.parent_id WHERE p.name = 'Duman Testi');
     DELETE FROM reading_sessions WHERE child_id IN (SELECT c.id FROM children c JOIN parents p ON p.id = c.parent_id WHERE p.name = 'Duman Testi');
     DELETE FROM game_sessions WHERE child_id IN (SELECT c.id FROM children c JOIN parents p ON p.id = c.parent_id WHERE p.name = 'Duman Testi');
     DELETE FROM child_achievements WHERE child_id IN (SELECT c.id FROM children c JOIN parents p ON p.id = c.parent_id WHERE p.name = 'Duman Testi');
     DELETE FROM daily_stats WHERE child_id IN (SELECT c.id FROM children c JOIN parents p ON p.id = c.parent_id WHERE p.name = 'Duman Testi');
     DELETE FROM children WHERE parent_id IN (SELECT id FROM parents WHERE name = 'Duman Testi');
     DELETE FROM auth_sessions WHERE parent_id IN (SELECT id FROM parents WHERE name = 'Duman Testi');
     DELETE FROM parents WHERE name = 'Duman Testi';`],
  { allowFail: true },
);

if (!passed) {
  console.error(`\n❌ Canlı testler başarısız. URL: ${url}`);
  process.exit(1);
}
console.log(`\n🎉 OkuHız yayında ve testlerden geçti: ${url}`);
