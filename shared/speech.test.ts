import { describe, expect, it } from "vitest";
import { tokenize } from "./pacing";
import { calibrateRate, clampRate, initialRate, sentencePause, splitSentences, voiceQualityScore, wordAtChar } from "./speech";

describe("splitSentences", () => {
  it("cümle sonu ve paragraf sınırında böler, virgülde bölmez", () => {
    const s = splitSentences(tokenize("Ali geldi, oturdu. Ayşe güldü!\n\nSonra gittiler"));
    expect(s.map((x) => x.text)).toEqual(["Ali geldi, oturdu.", "Ayşe güldü!", "Sonra gittiler"]);
    expect(s[0].tokens).toEqual([0, 1, 2]);
  });
  it("tırnak içindeki cümle sonu da sayılır", () => {
    const s = splitSentences(tokenize('"Merhaba!" dedi. Sonra oturdu.'));
    expect(s.map((x) => x.text)).toEqual(['"Merhaba!"', "dedi.", "Sonra oturdu."]);
  });
});

describe("wordAtChar", () => {
  const [s] = splitSentences(tokenize("Kitap okumak çok güzel."));
  it("karakter konumunu kelimeye eşler", () => {
    expect(wordAtChar(s, 0)).toBe(0);
    expect(wordAtChar(s, 6)).toBe(1); // "okumak"
    expect(wordAtChar(s, 15)).toBe(2); // "çok"
    expect(wordAtChar(s, 17)).toBe(3); // "güzel."
    expect(wordAtChar(s, 999)).toBe(3);
  });
});

describe("konuşma hızı", () => {
  it("başlangıç hızı hedefle orantılı ve sınırlı", () => {
    expect(initialRate(150)).toBe(1);
    expect(initialRate(30)).toBe(0.8); // robotikleşmemesi için 0,8'in altına inmez
    expect(clampRate(3)).toBe(1.3);
  });
  it("ses hedeften hızlıysa yavaşlatır, yavaşsa hızlandırır", () => {
    // 10 kelime 3 sn = 200 kelime/dk, hedef 100 → yavaşlamalı
    expect(calibrateRate(1, 10, 3000, 100)).toBeLessThan(1);
    // 10 kelime 12 sn = 50 kelime/dk, hedef 100 → hızlanmalı
    expect(calibrateRate(1, 10, 12000, 100)).toBeGreaterThan(1);
    // çok kısa cümlede değiştirmez
    expect(calibrateRate(1, 2, 3000, 100)).toBe(1);
  });
  it("yavaş tempo duraklamayla sağlanır", () => {
    // 10 kelime 4 sn'de okundu, hedef 100 kelime/dk (6 sn) → 2 sn fark, en fazla 1,5 sn eklenir
    expect(sentencePause(10, 4000, 100)).toBe(350 + 1500);
    expect(sentencePause(10, 5500, 100)).toBe(350 + 500);
    expect(sentencePause(10, 7000, 100)).toBe(350); // ses zaten yavaşsa yalnızca nefes arası
  });
});

describe("ses kalitesi sıralaması", () => {
  it("gelişmiş/doğal sesler öne alınır", () => {
    const voices = [
      { name: "Yelda", localService: true },
      { name: "Yelda (Gelişmiş)", localService: true },
      { name: "Microsoft Emel Online (Natural) - Turkish (Turkey)", localService: false },
      { name: "Google Türkçe", localService: false },
    ];
    const sorted = [...voices].sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a)).map((v) => v.name);
    expect(sorted.slice(0, 2)).toEqual(["Microsoft Emel Online (Natural) - Turkish (Turkey)", "Yelda (Gelişmiş)"]);
    expect(sorted.at(-1)).toBe("Yelda");
  });
});
