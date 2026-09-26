import { describe, expect, it } from "vitest";
import {
  calculateAccuracy,
  calculateNextTarget,
  calculateWpm,
  initialTargetFromPlacement,
  effectiveStreak,
  improvementPercent,
  movingAverage,
  pickQuestions,
  nextStreak,
  TARGET_WPM_MAX,
  TARGET_WPM_MIN,
} from "./reading";
import { buildChunks, stepDuration, syllableCount, tokenize, wordBaseDurations } from "./pacing";

describe("calculateWpm", () => {
  it("180 kelime / 120 sn = 90 WPM", () => expect(calculateWpm(180, 120)).toBe(90));
  it("geçersiz süre 0 döner", () => expect(calculateWpm(180, 0)).toBe(0));
});

describe("calculateAccuracy", () => {
  it("200 kelimede 4 hata = %98", () => expect(calculateAccuracy(200, 4)).toBe(98));
  it("hata sayısı kelime sayısını aşamaz", () => expect(calculateAccuracy(10, 50)).toBe(0));
});

describe("calculateNextTarget", () => {
  const base = { currentTargetWpm: 100, actualWpm: 100 };
  it("anlama ≥90 ve doğruluk ≥97 → +%5", () =>
    expect(calculateNextTarget({ ...base, accuracy: 98, comprehension: 100 })).toBe(105));
  it("anlama ≥80 ve doğruluk ≥95 → +%3", () =>
    expect(calculateNextTarget({ ...base, accuracy: 95, comprehension: 80 })).toBe(103));
  it("anlama 70–79 → değişmez", () =>
    expect(calculateNextTarget({ ...base, accuracy: 99, comprehension: 75 })).toBe(100));
  it("anlama <70 → −%5", () =>
    expect(calculateNextTarget({ ...base, accuracy: 99, comprehension: 60 })).toBe(95));
  it("doğruluk düşükse artırmaz", () =>
    expect(calculateNextTarget({ ...base, accuracy: 90, comprehension: 100 })).toBe(100));
  it("doğruluk bilinmiyorsa en fazla +%3", () =>
    expect(calculateNextTarget({ ...base, accuracy: null, comprehension: 100 })).toBe(103));
  it("hedefin gerisinde kalan çocukta artırmaz", () =>
    expect(calculateNextTarget({ currentTargetWpm: 100, actualWpm: 70, accuracy: 99, comprehension: 100 })).toBe(100));
  it("alt sınır", () =>
    expect(calculateNextTarget({ currentTargetWpm: TARGET_WPM_MIN, actualWpm: 30, accuracy: 80, comprehension: 20 })).toBe(TARGET_WPM_MIN));
  it("üst sınır", () =>
    expect(calculateNextTarget({ currentTargetWpm: TARGET_WPM_MAX, actualWpm: 250, accuracy: 100, comprehension: 100 })).toBe(TARGET_WPM_MAX));
  it("küçük hedeflerde en az 1 WPM değişir", () =>
    expect(calculateNextTarget({ currentTargetWpm: 45, actualWpm: 45, accuracy: 95, comprehension: 80 })).toBe(46));
});

describe("initialTargetFromPlacement", () => {
  it("90 WPM, %80 anlama → +%3", () => expect(initialTargetFromPlacement(90, 80)).toBe(93));
  it("%60 anlama → −%5", () => expect(initialTargetFromPlacement(90, 60)).toBe(86));
  it("aşırı hızlı okuma 150 ile sınırlanır", () => expect(initialTargetFromPlacement(260, 100)).toBe(155));
});

describe("pickQuestions", () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  it("havuz küçükse hepsini döndürür", () => expect(pickQuestions([1, 2, 3], new Map(), 5)).toEqual([1, 2, 3]));
  it("istenen sayıda, tekrarsız ve sıralı seçer", () => {
    const got = pickQuestions(pool, new Map(), 5);
    expect(got).toHaveLength(5);
    expect(new Set(got).size).toBe(5);
    expect([...got].sort((a, b) => a - b)).toEqual(got);
  });
  it("daha önce sorulmamış soruları tercih eder", () => {
    const asked = new Map([1, 2, 3, 4, 5].map((id) => [id, 1]));
    expect(pickQuestions(pool, asked, 4)).toEqual([6, 7, 8, 9]);
  });
});

describe("improvementPercent", () => {
  it("82 → 99 = %21", () => expect(improvementPercent(82, 99)).toBe(21));
});

describe("movingAverage", () => {
  it("boş günleri atlar ve pencereyi uygular", () => {
    const pts = [
      { date: "1", value: 70 },
      { date: "2", value: null },
      { date: "3", value: 80 },
      { date: "4", value: 120 },
    ];
    expect(movingAverage(pts, 2)).toEqual([70, 70, 75, 100]);
  });
});

describe("streak", () => {
  it("dün çalıştıysa seri artar", () => expect(nextStreak(4, "2026-09-25", "2026-09-26")).toBe(5));
  it("bugün tekrar çalışınca seri aynı kalır", () => expect(nextStreak(5, "2026-09-26", "2026-09-26")).toBe(5));
  it("ara verilince seri 1'e döner", () => expect(nextStreak(5, "2026-09-20", "2026-09-26")).toBe(1));
  it("gösterilen seri kopmuşsa 0", () => expect(effectiveStreak(5, "2026-09-20", "2026-09-26")).toBe(0));
});

describe("pacing", () => {
  it("Türkçe hece sayısı", () => {
    expect(syllableCount("ev")).toBe(1);
    expect(syllableCount("Bisikletiyle")).toBe(5);
    expect(syllableCount("İstanbul'da")).toBe(4);
    expect(syllableCount("2024")).toBe(1);
  });
  it("100 WPM: ortalama hecedeki kelime 600 ms, virgül +150, nokta +300", () => {
    const tokens = tokenize("Ali bugün, erken gitti.");
    const bases = wordBaseDurations(tokens, 100); // hepsi 2 heceli → ağırlık 1
    expect(stepDuration(tokens, [0], bases)).toBe(600);
    expect(stepDuration(tokens, [1], bases)).toBe(750);
    expect(stepDuration(tokens, [3], bases)).toBe(900);
  });
  it("uzun kelimeye daha çok süre verilir ama ortalama hız korunur", () => {
    const tokens = tokenize("Ev bisikletiyle geldi ve kitapları okudu.");
    const bases = wordBaseDurations(tokens, 100);
    expect(bases[1]).toBeGreaterThan(bases[0] * 2);
    const avg = bases.reduce((a, b) => a + b, 0) / bases.length;
    expect(Math.abs(avg - 600)).toBeLessThanOrEqual(1);
  });
  it("gruplar cümle sonunu aşmaz", () => {
    const tokens = tokenize("Ali bugün okula erken gitti. Ayşe de geldi.");
    const groups = buildChunks(tokens, 2).map((g) => g.map((i) => tokens[i].text).join(" "));
    expect(groups).toEqual(["Ali bugün", "okula erken gitti.", "Ayşe de geldi."]);
  });
});
