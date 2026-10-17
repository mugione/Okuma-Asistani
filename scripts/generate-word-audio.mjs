// Eş anlamlı kelimelerin seslerini ElevenLabs ile BİR KEZ üretir: public/audio/kelimeler/<slug>.mp3
// Kullanım: node --env-file=.env scripts/generate-word-audio.mjs [--force] [kelime ...]
//   ELEVENLABS_API_KEY ve ELEVENLABS_VOICE_ID .env içinde (git'e girmez). Var olan dosyalar atlanır.
//
// Kesik ses olmaması için:
//  - Kelime noktayla biter ("kalp.") → doğal, tamamlanmış bir bitiş tonlaması.
//  - with-timestamps ucu her harfin bittiği anı döndürür; son harf sesin içinde değilse ya da
//    hizalama metinle eşleşmiyorsa ses yeniden üretilir.
//  - Başa ~0,3 sn, sona ~0,4 sn sessiz MP3 çerçevesi eklenir: tarayıcılar ve Bluetooth kulaklıklar
//    sesin ilk/son milisaniyelerini yutabildiği için kelimenin kendisi hiç kırpılmaz.
//    Süre bilgisini taşıyan "Info" çerçevesi çıkarılır (yoksa oynatıcı eski süreye göre erken durabilir).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT_DIR = new URL("../public/audio/kelimeler/", import.meta.url);
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const FORMAT = "mp3_44100_192";
const VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.9 };
// Okunmaz; kısa kelimelerin ("al", "ak", "his") Türkçe okunmasını sağlayan bağlam.
const PREVIOUS_TEXT = "Şimdi sana Türkçe bir kelime okuyorum.";
const LEAD_FRAMES = 12; // ≈ 0,31 sn
const TAIL_FRAMES = 16; // ≈ 0,42 sn

/**
 * shared/synonyms.ts → audioSlug ile aynı olmalı (shared/synonyms.test.ts denetler).
 * Türkçe harfler rakamlı yazılır (sürat → su2rat) ki "surat" ile "sürat" gibi çiftler karışmasın.
 */
const TR = { ç: "c2", ğ: "g2", ı: "i2", ö: "o2", ş: "s2", ü: "u2", â: "a2", î: "i3", û: "u3" };
const audioSlug = (w) => w.replace(/[çğıöşüâîû]/g, (c) => TR[c]).replace(/[^a-z0-9]+/g, "-");

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
if (!key || !voice) {
  console.error("ELEVENLABS_API_KEY ve ELEVENLABS_VOICE_ID gerekli: node --env-file=.env scripts/generate-word-audio.mjs");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
const groups = JSON.parse(readFileSync(new URL("../seed/games-extra/synonyms.json", import.meta.url), "utf8")).synonyms;
const words = only.length ? only : [...new Set(groups.flat())];
mkdirSync(OUT_DIR, { recursive: true });

// ---- MP3 yardımcıları (MPEG-1 Layer III) ----
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];

function parseFrames(buf) {
  let pos = 0;
  if (buf.toString("latin1", 0, 3) === "ID3") {
    pos = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  }
  const id3 = buf.subarray(0, pos);
  const frames = [];
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff || (buf[pos + 1] & 0xfe) !== 0xfa) throw new Error(`Geçersiz MP3 çerçevesi (bayt ${pos})`);
    const bitrate = BITRATES[buf[pos + 2] >> 4] * 1000;
    const rate = RATES[(buf[pos + 2] >> 2) & 3];
    const len = Math.floor((144 * bitrate) / rate) + ((buf[pos + 2] >> 1) & 1);
    if (!bitrate || !rate || pos + len > buf.length) break;
    frames.push(buf.subarray(pos, pos + len));
    pos += len;
  }
  return { id3, frames };
}

const sideInfoLen = (header) => ((header[3] >> 6) === 3 ? 17 : 32);
const isInfoFrame = (f) => ["Info", "Xing"].includes(f.toString("latin1", 4 + sideInfoLen(f), 8 + sideInfoLen(f)));

/** Yan bilgisi sıfır olan çerçeve: kod çözücüler bunu tam sessizlik olarak çözer. */
function silentFrame(template) {
  const header = Buffer.from(template.subarray(0, 4));
  header[2] &= ~0x02; // dolgu (padding) biti kapalı
  const bitrate = BITRATES[header[2] >> 4] * 1000;
  const rate = RATES[(header[2] >> 2) & 3];
  const frame = Buffer.alloc(Math.floor((144 * bitrate) / rate));
  header.copy(frame, 0);
  return frame;
}

function padAudio(buf) {
  const { id3, frames } = parseFrames(buf);
  const audio = frames.filter((f) => !isInfoFrame(f));
  if (!audio.length) throw new Error("Ses çerçevesi yok");
  const silence = silentFrame(audio[0]);
  const durationSec = (audio.length * 1152) / RATES[(audio[0][2] >> 2) & 3];
  return {
    durationSec,
    out: Buffer.concat([id3, ...Array(LEAD_FRAMES).fill(silence), ...audio, ...Array(TAIL_FRAMES).fill(silence)]),
  };
}

// ---- Üretim ----
async function synthesize(word) {
  const text = `${word}.`;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=${FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, previous_text: PREVIOUS_TEXT, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const raw = Buffer.from(json.audio_base64, "base64");
  const a = json.alignment;
  if (!a || a.characters.join("") !== text) throw new Error(`Hizalama metinle eşleşmiyor: "${a?.characters.join("")}"`);
  const { out, durationSec } = padAudio(raw);
  // Son harfin (noktadan önceki) bitişi sesin içinde olmalı; kelime en az ~0,15 sn sürmeli.
  const lastLetterEnd = a.character_end_times_seconds.at(-2);
  if (lastLetterEnd > durationSec - 0.02) throw new Error(`Son harf kesik (${lastLetterEnd}s / ${durationSec.toFixed(3)}s)`);
  if (lastLetterEnd < 0.15) throw new Error(`Ses çok kısa (${lastLetterEnd}s)`);
  return { out, durationSec, lastLetterEnd };
}

let done = 0;
let skipped = 0;
const failed = [];
const queue = [...words];
async function worker() {
  for (let word = queue.shift(); word; word = queue.shift()) {
    const file = new URL(`${audioSlug(word)}.mp3`, OUT_DIR);
    if (!force && existsSync(file)) {
      skipped++;
      continue;
    }
    for (let attempt = 1; ; attempt++) {
      try {
        const { out, durationSec, lastLetterEnd } = await synthesize(word);
        writeFileSync(file, out);
        done++;
        console.log(`✅ ${word.padEnd(12)} ${durationSec.toFixed(2)} sn (kelime ${lastLetterEnd.toFixed(2)} sn'de bitiyor)`);
        break;
      } catch (e) {
        if (attempt >= 3) {
          failed.push(word);
          console.error(`❌ ${word}: ${e.message}`);
          break;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`\nÜretilen: ${done} · atlanan (zaten var): ${skipped} · hatalı: ${failed.length}${failed.length ? " → " + failed.join(", ") : ""}`);
process.exit(failed.length ? 1 : 0);
