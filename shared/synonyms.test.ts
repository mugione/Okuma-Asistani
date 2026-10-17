/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { audioSlug, normalizeWord, SYNONYM_GROUPS, SYNONYM_WORDS } from "./synonyms";

const AUDIO_FILES = Object.keys(import.meta.glob("../public/audio/kelimeler/*.mp3")).map((p) => p.split("/").pop()!);

describe("eş anlamlı kelime verisi", () => {
  it("tablodaki 98 grubun tamamını içerir", () => {
    expect(SYNONYM_GROUPS).toHaveLength(98);
  });

  it("her grupta en az iki kelime var ve hiçbir kelime iki grupta geçmez", () => {
    for (const g of SYNONYM_GROUPS) expect(g.length).toBeGreaterThanOrEqual(2);
    expect(SYNONYM_WORDS.size).toBe(SYNONYM_GROUPS.flat().length);
  });

  it("her kelimenin ayrı bir ses dosyası var (fazlası yok)", () => {
    const slugs = [...SYNONYM_WORDS].map(audioSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(AUDIO_FILES.sort()).toEqual(slugs.map((s) => `${s}.mp3`).sort());
  });

  it("kelimeler normalize biçimde yazılmış", () => {
    for (const w of SYNONYM_WORDS) expect(normalizeWord(w)).toBe(w);
  });

  it("Türkçe büyük harfleri doğru küçültür", () => {
    expect(normalizeWord(" Islak ")).toBe("ıslak");
    expect(normalizeWord("İCAT")).toBe("icat");
  });
});
