/** Dinle-Oku: konuşma motorundan bağımsız, test edilebilir yardımcılar. */
import { endPunctuation } from "./chunking";

export interface SpeechToken {
  text: string;
  paragraph: number;
}

export interface Sentence {
  /** Token indeksleri. */
  tokens: number[];
  /** Konuşma motoruna verilecek metin (kelimeler tek boşlukla). */
  text: string;
  /** Her kelimenin `text` içindeki başlangıç karakteri (sınır olaylarını kelimeye eşlemek için). */
  offsets: number[];
}

/** Metni cümlelere ayırır: . ! ? … ve paragraf sonu cümleyi bitirir. */
export function splitSentences(tokens: SpeechToken[]): Sentence[] {
  const sentences: Sentence[] = [];
  let current: number[] = [];
  const flush = () => {
    if (!current.length) return;
    const offsets: number[] = [];
    let text = "";
    current.forEach((i, k) => {
      if (k > 0) text += " ";
      offsets.push(text.length);
      text += tokens[i].text;
    });
    sentences.push({ tokens: current, text, offsets });
    current = [];
  };
  tokens.forEach((t, i) => {
    current.push(i);
    const next = tokens[i + 1];
    if (endPunctuation(t.text) === "sentence" || !next || next.paragraph !== t.paragraph) flush();
  });
  flush();
  return sentences;
}

/** Konuşma motorunun bildirdiği karakter konumunu cümledeki kelime sırasına çevirir. */
export function wordAtChar(sentence: Sentence, charIndex: number): number {
  let k = 0;
  while (k + 1 < sentence.offsets.length && sentence.offsets[k + 1] <= charIndex) k++;
  return k;
}

/**
 * Konuşma motorları doğal hızın çok altına (≈0,8) indirildiğinde belirgin biçimde robotikleşir.
 * Bu yüzden hız 0,8–1,3 aralığında tutulur; daha yavaş bir tempo gerekiyorsa aradaki fark
 * cümleler arasındaki duraklamayla sağlanır (bkz. sentencePause).
 */
export const MIN_RATE = 0.8;
export const MAX_RATE = 1.3;
/** Varsayılan sesin rate=1'deki yaklaşık hızı (kelime/dk). İlk cümleden sonra ölçülerek düzeltilir. */
export const DEFAULT_WPM_AT_RATE_1 = 150;

export function initialRate(desiredWpm: number): number {
  return clampRate(desiredWpm / DEFAULT_WPM_AT_RATE_1);
}

export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(rate * 100) / 100));
}

/**
 * Cümle sonrası duraklama: doğal bir nefes arası (350 ms) + ses hedef tempodan hızlı okuduysa
 * aradaki fark (en fazla 1,5 sn). Böylece ses doğal hızda kalır ama genel tempo hedefe uyar.
 */
export function sentencePause(words: number, elapsedMs: number, desiredWpm: number): number {
  const targetMs = (words / desiredWpm) * 60000;
  return 350 + Math.min(1500, Math.max(0, Math.round(targetMs - elapsedMs)));
}

/** Ses kalitesi puanı: sinir ağı / gelişmiş sesler öne alınır. */
export function voiceQualityScore(voice: { name: string; localService: boolean }): number {
  const n = voice.name.toLowerCase();
  let score = 0;
  if (/(natural|neural|premium|enhanced|gelişmiş|geliştirilmiş|wavenet|studio|online)/.test(n)) score += 3;
  if (/(google|microsoft|siri)/.test(n)) score += 1;
  if (/(compact|kompakt|espeak)/.test(n)) score -= 2;
  if (voice.localService) score += 0.5; // eşitlikte cihaz üzerindeki ses (çevrimdışı çalışır)
  return score;
}

/**
 * Cümle bittikten sonra ölçülen gerçek hıza göre konuşma hızını düzeltir. Sesler cihaza göre
 * farklı hızda konuştuğu için hedefe yavaşça yaklaşılır (yarı yarıya düzeltme, ani sıçrama olmaz).
 */
export function calibrateRate(currentRate: number, words: number, elapsedMs: number, desiredWpm: number): number {
  if (words < 3 || elapsedMs < 500) return currentRate; // çok kısa cümle güvenilir ölçüm vermez
  const actualWpm = words / (elapsedMs / 60000);
  const ideal = currentRate * (desiredWpm / actualWpm);
  return clampRate(currentRate + (ideal - currentRate) * 0.5);
}
