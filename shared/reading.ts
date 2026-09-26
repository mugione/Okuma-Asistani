/**
 * OkuHız domain kuralları. Hem Worker hem frontend tarafından kullanılır;
 * ancak skorlama ve hedef güncellemesi yalnızca backend'de yetkili kabul edilir.
 */

export const TARGET_WPM_MIN = 40;
export const TARGET_WPM_MAX = 200;
export const DEFAULT_TARGET_WPM = 70;
export const TARGET_ACCURACY = 95;
export const TARGET_COMPREHENSION = 80;
export const MAX_ATTEMPTS_PER_DAY = 3;
/** Her okumada soru havuzundan sorulan soru sayısı. */
export const QUESTIONS_PER_SESSION = 5;
/** Bu hızın üzerindeki okumalar "metni atlama" olarak kabul edilip reddedilir. */
export const MAX_REALISTIC_WPM = 350;

export type ReadingMode = "placement" | "normal" | "tracking" | "chunks";
export type OptionKey = "a" | "b" | "c" | "d";

/**
 * Soru havuzundan seçim: önce bu çocuğa bu metinde hiç sorulmamış sorular, sonra en az
 * sorulanlar; eşitlikte rastgele. Sonuç havuzdaki orijinal sırayla döner.
 */
export function pickQuestions(poolIds: number[], askedCounts: Map<number, number>, count: number, random = Math.random): number[] {
  if (poolIds.length <= count) return [...poolIds];
  const ranked = poolIds
    .map((id) => ({ id, asked: askedCounts.get(id) ?? 0, r: random() }))
    .sort((a, b) => a.asked - b.asked || a.r - b.r)
    .slice(0, count)
    .map((q) => q.id);
  const chosen = new Set(ranked);
  return poolIds.filter((id) => chosen.has(id));
}

/** Metni boşluklara göre kelimelere ayırır (seed üretimi ve istemci ile aynı kural). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** WPM = kelime sayısı / dakika. Bir ondalık basamağa yuvarlanır. */
export function calculateWpm(wordCount: number, durationSeconds: number): number {
  if (wordCount <= 0 || durationSeconds <= 0) return 0;
  return Math.round((wordCount / (durationSeconds / 60)) * 10) / 10;
}

export function calculateAccuracy(wordCount: number, errorCount: number): number {
  if (wordCount <= 0) return 0;
  const errors = Math.min(Math.max(errorCount, 0), wordCount);
  return Math.round(((wordCount - errors) / wordCount) * 1000) / 10;
}

export function clampTarget(wpm: number): number {
  return Math.min(TARGET_WPM_MAX, Math.max(TARGET_WPM_MIN, Math.round(wpm)));
}

export interface NextTargetInput {
  currentTargetWpm: number;
  actualWpm: number;
  /** Doğru okuma yüzdesi. Bir yetişkin dinlemediyse bilinmez (null). */
  accuracy: number | null;
  comprehension: number;
}

/**
 * Adaptif hedef algoritması. Öncelik: anlama > doğruluk > akıcılık > hız.
 *
 * - anlama ≥ 90 ve doğruluk ≥ 97 → hedef +%5
 * - anlama ≥ 80 ve doğruluk ≥ 95 → hedef +%3
 * - anlama 70–79               → değişmez
 * - anlama < 70                → hedef −%5
 *
 * Ek güvenceler:
 * - Doğruluk ölçülmediyse (null) yalnızca anlama belirleyicidir, ancak artış en fazla %3 olur.
 * - Anlama iyi ama doğruluk hedefin altındaysa (<95) hedef artırılmaz: önce doğru okuma.
 * - Çocuk mevcut hedefin %90'ına ulaşmadıysa hedef artırılmaz (hızı zorlamamak için).
 */
export function calculateNextTarget({ currentTargetWpm, actualWpm, accuracy, comprehension }: NextTargetInput): number {
  const current = clampTarget(currentTargetWpm);
  let factor = 1;

  if (comprehension < 70) {
    factor = 0.95;
  } else if (comprehension >= 80) {
    const reachedTarget = actualWpm >= current * 0.9;
    if (accuracy === null) {
      if (reachedTarget) factor = 1.03;
    } else if (comprehension >= 90 && accuracy >= 97 && reachedTarget) {
      factor = 1.05;
    } else if (accuracy >= 95 && reachedTarget) {
      factor = 1.03;
    }
  }

  if (factor === 1) return current;
  const next = current * factor;
  // Küçük hedeflerde yuvarlama nedeniyle değişimin kaybolmaması için en az 1 WPM oynat.
  const rounded = factor > 1 ? Math.max(Math.round(next), current + 1) : Math.min(Math.round(next), current - 1);
  return clampTarget(rounded);
}

/** Seviye testinde bu hızın üzeri büyük olasılıkla göz gezdirmedir; başlangıç hedefi bununla sınırlanır. */
export const PLACEMENT_TARGET_MAX = 150;

/** Seviye testi sonrası başlangıç hedefi: gerçek hız, anlamaya göre ayarlanır. */
export function initialTargetFromPlacement(actualWpm: number, comprehension: number): number {
  const base = Math.min(clampTarget(actualWpm), PLACEMENT_TARGET_MAX);
  return calculateNextTarget({
    currentTargetWpm: base,
    actualWpm: Math.min(actualWpm, base),
    accuracy: null,
    comprehension,
  });
}

/** Hedef WPM'e göre 1–5 okuma seviyesi (metin önerisi için). */
export function levelFromTargetWpm(targetWpm: number): number {
  if (targetWpm < 60) return 1;
  if (targetWpm < 80) return 2;
  if (targetWpm < 100) return 3;
  if (targetWpm < 120) return 4;
  return 5;
}

/** 1–3 yıldız: anlama öncelikli. */
export function calculateStars(comprehension: number | null, accuracy: number | null): number {
  if (comprehension === null) return 1;
  if (comprehension >= 90 && (accuracy === null || accuracy >= 95)) return 3;
  if (comprehension >= 80) return 2;
  return 1;
}

export const XP = {
  readingCompleted: 10,
  comprehensionBonus: 10,
  accuracyBonus: 10,
  dailyPractice: 5,
  repeatReading: 5,
  gameCompleted: 5,
  gameAccuracyBonus: 5,
} as const;

/** Tekrarlı okumada ilk okumaya göre akıcılık artışı (%). */
export function improvementPercent(firstWpm: number, latestWpm: number): number {
  if (firstWpm <= 0) return 0;
  return Math.round(((latestWpm - firstWpm) / firstWpm) * 100);
}

export interface TrendPoint {
  date: string;
  value: number | null;
}

/**
 * Sondaki (trailing) hareketli ortalama. Tek günlük yüksek/düşük sonuçların
 * trendi bozmaması için grafikte bu seri gösterilir. Boş günler atlanır.
 */
export function movingAverage(points: TrendPoint[], window = 7): (number | null)[] {
  const out: (number | null)[] = [];
  const buffer: number[] = [];
  for (const p of points) {
    if (p.value !== null) {
      buffer.push(p.value);
      if (buffer.length > window) buffer.shift();
    }
    out.push(buffer.length ? Math.round((buffer.reduce((a, b) => a + b, 0) / buffer.length) * 10) / 10 : null);
  }
  return out;
}

/** Türkiye saati (UTC+3, yaz saati uygulaması yok) ile YYYY-MM-DD. */
export function istanbulDate(date: Date = new Date()): string {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Gün sonunda seri devam ediyor mu? Dün veya bugün çalışıldıysa seri canlıdır. */
export function effectiveStreak(currentStreak: number, lastActiveDate: string | null, today: string): number {
  if (!lastActiveDate) return 0;
  if (lastActiveDate === today || lastActiveDate === addDays(today, -1)) return currentStreak;
  return 0;
}

export function nextStreak(currentStreak: number, lastActiveDate: string | null, today: string): number {
  if (lastActiveDate === today) return Math.max(currentStreak, 1);
  if (lastActiveDate === addDays(today, -1)) return currentStreak + 1;
  return 1;
}
