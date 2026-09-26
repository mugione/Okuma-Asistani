import { describe, expect, it } from "vitest";
import { atesman, atesmanLabel, atesmanLevel, effectiveDifficulty, numberToTurkish, wordSyllables } from "./readability";

describe("numberToTurkish / hece", () => {
  it("sayıların okunuşu", () => {
    expect(numberToTurkish(1969)).toBe("bin dokuz yüz altmış dokuz");
    expect(numberToTurkish(2024)).toBe("iki bin yirmi dört");
    expect(numberToTurkish(100)).toBe("yüz");
    expect(numberToTurkish(42)).toBe("kırk iki");
  });
  it("hece sayısı; sayılar okunuşuna göre", () => {
    expect(wordSyllables("kitap")).toBe(2);
    expect(wordSyllables("Bisikletiyle,")).toBe(5);
    expect(wordSyllables("1969'da")).toBe(8); // bin-do-kuz-yüz-alt-mış-do-kuz
  });
});

describe("Ateşman formülü", () => {
  it("formülü doğru uygular", () => {
    // 4 kelime, 1 cümle, 8 hece → 198,825 − 40,175×2 − 2,61×4 = 108,035
    const r = atesman("Ali eve erken gitti.");
    expect(r.syllablesPerWord).toBe(2);
    expect(r.wordsPerSentence).toBe(4);
    expect(r.score).toBe(108);
    expect(r.label).toBe("çok kolay");
  });
  it("uzun cümle ve uzun kelimeler puanı düşürür", () => {
    const easy = atesman("Kedi uyudu. Ali güldü. Top düştü.");
    const hard = atesman("Araştırmacılar, gökyüzündeki yıldızların oluşumunu açıklayabilmek için karmaşık bilgisayar modellerini kullanmaktadırlar.");
    expect(easy.score).toBeGreaterThan(hard.score);
    expect(hard.label).toBe("çok zor");
  });
  it("resmî bantlar ve uygulama seviyesi", () => {
    expect(atesmanLabel(95)).toBe("çok kolay");
    expect(atesmanLabel(75)).toBe("kolay");
    expect(atesmanLabel(55)).toBe("orta güçlükte");
    expect([90, 78, 70, 63, 50].map(atesmanLevel)).toEqual([1, 2, 3, 4, 5]);
  });
  it("birleşik zorluk", () => {
    expect(effectiveDifficulty(3, 3)).toBe(3);
    expect(effectiveDifficulty(1, 4)).toBe(3); // 2,5 → 3
    expect(effectiveDifficulty(5, 5)).toBe(5);
  });
});
