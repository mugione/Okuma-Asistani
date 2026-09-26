/** Kelime takip ve kelime grupları modları için zamanlama yardımcıları. */
import { buildPhraseChunks, chunkSizeForLevel, endPunctuation } from "./chunking";

export { chunkSizeForLevel };

export interface Token {
  /** Ekranda gösterilecek kelime (noktalama dahil). */
  text: string;
  paragraph: number;
}

export function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  content.split(/\n\s*\n/).forEach((para, paragraph) => {
    for (const w of para.split(/\s+/).filter(Boolean)) tokens.push({ text: w, paragraph });
  });
  return tokens;
}

export function msPerWord(targetWpm: number): number {
  return Math.round(60000 / Math.max(targetWpm, 1));
}

/** En az beklemeler (100 kelime/dk'da bu değerler kullanılır). */
export const COMMA_DELAY_MS = 150;
export const SENTENCE_DELAY_MS = 300;

/**
 * Noktalamadan sonraki bekleme. Okuma araştırmalarında yan cümle ve özellikle cümle sonlarında
 * ek bakma süresi ("wrap-up" etkisi) görülür; bu süre okuma hızıyla orantılıdır. Bu yüzden
 * bekleme kelime süresinin bir oranıdır, ama aşağıdaki en az değerlerin altına inmez:
 *   virgül, noktalı virgül, iki nokta : max(150 ms, kelime süresi × 0,25)
 *   nokta, soru, ünlem, üç nokta      : max(300 ms, kelime süresi × 0,5)
 *   paragraf sonu                    : cümle sonu + kelime süresi × 0,5
 */
export function pauseAfter(tokens: Token[], index: number, targetWpm: number): number {
  const base = msPerWord(targetWpm);
  const token = tokens[index];
  const kind = endPunctuation(token.text);
  const next = tokens[index + 1];
  const paragraphEnd = !next || next.paragraph !== token.paragraph;
  let pause = 0;
  if (kind === "sentence" || paragraphEnd) pause = Math.max(SENTENCE_DELAY_MS, Math.round(base * 0.5));
  else if (kind === "clause") pause = Math.max(COMMA_DELAY_MS, Math.round(base * 0.25));
  if (paragraphEnd && next) pause += Math.round(base * 0.5);
  return pause;
}

/** Türkçede hece sayısı ünlü sayısına eşittir (her hecede tam bir ünlü bulunur). */
export function syllableCount(word: string): number {
  return Math.max(1, word.toLocaleLowerCase("tr-TR").match(/[aeıioöuüâîû]/g)?.length ?? 0);
}

/**
 * Kelime başına temel gösterim süreleri (noktalama beklemesi hariç).
 *
 * Okuma araştırmalarında uzun kelimelere daha uzun bakıldığı bilinir; sondan eklemeli
 * Türkçede ("ev" ↔ "bisikletiyle") bu fark büyüktür. Bu yüzden süre sabit değil,
 * hece sayısına göre ağırlıklandırılır: ağırlık = 0,5 + 0,5 × (hece / ortalama hece).
 * Ağırlıkların ortalaması 1 olduğundan metnin geneli yine hedef WPM hızında akar.
 */
export function wordBaseDurations(tokens: Token[], targetWpm: number): number[] {
  if (!tokens.length) return [];
  const base = msPerWord(targetWpm);
  const syllables = tokens.map((t) => syllableCount(t.text));
  const mean = syllables.reduce((a, b) => a + b, 0) / syllables.length;
  return syllables.map((s) => Math.round(base * (0.5 + 0.5 * (s / mean))));
}

/** Tek kelime (kelime takip) veya kelime grubu için adım süresi: kelime süreleri + son kelimeden sonraki bekleme. */
export function stepDuration(tokens: Token[], step: number[], bases: number[], targetWpm: number): number {
  return step.reduce((sum, i) => sum + bases[i], 0) + pauseAfter(tokens, step[step.length - 1], targetWpm);
}

/** Anlam öbekleri (bkz. chunking.ts). */
export function buildChunks(tokens: Token[], size: number): number[][] {
  return buildPhraseChunks(tokens, size);
}
