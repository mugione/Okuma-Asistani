// seed/texts.json            → migrations/0003_seed.sql       (ilk içerik + rozetler)
// seed/texts-extra/*.json     → migrations/0004_more_texts.sql (ek metinler)
// seed/questions-extra/*.json → migrations/0007_more_questions.sql (soru havuzunu genişletir)
// Kelime sayısı ve tahmini süre burada hesaplanır; elle girilmez.
// Not: Uygulanmış migration'lar değiştirilmemeli; yeni içerik için yeni bir dosya/migration ekleyin.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { atesman, effectiveDifficulty } from "../shared/readability.ts";

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const texts = readJson("../seed/texts.json");
const extraDir = new URL("../seed/texts-extra/", import.meta.url);
const readDir = (dir) => {
  const url = new URL(`../seed/${dir}/`, import.meta.url);
  return existsSync(url)
    ? readdirSync(url).filter((f) => f.endsWith(".json")).sort().flatMap((f) => readJson(`../seed/${dir}/${f}`))
    : [];
};
const extra = readDir("texts-extra");
const extraQuestions = readDir("questions-extra");
const CATEGORIES = ["Uzay", "Hayvanlar", "Bilim", "Doğa", "Macera", "Spor", "Teknoloji", "Günlük Yaşam", "Tarih", "Keşif"];
const TYPICAL_WPM = 80; // 3. sınıf için ortalama okuma hızı varsayımı

const q = (s) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const countWords = (s) => s.split(/\s+/).filter(Boolean).length;

const achievements = [
  ["first_reading", "İlk Adım", "İlk okumanı tamamladın.", "Footprints", "readings", 1],
  ["readings_10", "Kitap Kurdu", "10 okuma tamamladın.", "BookOpen", "readings", 10],
  ["readings_50", "Okuma Ustası", "50 okuma tamamladın.", "Library", "readings", 50],
  ["streak_3", "Üç Gün Üst Üste", "3 gün arka arkaya çalıştın.", "Flame", "streak", 3],
  ["streak_7", "Haftalık Seri", "7 gün arka arkaya çalıştın.", "CalendarCheck", "streak", 7],
  ["streak_30", "Ay Yıldızı", "30 gün arka arkaya çalıştın.", "Moon", "streak", 30],
  ["perfect_comprehension", "Dikkatli Okur", "Bir metnin tüm sorularını doğru cevapladın.", "Brain", "perfect_comprehension", 1],
  ["comprehension_5", "Anlama Şampiyonu", "5 okumada %80 ve üzeri anlama yaptın.", "Lightbulb", "good_comprehension", 5],
  ["words_1000", "Bin Kelime", "Toplam 1.000 kelime okudun.", "Type", "words", 1000],
  ["words_10000", "On Bin Kelime", "Toplam 10.000 kelime okudun.", "Mountain", "words", 10000],
  ["repeat_reader", "Tekrar Tekrar", "Bir metni 3 kez okudun.", "Repeat", "third_attempt", 1],
  ["fluency_up", "Akıcı Okur", "Tekrar okumada ilk okumana göre %15 daha akıcı okudun.", "TrendingUp", "improvement", 15],
  ["games_10", "Oyun Sever", "10 kelime oyunu tamamladın.", "Gamepad2", "games", 10],
  ["xp_500", "Parlayan Yıldız", "500 XP topladın.", "Star", "xp", 500],
  ["all_categories", "Kâşif", "Her kategoriden en az bir metin okudun.", "Compass", "categories", 10],
];

const errors = [];
const slugs = new Set();
[...texts, ...extra].forEach((t, i) => {
  const wc = countWords(t.content);
  if (slugs.has(t.slug)) errors.push(`${t.slug}: tekrar eden slug`);
  slugs.add(t.slug);
  if (!CATEGORIES.includes(t.category)) errors.push(`${t.slug}: geçersiz kategori ${t.category}`);
  if (wc < 150 || wc > 300) errors.push(`${t.slug}: kelime sayısı ${wc}`);
  if (!(t.difficulty >= 1 && t.difficulty <= 5)) errors.push(`${t.slug}: zorluk ${t.difficulty}`);
  if (t.questions.length < 3 || t.questions.length > 5) errors.push(`${t.slug}: soru sayısı ${t.questions.length}`);
  for (const qu of t.questions) {
    if (qu.options.length !== 4 || !["a", "b", "c", "d"].includes(qu.correct)) errors.push(`${t.slug}: hatalı soru "${qu.question}"`);
  }
  if (i === 0 && t.slug !== "seviye-testi") errors.push("ilk metin seviye-testi olmalı");
});
if (texts.length + extra.length < 20) errors.push(`en az 20 metin gerekli (${texts.length})`);
const knownSlugs = new Set([...texts, ...extra].map((t) => t.slug));
const questionSlugs = new Set();
for (const entry of extraQuestions) {
  if (!knownSlugs.has(entry.slug)) errors.push(`soru havuzu: bilinmeyen metin ${entry.slug}`);
  if (questionSlugs.has(entry.slug)) errors.push(`soru havuzu: tekrar eden metin ${entry.slug}`);
  questionSlugs.add(entry.slug);
  const existing = new Set([...texts, ...extra].find((t) => t.slug === entry.slug)?.questions.map((q) => q.question) ?? []);
  for (const qu of entry.questions) {
    if (qu.options.length !== 4 || new Set(qu.options).size !== 4 || !["a", "b", "c", "d"].includes(qu.correct)) {
      errors.push(`${entry.slug}: hatalı ek soru "${qu.question}"`);
    }
    if (existing.has(qu.question)) errors.push(`${entry.slug}: soru zaten var "${qu.question}"`);
  }
}
if (errors.length) {
  console.error("Seed doğrulama hataları:\n" + errors.join("\n"));
  process.exit(1);
}

function questionStatement(slug, qu) {
  const [a, b, c, d] = qu.options;
  return `INSERT INTO questions (text_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) SELECT id, ${q(qu.question)}, ${q(a)}, ${q(b)}, ${q(c)}, ${q(d)}, ${q(qu.correct)}, ${q(qu.explanation)} FROM texts WHERE slug = ${q(slug)};`;
}

function textStatements(t) {
  const out = [];
  const wc = countWords(t.content);
  const est = Math.round((wc / TYPICAL_WPM) * 60);
  out.push(
    `INSERT INTO texts (slug, title, content, category, difficulty, grade_level, word_count, estimated_duration, source_type, is_placement) VALUES (${q(t.slug)}, ${q(t.title)}, ${q(t.content)}, ${q(t.category)}, ${t.difficulty}, ${t.grade_level}, ${wc}, ${est}, 'system', ${t.slug === "seviye-testi" ? 1 : 0});`,
  );
  for (const qu of t.questions) {
    const [a, b, c, d] = qu.options;
    out.push(
      `INSERT INTO questions (text_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) SELECT id, ${q(qu.question)}, ${q(a)}, ${q(b)}, ${q(c)}, ${q(d)}, ${q(qu.correct)}, ${q(qu.explanation)} FROM texts WHERE slug = ${q(t.slug)};`,
    );
  }
  out.push("");
  return out;
}

const out = ["-- OTOMATİK ÜRETİLDİ: npm run seed:generate (kaynak: seed/texts.json)", ""];
for (const t of texts) out.push(...textStatements(t));
achievements.forEach(([id, title, desc, icon, type, value], i) => {
  out.push(
    `INSERT INTO achievements (id, title, description, icon, criteria_type, criteria_value, sort_order) VALUES (${q(id)}, ${q(title)}, ${q(desc)}, ${q(icon)}, ${q(type)}, ${value}, ${i + 1});`,
  );
});
writeFileSync(new URL("../migrations/0003_seed.sql", import.meta.url), out.join("\n") + "\n");
if (extra.length) {
  const more = ["-- OTOMATİK ÜRETİLDİ: npm run seed:generate (kaynak: seed/texts-extra/*.json)", ""];
  for (const t of extra) more.push(...textStatements(t));
  writeFileSync(new URL("../migrations/0004_more_texts.sql", import.meta.url), more.join("\n") + "\n");
  console.log(`0004_more_texts.sql yazıldı: ${extra.length} metin, ${extra.reduce((n, t) => n + t.questions.length, 0)} soru.`);
}
if (extraQuestions.length) {
  const out7 = ["-- OTOMATİK ÜRETİLDİ: npm run seed:generate (kaynak: seed/questions-extra/*.json)", ""];
  for (const entry of extraQuestions) {
    for (const qu of entry.questions) out7.push(questionStatement(entry.slug, qu));
  }
  writeFileSync(new URL("../migrations/0007_more_questions.sql", import.meta.url), out7.join("\n") + "\n");
  console.log(`0007_more_questions.sql yazıldı: ${extraQuestions.length} metin, ${extraQuestions.reduce((n, e) => n + e.questions.length, 0)} soru.`);
}
// Ateşman okunabilirliği ve birleşik zorluk: çalışma anında değil, burada bir kez hesaplanır.
{
  const out12 = [
    "-- OTOMATİK ÜRETİLDİ: npm run seed:generate — Ateşman (1997) okunabilirlik puanı ve birleşik zorluk.",
    "-- Yeni metin eklenirse bu değerler için yeni bir migration üretin (uygulanmış migration değiştirilmez).",
    "ALTER TABLE texts ADD COLUMN readability_score REAL;",
    "ALTER TABLE texts ADD COLUMN readability_level INTEGER;",
    "ALTER TABLE texts ADD COLUMN effective_difficulty INTEGER;",
    "",
  ];
  const levels = {};
  for (const t of [...texts, ...extra]) {
    const r = atesman(t.content);
    const eff = effectiveDifficulty(t.difficulty, r.level);
    levels[eff] = (levels[eff] ?? 0) + 1;
    out12.push(
      `UPDATE texts SET readability_score = ${r.score}, readability_level = ${r.level}, effective_difficulty = ${eff} WHERE slug = ${q(t.slug)};`,
    );
  }
  out12.push("CREATE INDEX idx_texts_effective_difficulty ON texts(effective_difficulty);");
  writeFileSync(new URL("../migrations/0012_readability.sql", import.meta.url), out12.join("\n") + "\n");
  console.log(`0012_readability.sql yazıldı: birleşik zorluk dağılımı ${JSON.stringify(levels)}`);
}
console.log(`0003_seed.sql yazıldı: ${texts.length} metin, ${texts.reduce((n, t) => n + t.questions.length, 0)} soru, ${achievements.length} rozet.`);
