/**
 * Ateşman (1997) Türkçe okunabilirlik formülü:
 *   Okunabilirlik = 198,825 − 40,175 × (hece / kelime) − 2,610 × (kelime / cümle)
 * Puan yükseldikçe metin kolaylaşır. Resmî bantlar:
 *   90–100 çok kolay · 70–89 kolay · 50–69 orta güçlükte · 30–49 zor · 1–29 çok zor
 *
 * Not: Dosya bilerek bağımsızdır (import yok); seed üreticisi (Node) de doğrudan kullanır.
 */

const VOWELS = /[aeıioöuüâîûAEIİOÖUÜÂÎÛ]/g;

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** 0–999999 arası sayının Türkçe okunuşu ("1969" → "bin dokuz yüz altmış dokuz"). */
export function numberToTurkish(n: number): string {
  if (n === 0) return "sıfır";
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (thousands) parts.push(thousands === 1 ? "bin" : `${numberToTurkish(thousands)} bin`);
  const h = Math.floor(rest / 100);
  if (h) parts.push(h === 1 ? "yüz" : `${ONES[h]} yüz`);
  const t = Math.floor((rest % 100) / 10);
  if (t) parts.push(TENS[t]);
  const o = rest % 10;
  if (o) parts.push(ONES[o]);
  return parts.join(" ");
}

/** Kelimenin hece sayısı (Türkçede her hecede bir ünlü vardır). Sayılar okunuşlarına göre sayılır. */
export function wordSyllables(word: string): number {
  const digits = word.replace(/[^\d]/g, "");
  if (digits && /^\D*\d+([.,]\d+)?\D*$/.test(word) && digits.length <= 6) {
    return (numberToTurkish(Number(digits)).match(VOWELS) ?? []).length;
  }
  return Math.max(1, (word.match(VOWELS) ?? []).length);
}

export interface Readability {
  /** Ateşman puanı (bir ondalık). */
  score: number;
  /** Resmî Ateşman bandı. */
  label: "çok kolay" | "kolay" | "orta güçlükte" | "zor" | "çok zor";
  /** Uygulama içi okunabilirlik seviyesi 1 (en kolay) – 5 (en zor). */
  level: number;
  syllablesPerWord: number;
  wordsPerSentence: number;
}

export function atesmanLabel(score: number): Readability["label"] {
  if (score >= 90) return "çok kolay";
  if (score >= 70) return "kolay";
  if (score >= 50) return "orta güçlükte";
  if (score >= 30) return "zor";
  return "çok zor";
}

/**
 * Resmî bantlar 3.–4. sınıf metinlerini ayırt etmek için kaba kalır (metinlerin çoğu "kolay" ya da
 * "orta" çıkar). Seviye için kesme noktaları, uygulamadaki 102 metnin elle verilen zorluk
 * gruplarının Ateşman ortalamalarının orta noktalarıdır (86,3 · 76,9 · 69,5 · 64,2 · 56,4).
 */
export const LEVEL_CUTS = [81.5, 73, 67, 60] as const;

export function atesmanLevel(score: number): number {
  const idx = LEVEL_CUTS.findIndex((cut) => score >= cut);
  return idx === -1 ? 5 : idx + 1;
}

export function atesman(content: string): Readability {
  const words = content.split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, words.filter((w) => /[.!?…]["”’')]*$/.test(w)).length);
  const syllables = words.reduce((sum, w) => sum + wordSyllables(w), 0);
  const spw = syllables / Math.max(1, words.length);
  const wps = words.length / sentences;
  const score = Math.round((198.825 - 40.175 * spw - 2.61 * wps) * 10) / 10;
  return {
    score,
    label: atesmanLabel(score),
    level: atesmanLevel(score),
    syllablesPerWord: Math.round(spw * 100) / 100,
    wordsPerSentence: Math.round(wps * 10) / 10,
  };
}

/**
 * Birleşik zorluk (1–5): ilk isterlerdeki dört ölçüt – kelime uzunluğu ve cümle uzunluğu
 * (Ateşman seviyesi) ile kavramsal zorluk (içerik zorluğu) – eşit ağırlıkla; metin uzunluğu
 * içerik zorluğuna zaten yansır (zor metinler daha uzundur).
 */
export function effectiveDifficulty(contentDifficulty: number, readabilityLevel: number): number {
  return Math.min(5, Math.max(1, Math.round((contentDifficulty + readabilityLevel) / 2)));
}
