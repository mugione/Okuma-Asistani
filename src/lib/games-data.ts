import base from "../../seed/games.json";
import extraSentences from "../../seed/games-extra/sentences.json";
import verify from "../../seed/games-extra/sentence-verify.json";
import antonyms from "../../seed/games-extra/antonyms.json";
import spelling from "../../seed/games-extra/spelling.json";
import extraWords from "../../seed/games-extra/word-catch.json";

export interface WordCatchItem { word: string; options: string[] }
export interface SentenceRecallItem { sentence: string; question: string; options: string[] }
export interface MissingWordItem { sentence: string; options: string[] }
export interface SentenceVerifyItem { sentence: string; answer: boolean; level: 1 | 2 | 3 }
export interface AntonymItem { word: string; options: string[]; level: 1 | 2 | 3 }
export interface SpellingItem { correct: string; wrong: string[]; tip: string; level: 1 | 2 | 3 }

const byLength = (a: WordCatchItem, b: WordCatchItem) => a.word.length - b.word.length;

export const GAME_DATA = {
  // Kısadan uzuna sıralı: oyun ilerledikçe kelimeler uzar.
  wordCatch: [...base.wordCatch, ...extraWords.wordCatch].sort(byLength) as WordCatchItem[],
  sentenceRecall: [...base.sentenceRecall, ...extraSentences.sentenceRecall] as SentenceRecallItem[],
  missingWord: [...base.missingWord, ...extraSentences.missingWord] as MissingWordItem[],
  sentenceVerify: verify.sentenceVerify as SentenceVerifyItem[],
  antonyms: antonyms.antonyms as AntonymItem[],
  spelling: spelling.spelling as SpellingItem[],
};

const lowerWords = (words: string[]) =>
  [...new Set(words.map((w) => w.toLocaleLowerCase("tr-TR")))].filter((w) => /^[a-zçğıöşü]+$/.test(w));

/** Oyunlarda SORULAN kelimeler: Kelimeyi Yakala'nın ana (hedef) kelimeleri; yaygın, çocukların bildiği kelimeler. */
export const PRIMARY_WORDS: string[] = lowerWords(GAME_DATA.wordCatch.map((w) => w.word));

/**
 * Kelime zincirinde çocuğun bölmesini KABUL ETMEK için geniş sözlük: tüm seçenekler dahil
 * (hepsi gerçek Türkçe kelime). Böylece farklı ama geçerli bir bölme de doğru sayılır.
 */
export const WORD_POOL: string[] = lowerWords(GAME_DATA.wordCatch.flatMap((w) => w.options));

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Rastgele n öğe seçer; `ordered` ise orijinal sırayı (kolaydan zora) korur. */
export function sample<T>(items: readonly T[], n: number, ordered = false): T[] {
  const idx = shuffle(items.map((_, i) => i)).slice(0, n);
  if (ordered) idx.sort((a, b) => a - b);
  return idx.map((i) => items[i]);
}
