/**
 * Kelime grupları (anlam öbekleri) – Türkçe için kural tabanlı öbekleme.
 *
 * Dayanak: "phrase-cued text" çalışmaları (Rasinski ve ark.): metni sabit kelime sayısıyla
 * değil, noktalama ve cümle yapısına göre anlamlı öbeklere bölmek akıcılığı ve prozodiyi
 * destekler. Tam bir sözdizim çözümleyicisi olmadan, Türkçenin düzenli ek yapısından
 * yararlanan kurallar kullanılır:
 *
 *  1. KESİN SINIRLAR (hiçbir grup aşamaz): . ! ? … , ; : sonrası, paragraf sonu,
 *     tırnak açılışı (konuşma yeni bir birim başlatır).
 *  2. YAPIŞIK KELİMELER (bölünmez):
 *     - "bir, bu, şu, o, her, hiç, birkaç, tüm…" ve sayılar sonraki kelimeye bağlıdır.
 *     - "de/da, ki, mi, bile, için, gibi, kadar, ile, önce, sonra, göre…" önceki kelimeye bağlıdır.
 *     - "ve, veya, ya (da), hem" ile grup bitmez.
 *  3. ZAYIF BAĞLAR (grup çok uzarsa bölünebilir): tamlayan eki ("suyun | kısmı"),
 *     sıfat-fiil ("göremediğimiz | su"), -ki ile sıfat ("elindeki | saksı"), -lı/-sız sıfatlar.
 *  4. TERCİH EDİLEN SINIRLAR: zarf-fiillerden sonra (-ınca, -ken, -arak, -ıp, -madan…),
 *     bulunma/ayrılma/vasıta ekli kelimelerden sonra, "ama/çünkü/fakat…" bağlaçlarından önce.
 *
 * Bu kısıtlar altında hedef uzunluğa en yakın bölme dinamik programlamayla seçilir.
 */
import { trLower } from "./turkish";

export interface ChunkToken {
  text: string;
  paragraph: number;
}

const OPENING = /^["“«‘'(]+/;
const CLOSING = /["”»’')]+$/;

/** Kelimenin çıplak hâli: küçük harf, baştaki/sondaki noktalama ve tırnaklar olmadan. */
export function bareWord(text: string): string {
  return trLower(text).replace(OPENING, "").replace(/[.,;:!?…"”»’')]+$/, "");
}

export type EndPunctuation = "sentence" | "clause" | null;

/** Kelime cümle sonu (. ! ? …) ya da yan cümle (, ; :) noktalamasıyla mı bitiyor? */
export function endPunctuation(text: string): EndPunctuation {
  const stripped = text.replace(CLOSING, "");
  if (/[.!?…]$/.test(stripped)) return "sentence";
  if (/[,;:]$/.test(stripped)) return "clause";
  return null;
}

export const opensQuote = (text: string) => /^["“«‘']/.test(text);

// --- Sözcük listeleri --------------------------------------------------------

/** Önceki kelimeye bağlanan edatlar ve ilgeçler (grup bunlarla BAŞLAMAZ). */
const ATTACH_BACK = new Set([
  "de", "da", "ki", "bile", "ise", "için", "gibi", "kadar", "ile", "sonra", "önce", "göre", "doğru",
  "karşı", "rağmen", "beri", "dolayı", "ötürü", "üzere", "boyunca", "değil", "değildir", "değildi",
  "dek", "değin", "itibaren", "birlikte", "beraber", "olarak", "tarafından", "hakkında", "sayesinde",
  "yerine", "diye", "dahi", "misali",
]);
/** Soru eki (mi, mı, mu, mü ve çekimli biçimleri). */
const QUESTION = /^m[iıuü](s[iıuü]n|y[iıuü]m|y[iıuü]z|s[iıuü]n[iıuü]z|d[iıuü]r|yd[iıuü]|ym[iıuü]ş|ş)?$/;

/** Sonraki kelimeye sıkı bağlı belirteçler (grup bunlarla BİTMEZ). */
const ATTACH_FORWARD_STRONG = new Set([
  "bir", "bu", "şu", "o", "her", "hiç", "birkaç", "birçok", "bazı", "tüm", "bütün", "kimi", "ta", "ilk",
  "diğer", "öbür", "öteki", "aynı", "hangi", "kaç", "hiçbir", "herhangi", "şöyle", "böyle", "öyle",
  "ve", "veya", "yahut", "ya", "hem", "ne", "ile", "ama", "fakat", "çünkü", "ancak", "oysa", "yani",
  "hatta", "üstelik", "ayrıca", "halbuki", "yoksa",
]);
/** Sonraki kelimeyi niteleyen zarflar (zayıfça bağlı). */
const ATTACH_FORWARD_WEAK = new Set(["çok", "en", "daha", "pek", "az", "gayet", "oldukça", "epey", "fazla", "biraz"]);

/**
 * Çocuk metinlerinde en sık geçen sıfatlar: çoğunlukla sonraki adı niteler ("yeni bir aile",
 * "kırmızı bisiklet"). Yüklem olarak kullanıldıklarında genellikle cümle sonundadırlar ve
 * orada zaten kesin sınır vardır.
 */
const COMMON_ADJECTIVES = new Set([
  "yeni", "eski", "büyük", "küçük", "güzel", "uzun", "kısa", "sıcak", "soğuk", "ılık", "kocaman", "minik",
  "genç", "yaşlı", "iyi", "kötü", "farklı", "özel", "önemli", "tatlı", "acı", "tuzlu", "derin", "yüksek",
  "alçak", "geniş", "dar", "ağır", "hafif", "hızlı", "yavaş", "sessiz", "gürültülü", "temiz", "kirli",
  "taze", "sıvı", "katı", "ince", "kalın", "yumuşak", "sert", "parlak", "karanlık", "aydınlık", "kuru",
  "ıslak", "boş", "dolu", "açık", "kapalı", "gizli", "ilginç", "tuhaf", "garip", "şaşırtıcı", "harika",
  "kırmızı", "mavi", "sarı", "yeşil", "beyaz", "siyah", "mor", "pembe", "turuncu", "gri", "kahverengi",
  "lacivert", "altın", "gümüş", "doğal", "kocaman", "ufak", "dev", "cesur", "akıllı", "meraklı", "neşeli",
  "mutlu", "üzgün", "yorgun", "aç", "tok", "sağlıklı", "tehlikeli", "güvenli", "kutsal", "antik", "tarihî",
  "tarihi", "modern", "basit", "zor", "kolay", "canlı", "ölü", "vahşi", "evcil", "küresel", "uzak", "yakın",
]);

const NUMBER_WORDS = new Set([
  "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on", "yirmi", "otuz", "kırk", "elli",
  "altmış", "yetmiş", "seksen", "doksan", "yüz", "bin", "milyon", "milyar", "onlarca", "yüzlerce",
  "binlerce", "milyonlarca", "milyarlarca", "yarım", "çeyrek",
]);

/** Bu kelimelerden ÖNCE bölmek doğaldır (yeni yan cümle başlatan bağlaçlar). */
const CONJ_STRONG = new Set(["ama", "fakat", "çünkü", "ancak", "oysa", "halbuki", "yani", "hatta", "üstelik", "ayrıca", "yoksa"]);
const CONJ_WEAK = new Set(["ve", "veya", "ya", "yahut"]);

// --- Ek tabanlı sezgiler -------------------------------------------------------

/** Zarf-fiil: yan cümleyi bitirir → sonrasında bölmek doğal. */
function isConverb(w: string): boolean {
  if (/(y?[ıiuü]nca|y?[ıiuü]nce|ken|y?arak|y?erek|madan|meden|maksızın|meksizin|[dt][ıiuü]kça|[dt][ıiuü]kçe|[dt][ıiuü]ğ[ıiuü]nda|[dt][ıiuü]ğ[ıiuü]nde)$/.test(w)) {
    return w.length >= 5;
  }
  return w.length >= 5 && /y?[ıiuü]p$/.test(w);
}

/** Bulunma, ayrılma ya da vasıta ekiyle biten kelime: öbek sonu olabilir (zayıf ipucu). */
function isCaseBoundary(w: string): boolean {
  if (w.length < 4 || ATTACH_BACK.has(w)) return false;
  return /(d[ae]|t[ae]|[dt][ae]n|y?l[ae])$/.test(w);
}

/** Tamlayan eki (ilgi hâli): "suyun", "kapının", "Elif'in", "ağaçların" → sonraki kelimeye bağlı. */
function isGenitive(w: string): boolean {
  return /'n?[ıiuü]n$/.test(w) || /(n[ıiuü]n|l[ae]r[ıi]n|y[ıiuü]n)$/.test(w);
}

/** Sıfat-fiil / -ki / -lı / -sız: çoğunlukla sonraki adı niteler. */
function isModifier(w: string, original: string): boolean {
  if (/[dt][ıiuü]ğ(ı|i|u|ü|ım|im|um|üm|ımız|imiz|umuz|ümüz|ın|in|un|ün|ınız|iniz|unuz|ünüz)?$/.test(w)) return true;
  if (w.length >= 5 && /(y[ae]n|[ae]c[ae]k)$/.test(w)) return true;
  if (/([dt][ae]ki|n[dt][ae]ki|önceki|sonraki|kü)$/.test(w) && w !== "ki") return true;
  const capitalized = /^[A-ZÇĞİÖŞÜ]/.test(original.replace(OPENING, ""));
  return !capitalized && w.length >= 5 && /(l[ıiuü]|s[ıiuü]z)$/.test(w);
}

/** Birleşik fiilin yardımcı fiili: "ziyaret etmek", "yardım etti", "mutlu oldu" → önceki kelimeden kopmaz. */
const AUX_ET_OL =
  /^((et|ed)(ti|tik|tim|tin|tiler|mek|mem|me|mez|er|erek|iyor|ecek|eceğ|ebil|in|ip|il|en|ince)|ol(du|dum|duk|dun|ur|urlar|mak|ma|may|muş|acak|an|sun|up|unca|ursa|abil))[a-zçğıöşü]*$/;
/** "karar vermek", "izin vermek" gibi: zayıf bağ. */
const AUX_VER = /^ver(di|dik|dim|ir|mek|me|meye|ecek|iyor|en|ip|ince|ebil)[a-zçğıöşü]*$/;

const isNumber = (w: string) => /^\d+([.,]\d+)?$/.test(w) || NUMBER_WORDS.has(w);

// --- Sınır puanları ------------------------------------------------------------

/** Kelime i ile i+1 arasındaki sınırın niteliği. */
export type Boundary = "must" | "glue-strong" | "glue-weak" | "prefer-strong" | "prefer-weak" | "neutral";

export function classifyBoundary(tokens: ChunkToken[], i: number): Boundary {
  const cur = tokens[i];
  const next = tokens[i + 1];
  if (!next) return "must";
  if (cur.paragraph !== next.paragraph) return "must";
  if (endPunctuation(cur.text)) return "must";
  if (opensQuote(next.text)) return "must";

  const a = bareWord(cur.text);
  const b = bareWord(next.text);

  if (ATTACH_BACK.has(b) || QUESTION.test(b)) return "glue-strong";
  if (ATTACH_FORWARD_STRONG.has(a) || isNumber(a)) return "glue-strong";
  if (a === "ya" && b === "da") return "glue-strong";
  if (AUX_ET_OL.test(b)) return "glue-strong";
  if (AUX_VER.test(b)) return "glue-weak";

  if (ATTACH_FORWARD_WEAK.has(a) || COMMON_ADJECTIVES.has(a) || isGenitive(a) || isModifier(a, cur.text)) return "glue-weak";

  if (isConverb(a) || CONJ_STRONG.has(b)) return "prefer-strong";
  if (isCaseBoundary(a) || CONJ_WEAK.has(b)) return "prefer-weak";
  return "neutral";
}

const BOUNDARY_COST: Record<Exclude<Boundary, "must">, number> = {
  "glue-strong": 50,
  "glue-weak": 6,
  "prefer-strong": -2,
  "prefer-weak": -1.2,
  // Hiçbir ipucu olmayan yerde bölmek tahmindir: küçük bir ceza ile gereksiz bölmeler azaltılır.
  neutral: 0.5,
};

/** Seviyeye göre hedef öbek uzunluğu (kelime): 1–2 → 2, 3–4 → 3, 5 → 4. */
export function chunkSizeForLevel(level: number): number {
  if (level <= 2) return 2;
  if (level <= 4) return 3;
  return 4;
}

function syllables(word: string): number {
  return Math.max(1, trLower(word).match(/[aeıioöuüâîû]/g)?.length ?? 0);
}

/**
 * Metni anlam öbeklerine böler. Dönen değer: her öbek için kelime (token) indeksleri.
 * `target`: hedef öbek uzunluğu (kelime).
 */
export function buildPhraseChunks(tokens: ChunkToken[], target: number): number[][] {
  const chunks: number[][] = [];
  let start = 0;

  const segment = (from: number, to: number) => {
    // [from, to) aralığı kesin sınırlarla çevrili bir birimdir.
    const n = to - from;
    if (n <= 0) return;
    // Öbek en fazla hedef+2 kelime; ama bölünemez bir dizi ("iki bin beş yüz yıl") daha uzunsa o kadar.
    let maxWords = target + 2;
    for (let k = from, run = 1; k < to - 1; k++) {
      run = classifyBoundary(tokens, k) === "glue-strong" ? run + 1 : 1;
      maxWords = Math.max(maxWords, run);
    }
    const boundaryCost = (k: number) => BOUNDARY_COST[classifyBoundary(tokens, from + k - 1) as Exclude<Boundary, "must">];
    const chunkCost = (i: number, j: number) => {
      const len = j - i;
      let syl = 0;
      for (let t = from + i; t < from + j; t++) syl += syllables(bareWord(tokens[t].text));
      let cost = (len - target) ** 2 * 0.6;
      if (len === 1 && n > 1 && syl < 4) cost += 1.2; // tek kısa kelimelik öbekten kaçın
      cost += Math.max(0, syl - (target * 3 + 3)) * 0.4; // çok uzun (hece) öbekten kaçın
      return cost;
    };
    const best = new Array<number>(n + 1).fill(Infinity);
    const prev = new Array<number>(n + 1).fill(-1);
    best[0] = 0;
    for (let j = 1; j <= n; j++) {
      for (let i = Math.max(0, j - maxWords); i < j; i++) {
        if (best[i] === Infinity) continue;
        const c = best[i] + chunkCost(i, j) + (i > 0 ? boundaryCost(i) : 0);
        if (c < best[j]) {
          best[j] = c;
          prev[j] = i;
        }
      }
    }
    const cuts: number[] = [];
    for (let j = n; j > 0; j = prev[j]) cuts.unshift(j);
    let s = 0;
    for (const c of cuts) {
      chunks.push(Array.from({ length: c - s }, (_, k) => from + s + k));
      s = c;
    }
  };

  tokens.forEach((_, i) => {
    if (classifyBoundary(tokens, i) === "must") {
      segment(start, i + 1);
      start = i + 1;
    }
  });
  segment(start, tokens.length);
  return chunks;
}
