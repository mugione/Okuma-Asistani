import data from "../seed/games-extra/synonyms.json";

/** Eş anlamlı kelime grupları (çoğu ikili; "savaş, harp, cenk" gibi üçlüler de var). */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = data.synonyms;

/** Oyundaki tüm kelimeler (her birinin public/audio/kelimeler altında sesi var). */
export const SYNONYM_WORDS: ReadonlySet<string> = new Set(SYNONYM_GROUPS.flat());

/** Boşluksuz, Türkçe küçük harf, NFC. */
export const normalizeWord = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("tr");

const TR: Record<string, string> = { ç: "c2", ğ: "g2", ı: "i2", ö: "o2", ş: "s2", ü: "u2", â: "a2", î: "i3", û: "u3" };

/**
 * Ses dosyasının adı (ASCII). Türkçe harfler rakamlı yazılır (sürat → su2rat) ki "surat" ile
 * "sürat" gibi çiftler aynı dosyaya düşmesin. scripts/generate-word-audio.mjs ile aynı olmalı.
 */
export const audioSlug = (word: string) => word.replace(/[çğıöşüâîû]/g, (c) => TR[c]).replace(/[^a-z0-9]+/g, "-");

/**
 * Kartlarla tekrar: bilinemeyen kartı kuyruğa geri koyar.
 * - Henüz gösterilmemiş kartlar varsa kart, bunlardan `gap` tanesinin arkasına girer: çocuk her karta
 *   "Bilemedim" dese bile yeni kartlar gelmeye devam eder, bilinemeyen kart 3-4 kart sonra döner.
 * - Bütün kartlar en az bir kez gösterildiyse kuyruğun sonuna girer: kuyrukta yalnızca bilinemeyen
 *   kartlar kaldığı için hepsi sırayla tekrar edilir (birkaç kart arasında dönüp kalınmaz).
 */
export function requeueMissed<T>(rest: readonly T[], card: T, seen: ReadonlySet<T>, gap = 3): T[] {
  let unseen = 0;
  let lastUnseen = -1;
  for (let i = 0; i < rest.length; i++) {
    if (seen.has(rest[i])) continue;
    lastUnseen = i;
    if (++unseen === gap) break;
  }
  const at = lastUnseen < 0 ? rest.length : Math.max(Math.min(gap, rest.length), lastUnseen + 1);
  return [...rest.slice(0, at), card, ...rest.slice(at)];
}
