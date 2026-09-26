import base from "../../seed/games.json";
import extraSentences from "../../seed/games-extra/sentences.json";
import extraWords from "../../seed/games-extra/word-catch.json";

export interface WordCatchItem { word: string; options: string[] }
export interface SentenceRecallItem { sentence: string; question: string; options: string[] }
export interface MissingWordItem { sentence: string; options: string[] }

const byLength = (a: WordCatchItem, b: WordCatchItem) => a.word.length - b.word.length;

export const GAME_DATA = {
  // Kısadan uzuna sıralı: oyun ilerledikçe kelimeler uzar.
  wordCatch: [...base.wordCatch, ...extraWords.wordCatch].sort(byLength) as WordCatchItem[],
  sentenceRecall: [...base.sentenceRecall, ...extraSentences.sentenceRecall] as SentenceRecallItem[],
  missingWord: [...base.missingWord, ...extraSentences.missingWord] as MissingWordItem[],
};

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
