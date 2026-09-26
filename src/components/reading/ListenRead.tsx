import { AudioLines, BookOpen, Headphones, Users, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import type { TextDetail } from "../../../shared/api-types";
import { listeningWpm } from "../../../shared/reading";
import { useApp } from "../../lib/app-state";
import { findTurkishVoice, speechSupported, stopSpeaking } from "../../lib/speech";
import { Button, Card, Spinner } from "../ui";
import { ReadingFlow, type FlowOutcome } from "./ReadingFlow";
import { SpeechPlayer } from "./SpeechPlayer";
import { VoicePicker } from "./VoicePicker";

type Stage = "checking" | "unsupported" | "choose" | "listen" | "together" | "read";
const STEPS = [
  { key: "listen", label: "Dinle" },
  { key: "together", label: "Birlikte oku" },
  { key: "read", label: "Kendin oku" },
] as const;

/**
 * Dinle-Oku (model okuma): 1) metni dinle (veya cümle cümle yankı okuma), 2) sesle birlikte oku,
 * 3) kendin oku → sorular. Yalnızca 3. adım kaydedilir; hedef hızı değiştirmez.
 */
export function ListenRead({ text, onComplete }: { text: TextDetail; onComplete: (o: FlowOutcome) => void }) {
  const { child } = useApp();
  const [stage, setStage] = useState<Stage>("checking");
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [echo, setEcho] = useState(false);
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    if (!speechSupported()) {
      setStage("unsupported");
      return;
    }
    void findTurkishVoice().then((v) => {
      setVoice(v);
      setStage(v ? "choose" : "unsupported");
    });
    return () => stopSpeaking();
  }, []);

  if (!child) return null;
  const wpm = listeningWpm(child.target_wpm);
  const activeStep = stage === "listen" ? 0 : stage === "together" ? 1 : stage === "read" ? 2 : -1;

  return (
    <div>
      {activeStep >= 0 && (
        <ol className="mb-5 grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col items-center gap-1 text-center">
              <span className={`h-2 w-full rounded-full ${i < activeStep ? "bg-brand-500" : i === activeStep ? "bg-brand-300" : "bg-ink/10"}`} />
              <span className={`text-xs font-extrabold ${i === activeStep ? "text-brand-700" : "text-ink/50"}`}>
                {i === 0 && echo ? "Dinle ve tekrar et" : s.label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {stage === "checking" && <Spinner label="Ses hazırlanıyor…" />}

      {stage === "unsupported" && (
        <Card className="text-center">
          <VolumeX className="mx-auto size-10 text-coral-500" aria-hidden />
          <p className="mt-2 text-lg font-black">Bu cihazda Türkçe ses bulunamadı.</p>
          <p className="font-semibold text-ink/60">
            Cihazın ayarlarından Türkçe konuşma sesi yükleyebilir ya da başka bir okuma modu seçebilirsin.
          </p>
        </Card>
      )}

      {stage === "choose" && (
        <Card className="animate-fade-up">
          <h2 className="text-xl font-black">Nasıl dinlemek istersin?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { v: false, icon: <Headphones className="size-8" />, t: "Tümünü dinle", s: "Metni baştan sona dinle, gözünle takip et." },
              { v: true, icon: <AudioLines className="size-8" />, t: "Yankı okuma", s: "Her cümleyi dinle, sonra sen tekrar et." },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => setEcho(o.v)}
                aria-pressed={echo === o.v}
                className={`flex flex-col items-start gap-1 rounded-2xl border-3 p-4 text-left transition ${
                  echo === o.v ? "border-brand-500 bg-brand-50" : "border-ink/10 bg-white hover:bg-brand-50"
                }`}
              >
                <span className="text-brand-600">{o.icon}</span>
                <span className="text-lg font-black">{o.t}</span>
                <span className="text-sm font-semibold text-ink/60">{o.s}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <VoicePicker value={voice} onChange={setVoice} />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink/55">
            Ses gelmiyorsa cihazın sesini aç; iPhone'da sessiz modu kapat. Ses kaydı alınmaz.
          </p>
          <Button size="lg" className="mt-4 w-full" onClick={() => setStage("listen")}>
            <Headphones className="size-6" /> Başla
          </Button>
        </Card>
      )}

      {stage === "listen" && (
        <>
          <p className="mb-3 font-bold text-ink/60">
            {echo ? "Her cümleyi dinle, sonra sesli tekrar et." : "Dinle ve sarı işareti gözünle takip et."}
          </p>
          <SpeechPlayer
            key="listen"
            content={text.content}
            voice={voice}
            desiredWpm={wpm}
            echo={echo}
            doneLabel="Sonraki adım: Birlikte oku"
            onDone={() => {
              setSteps(1);
              setStage("together");
            }}
          />
        </>
      )}

      {stage === "together" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="flex flex-1 items-center gap-2 font-bold text-ink/60">
              <Users className="size-5 text-grape-500" aria-hidden /> Şimdi sesle birlikte, aynı anda sesli oku.
            </p>
            <Button size="sm" variant="ghost" onClick={() => { stopSpeaking(); setStage("read"); }}>Bu adımı atla</Button>
          </div>
          <SpeechPlayer
            key="together"
            content={text.content}
            voice={voice}
            desiredWpm={wpm}
            volume={0.6}
            doneLabel="Sonraki adım: Kendin oku"
            onDone={() => {
              setSteps(2);
              setStage("read");
            }}
          />
        </>
      )}

      {stage === "read" && (
        <>
          <p className="mb-3 flex items-center gap-2 font-bold text-ink/60">
            <BookOpen className="size-5 text-brand-600" aria-hidden /> Şimdi sıra sende! Kendi hızında oku.
          </p>
          <ReadingFlow
            text={text}
            mode="normal"
            plan="standard"
            assisted={echo ? "echo" : "listen"}
            assistedSteps={steps}
            completeLabel="Kütüphaneye Dön"
            onComplete={onComplete}
          />
        </>
      )}
    </div>
  );
}
