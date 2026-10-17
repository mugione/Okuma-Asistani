/**
 * Oyun kelimelerinin seslendirilmesi. Sesler bir kez ElevenLabs ile üretilip uygulamayla birlikte
 * gelir (public/audio/kelimeler, bkz. scripts/generate-word-audio.mjs); dosya yoksa ya da
 * çalınamazsa tarayıcının yerleşik Türkçe sesi kullanılır.
 *
 * Çalma Web Audio ile yapılır: <audio> etiketinin aksine sesin başı kırpılmaz ve dosya tek parça
 * indirildiği için service worker onu çevrimdışı kullanım için önbelleğe alabilir.
 */
import { audioSlug } from "../../shared/synonyms";
import { findTurkishVoice, speechSupported } from "./speech";

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;
let playId = 0;

function context(): AudioContext | null {
  if (!ctx && typeof AudioContext !== "undefined") ctx = new AudioContext();
  return ctx;
}

// iOS Safari ses bağlamını yalnızca bir dokunuş sırasında açar.
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", () => {
    if (ctx?.state === "suspended") void ctx.resume();
  });
}

function load(word: string): Promise<AudioBuffer | null> {
  let p = buffers.get(word);
  if (!p) {
    p = (async () => {
      const ac = context();
      if (!ac) return null;
      const res = await fetch(`/audio/kelimeler/${audioSlug(word)}.mp3`);
      if (!res.ok) return null;
      return ac.decodeAudioData(await res.arrayBuffer());
    })().catch(() => {
      buffers.delete(word); // geçici ağ hatasında sonra yeniden denensin
      return null;
    });
    buffers.set(word, p);
  }
  return p;
}

/** Sıradaki kelimelerin sesini önceden indirir (oynatmaz). */
export function preloadWords(words: readonly string[]) {
  for (const w of words) void load(w);
}

async function playBuffer(buffer: AudioBuffer): Promise<void> {
  const ac = context()!;
  if (ac.state === "suspended") await ac.resume().catch(() => {});
  return new Promise((resolve) => {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    src.onended = () => resolve();
    current = src;
    src.start();
  });
}

async function speakBrowser(word: string): Promise<void> {
  if (!speechSupported()) return;
  const voice = await findTurkishVoice();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "tr-TR";
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
    setTimeout(resolve, 4000); // bazı tarayıcılarda onend hiç gelmez
  });
}

/** Kelimeleri sırayla okur (dosyalarda başta ve sonda kısa sessizlik vardır). Yeni çağrı öncekini keser. */
export async function speakWords(words: readonly string[]): Promise<void> {
  stopSpeaking();
  const id = playId;
  const loaded = words.map(load);
  for (let i = 0; i < words.length; i++) {
    const buffer = await loaded[i];
    if (id !== playId) return;
    await (buffer ? playBuffer(buffer) : speakBrowser(words[i]));
    if (id !== playId) return;
  }
}

export function stopSpeaking() {
  playId++;
  try {
    current?.stop();
  } catch {
    /* zaten durmuş */
  }
  current = null;
  if (speechSupported()) speechSynthesis.cancel();
}
