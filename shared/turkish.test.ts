import { describe, expect, it } from "vitest";
import { isSafeForSyllables, isValidSegmentation, syllabify } from "./turkish";

describe("syllabify", () => {
  const cases: [string, string][] = [
    ["kalem", "ka-lem"],
    ["Araba", "a-ra-ba"],
    ["arkadaş", "ar-ka-daş"],
    ["türkçe", "türk-çe"],
    ["saat", "sa-at"],
    ["okul", "o-kul"],
    ["kelebek", "ke-le-bek"],
    ["İstanbul", "is-tan-bul"],
    ["çiçek", "çi-çek"],
    ["öğretmen", "öğ-ret-men"],
    ["bilgisayar", "bil-gi-sa-yar"],
    ["göz", "göz"],
  ];
  it.each(cases)("%s → %s", (word, expected) => expect(syllabify(word).join("-")).toBe(expected));
});

describe("isSafeForSyllables", () => {
  it("yerli kelimeler uygundur", () => {
    expect(isSafeForSyllables("Kelebek")).toBe(true);
    expect(isSafeForSyllables("arkadaş")).toBe(true);
  });
  it("tek heceli, ünsüz kümeli veya çok uzun kelimeler dışlanır", () => {
    expect(isSafeForSyllables("göz")).toBe(false);
    expect(isSafeForSyllables("tren")).toBe(false);
    expect(isSafeForSyllables("elektrik")).toBe(false);
    expect(isSafeForSyllables("arkadaşlarımız")).toBe(false); // 4 heceden fazla
  });
});

describe("isValidSegmentation", () => {
  const dict = new Set(["kedi", "kuş", "balık", "kuşku"]);
  it("doğru bölme kabul edilir", () => expect(isValidSegmentation("kedikuşbalık", ["kedi", "kuş", "balık"], dict)).toBe(true));
  it("sözlükte olmayan parça reddedilir", () => expect(isValidSegmentation("kedikuşbalık", ["ke", "dikuş", "balık"], dict)).toBe(false));
  it("bölünmemiş zincir reddedilir", () => expect(isValidSegmentation("kedi", ["kedi"], dict)).toBe(false));
});
