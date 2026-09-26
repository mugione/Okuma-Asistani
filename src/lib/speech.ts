/**
 * Tarayıcının yerleşik konuşma motoru (Web Speech API) ile Dinle-Oku.
 * Ses cihazda üretilir; hiçbir ses kaydı alınmaz, saklanmaz ya da sunucuya gönderilmez.
 */
import { syllableCount } from "../../shared/pacing";
import { voiceQualityScore, type Sentence } from "../../shared/speech";
import { load, save } from "./storage";

const VOICE_KEY = "okuhiz.voice";

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

const turkish = () =>
  speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("tr"))
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));

/** Cihazdaki Türkçe sesler, en kalitelisi başta. Sesler bazı tarayıcılarda gecikmeli yüklenir. */
export async function listTurkishVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return [];
  if (speechSynthesis.getVoices().length) return turkish();
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(turkish());
    };
    speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, 2000);
  });
}

/** Kullanıcının seçtiği ses (bu cihazda kayıtlı) ya da en kaliteli Türkçe ses. */
export async function findTurkishVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await listTurkishVoices();
  const saved = load(VOICE_KEY);
  return voices.find((v) => v.voiceURI === saved) ?? voices[0] ?? null;
}

export function saveVoiceChoice(voice: SpeechSynthesisVoice) {
  save(VOICE_KEY, voice.voiceURI);
}

export const isHighQuality = (voice: SpeechSynthesisVoice) => voiceQualityScore(voice) >= 3;

/** Seçilen sesi kısa bir örnek cümleyle dinletir. */
export function previewVoice(voice: SpeechSynthesisVoice) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance("Merhaba! Ben senin okuma arkadaşınım. Birlikte okumaya hazır mısın?");
  u.lang = "tr-TR";
  u.voice = voice;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

export interface SpeakOptions {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  volume: number;
  /** Tahmini süre (sınır olayı gelmezse vurgulama için), ms. */
  expectedMs: number;
  onWord: (k: number) => void;
  onEnd: (elapsedMs: number) => void;
}

/**
 * Bir cümleyi okur. Kelime vurgusu için tarayıcının "word" sınır olayları kullanılır; bu olaylar
 * her cihazda gelmediğinden, gelmezse kelime süreleri hece sayısına göre tahmin edilir.
 * Dönen fonksiyon okumayı iptal eder.
 */
export function speakSentence(sentence: Sentence, words: string[], opts: SpeakOptions): () => void {
  const utter = new SpeechSynthesisUtterance(sentence.text);
  utter.lang = "tr-TR";
  if (opts.voice) utter.voice = opts.voice;
  utter.rate = opts.rate;
  utter.volume = opts.volume;

  let cancelled = false;
  let gotBoundary = false;
  const timers: number[] = [];
  const clearTimers = () => timers.splice(0).forEach((t) => clearTimeout(t));
  let startedAt = performance.now();

  const scheduleEstimates = () => {
    const weights = words.map((w) => syllableCount(w) + 0.5);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = 0;
    weights.forEach((w, k) => {
      timers.push(window.setTimeout(() => !gotBoundary && !cancelled && opts.onWord(k), t));
      t += (w / total) * opts.expectedMs;
    });
  };

  utter.onstart = () => {
    startedAt = performance.now();
    opts.onWord(0);
    scheduleEstimates();
  };
  utter.onboundary = (e) => {
    if (e.name && e.name !== "word") return;
    if (!gotBoundary) {
      gotBoundary = true;
      clearTimers();
    }
    let k = 0;
    while (k + 1 < sentence.offsets.length && sentence.offsets[k + 1] <= e.charIndex) k++;
    opts.onWord(k);
  };
  const finish = () => {
    clearTimers();
    if (!cancelled) opts.onEnd(performance.now() - startedAt);
  };
  utter.onend = finish;
  utter.onerror = (e) => {
    // "interrupted"/"canceled": bizim iptalimiz; diğer hatalarda da akış durmasın.
    if (e.error === "interrupted" || e.error === "canceled") clearTimers();
    else finish();
  };

  speechSynthesis.cancel(); // önceki okuma kuyrukta kalmasın
  speechSynthesis.speak(utter);
  return () => {
    cancelled = true;
    clearTimers();
    speechSynthesis.cancel();
  };
}

export function stopSpeaking() {
  if (speechSupported()) speechSynthesis.cancel();
}
