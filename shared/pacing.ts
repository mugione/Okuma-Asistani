/** Kelime takip ve kelime grupları modları için zamanlama yardımcıları. */

export const COMMA_DELAY_MS = 150;
export const SENTENCE_DELAY_MS = 300;

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

export function punctuationDelay(word: string): number {
  const stripped = word.replace(/["'”’»)\]]+$/, "");
  if (/[.!?…]$/.test(stripped)) return SENTENCE_DELAY_MS;
  if (/[,;:]$/.test(stripped)) return COMMA_DELAY_MS;
  return 0;
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

/** Tek kelime (kelime takip) veya kelime grubu için adım süresi. */
export function stepDuration(tokens: Token[], step: number[], bases: number[]): number {
  const last = tokens[step[step.length - 1]];
  return step.reduce((sum, i) => sum + bases[i], 0) + punctuationDelay(last.text);
}

/** Seviyeye göre grup büyüklüğü: 1–2 → 2 kelime, 3–4 → 3 kelime, 5 → 4 kelime. */
export function chunkSizeForLevel(level: number): number {
  if (level <= 2) return 2;
  if (level <= 4) return 3;
  return 4;
}

/**
 * Kelimeleri anlamlı gruplara ayırır: gruplar cümle sonunu, virgülü ve paragrafı aşmaz.
 * Tek kelimelik artıkları mümkünse bir önceki gruba ekler.
 * Dönen değer: her grup için token indeksleri.
 */
export function buildChunks(tokens: Token[], size: number): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  const flush = () => {
    if (!current.length) return;
    const prev = chunks[chunks.length - 1];
    const prevLast = prev ? tokens[prev[prev.length - 1]] : undefined;
    const canMerge =
      current.length === 1 &&
      prev &&
      prev.length < size + 1 &&
      prevLast &&
      prevLast.paragraph === tokens[current[0]].paragraph &&
      punctuationDelay(prevLast.text) === 0;
    if (canMerge) prev.push(...current);
    else chunks.push(current);
    current = [];
  };
  tokens.forEach((t, i) => {
    if (current.length && tokens[current[0]].paragraph !== t.paragraph) flush();
    current.push(i);
    if (current.length >= size || punctuationDelay(t.text) > 0) flush();
  });
  flush();
  return chunks;
}

