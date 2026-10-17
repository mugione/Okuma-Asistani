/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { audioSlug, normalizeWord, requeueMissed, SYNONYM_GROUPS, SYNONYM_WORDS } from "./synonyms";

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

describe("kartlarla tekrar: bilinemeyen kartın yeri", () => {
  /** Çocuğun cevaplarına göre gösterilen kartların sırası. */
  function play(cards: number, steps: number, knows: (card: number, step: number) => boolean = () => false) {
    let queue = Array.from({ length: cards }, (_, i) => i);
    const seen = new Set<number>();
    const shown: number[] = [];
    for (let s = 0; s < steps && queue.length; s++) {
      const [head, ...rest] = queue;
      shown.push(head);
      seen.add(head);
      queue = knows(head, s) ? rest : requeueMissed(rest, head, seen);
    }
    return shown;
  }

  it("hep 'Bilemedim' denirse bütün kartlar gelir ve hepsi sırayla tekrar edilir (döngüye girmez)", () => {
    const shown = play(10, 40);
    expect(new Set(shown.slice(0, 19)).size).toBe(10);
    // Bütün kartlar görüldükten sonraki her 10 adımda her kart bir kez gelir.
    expect(new Set(shown.slice(20, 30)).size).toBe(10);
    expect(new Set(shown.slice(30, 40)).size).toBe(10);
  });

  it("bilinemeyen kart 3 yeni karttan sonra geri gelir", () => {
    expect(requeueMissed([1, 2, 3, 4, 5], 0, new Set([0]))).toEqual([1, 2, 3, 0, 4, 5]);
  });

  it("aradaki görülmüş kartlar sayılmaz; son yeni kart da gelmeden atlanmaz", () => {
    expect(requeueMissed([1, 7, 2, 8, 3, 4], 0, new Set([0, 7, 8]))).toEqual([1, 7, 2, 8, 3, 0, 4]);
    expect(requeueMissed([7, 8, 9, 4], 0, new Set([0, 7, 8, 9]))).toEqual([7, 8, 9, 4, 0]);
  });

  it("yeni kart kalmadıysa kuyruğun sonuna girer", () => {
    expect(requeueMissed([1, 2, 3, 4], 0, new Set([0, 1, 2, 3, 4]))).toEqual([1, 2, 3, 4, 0]);
    expect(requeueMissed([], 0, new Set([0]))).toEqual([0]);
  });

  it("bilinen kartlar çıkar, zor kartlar öğrenilene kadar gelir ve deste biter", () => {
    const shown = play(10, 100, (card, step) => !(card < 2 && step < 15));
    expect(new Set(shown).size).toBe(10);
    expect(shown.length).toBeLessThan(25);
  });
});
