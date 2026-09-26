import { CheckCircle2, PartyPopper } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import type { GameSummary } from "../components/games/GameShell";
import { SentenceVerify } from "../components/games/SentenceVerify";
import { Syllables } from "../components/games/Syllables";
import { WordCatch } from "../components/games/WordCatch";
import { WordChain } from "../components/games/WordChain";
import { Layout } from "../components/Layout";
import { MODES } from "../components/reading/ModePicker";
import { ReadingFlow } from "../components/reading/ReadingFlow";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { useRouter } from "../lib/router";

const STEPS = ["Kelime oyunu", "Okuma", "Tekrar okuma", "Anlama soruları"];

/** Günlük 10 dakikalık antrenman: 2 dk oyun, 4 dk okuma, 2 dk tekrar, 2 dk sorular. */
export function Training() {
  const { child } = useApp();
  const { navigate } = useRouter();
  const today = useAsync(() => api.today(child!.id), [child?.id]);
  const textId = today.data?.recommendedTextId;
  const text = useAsync(() => (textId ? api.text(textId) : Promise.resolve(null)), [textId]);
  const [step, setStep] = useState<"game" | "reading" | "done">("game");

  const mode = today.data?.recommendedMode ?? "normal";
  const activeIndex = step === "game" ? 0 : step === "reading" ? 1 : 4;

  return (
    <Layout back="/">
      <ol className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col items-center gap-1 text-center">
            <span className={`h-2 w-full rounded-full ${i < activeIndex ? "bg-brand-500" : i === activeIndex || (step === "reading" && i > 0) ? "bg-brand-200" : "bg-ink/10"}`} />
            <span className="text-xs font-extrabold text-ink/60">{s}</span>
          </li>
        ))}
      </ol>

      {(today.loading || text.loading) && <Spinner />}
      {(today.error || text.error) && <ErrorBox message={today.error ?? text.error!} />}

      {today.data && step === "game" && (() => {
        // Isınma oyunu her gün değişir (≈2 dk).
        const done = (_: GameSummary) => setStep("reading");
        const level = child?.current_level ?? 2;
        const day = Math.floor(Date.parse(`${today.data.date}T00:00:00Z`) / 86_400_000) % 4;
        if (day === 1) return <SentenceVerify level={level} doneLabel="Okumaya Geç" onDone={done} />;
        if (day === 2) return <WordChain level={level} rounds={6} doneLabel="Okumaya Geç" onDone={done} />;
        if (day === 3) return <Syllables level={level} rounds={8} doneLabel="Okumaya Geç" onDone={done} />;
        return <WordCatch initialDisplayMs={today.data.wordCatchDisplayMs} rounds={10} doneLabel="Okumaya Geç" onDone={done} />;
      })()}

      {step === "reading" && text.data && (
        <>
          <Card className="mb-4 !p-4">
            <p className="font-bold text-ink/60">
              Bugünkü metin: <span className="text-ink">{text.data.title}</span> · Mod:{" "}
              <span className="text-brand-700">{MODES.find((m) => m.id === mode)?.title}</span>
            </p>
          </Card>
          <ReadingFlow text={text.data} mode={mode} plan="training" completeLabel="Antrenmanı Bitir" onComplete={() => setStep("done")} />
        </>
      )}

      {step === "done" && (
        <Card className="animate-fade-up mx-auto max-w-md text-center">
          <PartyPopper className="mx-auto size-16 text-coral-500" aria-hidden />
          <h2 className="mt-3 text-3xl font-black">Bugünkü antrenman tamam!</h2>
          <ul className="mt-4 flex flex-col gap-2 text-left font-bold">
            {STEPS.map((s) => (
              <li key={s} className="flex items-center gap-2"><CheckCircle2 className="size-6 text-brand-500" /> {s}</li>
            ))}
          </ul>
          <Button size="lg" className="mt-6 w-full" onClick={() => navigate("/")}>Ana Sayfa</Button>
        </Card>
      )}
    </Layout>
  );
}
