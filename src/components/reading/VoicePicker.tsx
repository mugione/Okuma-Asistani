import { ChevronDown, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isHighQuality, listTurkishVoices, previewVoice, saveVoiceChoice } from "../../lib/speech";
import { Button } from "../ui";

type Platform = "ios" | "mac" | "android" | "windows" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/Macintosh/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return "other";
}

const GUIDES: Record<Platform, { title: string; steps: string }> = {
  ios: {
    title: "iPhone / iPad",
    steps: "Ayarlar → Erişilebilirlik → Sözlü İçerik → Sesler → Türkçe → Yelda → \"Gelişmiş\" (veya \"Premium\") sesi indirin. Sonra bu sayfayı yenileyin.",
  },
  mac: {
    title: "Mac",
    steps: "Sistem Ayarları → Erişilebilirlik → Sözlü İçerik → Sistem Sesi → Sesleri Yönet → Türkçe → Yelda (Gelişmiş / Premium) indirin. Sonra tarayıcıyı yeniden başlatın.",
  },
  android: {
    title: "Android",
    steps: "Ayarlar → Erişilebilirlik (veya Sistem → Diller) → Metin okuma çıkışı → Google Konuşma Hizmetleri → ⚙️ → Ses verilerini yükle → Türkçe → yüksek kaliteli sesi indirin.",
  },
  windows: {
    title: "Windows",
    steps: "Bu sayfayı Microsoft Edge ile açın: \"Microsoft Emel / Ahmet Online (Natural)\" doğal sesleri ücretsiz ve kurulumsuz gelir.",
  },
  other: {
    title: "Bilgisayar",
    steps: "Microsoft Edge (doğal sesler) veya Chrome (\"Google Türkçe\") tarayıcısında daha doğal sesler bulunur.",
  },
};

/** Türkçe ses seçici: en kaliteli ses otomatik seçilir; çocuk/ebeveyn dinleyip değiştirebilir. */
export function VoicePicker({ value, onChange }: { value: SpeechSynthesisVoice | null; onChange: (v: SpeechSynthesisVoice) => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const platform = detectPlatform();
  const guide = GUIDES[platform];

  useEffect(() => {
    void listTurkishVoices().then(setVoices);
  }, []);

  const hasGood = voices.some(isHighQuality);

  return (
    <div className="rounded-2xl bg-brand-50 p-4">
      <p className="mb-2 flex items-center gap-2 font-black">
        <Volume2 className="size-5 text-brand-600" aria-hidden /> Okuyucu ses
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          className="min-w-0 flex-1 rounded-xl border-2 border-ink/10 bg-white px-3 py-2 font-bold"
          value={value?.voiceURI ?? ""}
          onChange={(e) => {
            const v = voices.find((x) => x.voiceURI === e.target.value);
            if (v) {
              saveVoiceChoice(v);
              onChange(v);
              previewVoice(v);
            }
          }}
          aria-label="Ses seç"
        >
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}{isHighQuality(v) ? " ★ doğal" : ""}
            </option>
          ))}
        </select>
        {value && (
          <Button size="sm" variant="secondary" onClick={() => previewVoice(value)}>
            <Volume2 className="size-4" /> Dene
          </Button>
        )}
      </div>
      <button onClick={() => setShowGuide((s) => !s)} className="mt-3 flex items-center gap-1 text-sm font-extrabold text-brand-700">
        <Sparkles className="size-4" aria-hidden />
        {hasGood ? "Daha fazla doğal ses" : "Ses robotik mi? Daha doğal ses yükle"}
        <ChevronDown className={`size-4 transition ${showGuide ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {showGuide && (
        <div className="mt-2 rounded-xl bg-white p-3 text-sm font-semibold text-ink/70">
          <p className="font-black text-ink">{guide.title}</p>
          <p className="mt-1">{guide.steps}</p>
          <p className="mt-2 text-xs text-ink/50">Sesler ücretsizdir ve cihazın kendi özelliğidir; OkuHız ses kaydı almaz.</p>
        </div>
      )}
    </div>
  );
}
