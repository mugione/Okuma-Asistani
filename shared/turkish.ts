/** Türkçe dil yardımcıları (hece oyunları için). */

const VOWELS = "aeıioöuüâîû";
export const isVowel = (ch: string) => VOWELS.includes(ch);

export const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");

/**
 * Türkçe heceleme: her hecede tam bir ünlü vardır; iki ünlü arasındaki ünsüzlerden
 * sonuncusu bir sonraki heceye geçer (ka-lem, ar-ka, türk-çe). Kelime başındaki
 * ünsüzler ilk heceye aittir.
 */
export function syllabify(word: string): string[] {
  const w = trLower(word).replace(/[^a-zçğıöşüâîû]/g, "");
  const vowelIdx = [...w].map((ch, i) => (isVowel(ch) ? i : -1)).filter((i) => i >= 0);
  if (vowelIdx.length <= 1) return w ? [w] : [];
  const cuts: number[] = [];
  for (let k = 1; k < vowelIdx.length; k++) {
    const prev = vowelIdx[k - 1];
    const next = vowelIdx[k];
    const consonants = next - prev - 1;
    cuts.push(consonants === 0 ? next : next - 1);
  }
  const out: string[] = [];
  let start = 0;
  for (const c of cuts) {
    out.push(w.slice(start, c));
    start = c;
  }
  out.push(w.slice(start));
  return out;
}

/**
 * Hece oyunu için güvenli mi? Yabancı kökenli ünsüz kümeleri (tren, elektrik) kuralı
 * bozabildiğinden başta iki ünsüz veya arada üç ünsüz yan yana olan kelimeler dışlanır.
 */
export function isSafeForSyllables(word: string): boolean {
  const w = trLower(word);
  if (!/^[a-zçğıöşü]+$/.test(w)) return false;
  if (w.length >= 2 && !isVowel(w[0]) && !isVowel(w[1])) return false;
  if (/[^aeıioöuü]{3}/.test(w)) return false;
  const n = syllabify(w).length;
  return n >= 2 && n <= 4;
}

/**
 * Kelime zinciri çözümü geçerli mi? Parçaların her biri bilinen bir kelime olmalı ve
 * birleşince zinciri vermeli. (Beklenenden farklı ama geçerli bir bölme de kabul edilir.)
 */
export function isValidSegmentation(chain: string, pieces: string[], dictionary: Set<string>): boolean {
  if (pieces.join("") !== chain || pieces.length < 2) return false;
  return pieces.every((p) => dictionary.has(p));
}
