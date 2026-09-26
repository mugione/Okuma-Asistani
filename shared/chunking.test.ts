import { describe, expect, it } from "vitest";
import texts from "../seed/texts.json";
import extra1 from "../seed/texts-extra/batch-1.json";
import extra2 from "../seed/texts-extra/batch-2.json";
import extra3 from "../seed/texts-extra/batch-3.json";
import extra4 from "../seed/texts-extra/batch-4.json";
import { bareWord, buildPhraseChunks, classifyBoundary, endPunctuation, opensQuote } from "./chunking";
import { tokenize } from "./pacing";

const show = (content: string, target: number) => {
  const tokens = tokenize(content);
  return buildPhraseChunks(tokens, target).map((c) => c.map((i) => tokens[i].text).join(" "));
};

describe("anlam öbekleri: örnekler", () => {
  it("noktalama sınırı aşılmaz, 'de' bağlacı önceki kelimeden kopmaz", () => {
    const got = show("Kulağa şaşırtıcı gelse de bu mümkün.", 2);
    expect(got.some((g) => g.includes("gelse de"))).toBe(true);
    expect(got.at(-1)).toContain("bu mümkün.");
  });
  it("sayı ve edat kelimesinden ayrılmaz", () => {
    const got = show("Belki de milyonlarca yıl önce bir dinozor burada yaşadı.", 2);
    expect(got.some((g) => g.includes("milyonlarca yıl önce"))).toBe(true);
    expect(got.every((g) => !g.endsWith(" bir") && g !== "bir")).toBe(true);
  });
  it("tamlama mümkün olduğunca bölünmez", () => {
    expect(show("Isınan suyun bir kısmı buharlaşır.", 2).some((g) => g.includes("suyun bir kısmı"))).toBe(true);
  });
  it("tırnak içindeki konuşma yeni öbek başlatır", () => {
    const got = show('Elif gülümseyerek "Merhaba, benim adım Elif." dedi.', 2);
    expect(got.some((g) => g.startsWith('"Merhaba,'))).toBe(true);
    expect(got.at(-1)).toBe("dedi.");
  });
  it("virgülden sonra yeni öbek başlar", () => {
    expect(show("Saksıda küçük, sarı bir çiçek açmıştı.", 3)[0]).toBe("Saksıda küçük,");
  });
  it("zarf-fiilden sonra bölmek tercih edilir", () => {
    const got = show("Ali eve gelince hemen ellerini yıkadı.", 2);
    expect(got.some((g) => g.endsWith("gelince"))).toBe(true);
  });
  it("birleşik fiiller bölünmez", () => {
    const got = show("Deniz ve ailesi dedesini ziyaret etmeye karar verdi.", 3);
    expect(got.some((g) => g.includes("ziyaret etmeye"))).toBe(true);
    expect(got.some((g) => g.includes("karar verdi."))).toBe(true);
  });
  it("'et/ol' ile başlayan başka kelimeler yardımcı fiil sanılmaz", () => {
    const tokens = tokenize("Çocuklar etrafa baktı ve olayı anlattı, etek giydi.");
    expect(classifyBoundary(tokens, 0)).not.toBe("glue-strong"); // Çocuklar | etrafa
    expect(classifyBoundary(tokens, 3)).toBe("glue-strong"); // ve → olayı (ve ile öbek bitmez)
    expect(classifyBoundary(tokens, 4)).not.toBe("glue-strong"); // olayı | anlattı
    expect(classifyBoundary(tokens, 6)).not.toBe("glue-strong"); // etek | giydi
  });
  it("'ya da' birlikte kalır, soru eki kopmaz", () => {
    const got = show("Sana yardım edebilir miyim ya da birlikte mi gidelim?", 2);
    expect(got.some((g) => g.includes("edebilir miyim"))).toBe(true);
    expect(got.some((g) => /(^| )ya da( |$)/.test(g))).toBe(true);
  });
});

describe("anlam öbekleri: tüm metinlerde kurallar", () => {
  const all = [...texts, ...extra1, ...extra2, ...extra3, ...extra4];
  for (const target of [2, 3, 4]) {
    it(`hedef ${target} kelime: ${all.length} metinde ihlal yok`, () => {
      const problems: string[] = [];
      for (const t of all) {
        const tokens = tokenize(t.content);
        const chunks = buildPhraseChunks(tokens, target);
        // 1) Tüm kelimeler sırayla ve eksiksiz.
        expect(chunks.flat()).toEqual(tokens.map((_, i) => i));
        for (const chunk of chunks) {
          const words = chunk.map((i) => tokens[i].text).join(" ");
          let run = 1;
          let longestGlue = 1;
          for (let k = 0; k < chunk.length - 1; k++) {
            run = classifyBoundary(tokens, chunk[k]) === "glue-strong" ? run + 1 : 1;
            longestGlue = Math.max(longestGlue, run);
          }
          if (chunk.length > Math.max(target + 2, longestGlue)) problems.push(`${t.slug}: çok uzun öbek "${words}"`);
          chunk.forEach((i, k) => {
            const last = k === chunk.length - 1;
            // 2) Noktalama, paragraf ya da tırnak açılışı öbeğin içinde kalamaz.
            if (!last && endPunctuation(tokens[i].text)) problems.push(`${t.slug}: noktalama aşıldı "${words}"`);
            if (!last && tokens[i].paragraph !== tokens[i + 1].paragraph) problems.push(`${t.slug}: paragraf aşıldı "${words}"`);
            if (k > 0 && opensQuote(tokens[i].text)) problems.push(`${t.slug}: tırnak öbeğin ortasında "${words}"`);
          });
          // 3) Öbek sınırı "asla bölünmez" bir noktaya düşmemeli.
          const end = chunk[chunk.length - 1];
          if (end < tokens.length - 1 && classifyBoundary(tokens, end) === "glue-strong") {
            problems.push(`${t.slug}: yapışık kelimeler bölündü "${words} | ${bareWord(tokens[end + 1].text)}"`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
