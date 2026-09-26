import { Repeat } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FinishReadingResult, PublicQuestion, ReadingModeName, SubmitAnswersResult, TextDetail } from "../../../shared/api-types";
import { api, ApiRequestError } from "../../api/client";
import { useApp } from "../../lib/app-state";
import { Button, Card, ErrorBox, Spinner } from "../ui";
import { AccuracyInput } from "./AccuracyInput";
import { QuestionsView } from "./QuestionsView";
import { ReadingView } from "./ReadingView";
import { ResultView } from "./ResultView";

/**
 * standard  : oku → sorular → sonuç → (isteğe bağlı tekrar okumalar)
 * training  : oku → tekrar oku → sorular → sonuç   (günlük antrenman)
 * placement : oku → sorular → sonuç                (seviye testi)
 */
export type FlowPlan = "standard" | "training" | "placement";

type Stage = "starting" | "reading" | "accuracy" | "between" | "questions" | "result" | "error";

export interface FlowOutcome {
  finishes: FinishReadingResult[];
  answers: SubmitAnswersResult | null;
}

export function ReadingFlow({
  text,
  mode,
  plan,
  onComplete,
  completeLabel = "Bitti",
}: {
  text: TextDetail;
  mode: ReadingModeName;
  plan: FlowPlan;
  onComplete: (outcome: FlowOutcome) => void;
  completeLabel?: string;
}) {
  const { child, refresh, celebrate } = useApp();
  const [stage, setStage] = useState<Stage>("starting");
  const [session, setSession] = useState<{ id: string; targetWpm: number; attempt: number; questions: PublicQuestion[] } | null>(null);
  /** Soruların sorulduğu okumanın soruları (sonuç ekranında gösterilir). */
  const [askedQuestions, setAskedQuestions] = useState<PublicQuestion[]>([]);
  const [duration, setDuration] = useState(0);
  const [finishes, setFinishes] = useState<FinishReadingResult[]>([]);
  const [answers, setAnswers] = useState<SubmitAnswersResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resumeSignal, setResumeSignal] = useState(0);
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    if (!child) return;
    setStage("starting");
    setNotice(null);
    try {
      const s = await api.startReading({ childId: child.id, textId: text.id, mode });
      setSession({ id: s.sessionId, targetWpm: s.targetWpm, attempt: s.attemptNumber, questions: s.questions });
      setStage("reading");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okuma başlatılamadı.");
      setStage("error");
    }
  }, [child, text.id, mode]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  const submitFinish = async (errorCount: number | null) => {
    if (!session) return;
    setBusy(true);
    try {
      const f = await api.finishReading(session.id, { durationSeconds: duration, errorCount });
      const all = [...finishes, f];
      setFinishes(all);
      celebrate(f.newAchievements);
      void refresh();
      if (answers) setStage("result"); // tekrar okumalar: soru yok
      else if (plan === "training" && f.attemptNumber === 1 && f.canRepeat) setStage("between");
      else setStage("questions");
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "UNREALISTIC_SPEED") {
        setNotice(e.message);
        setStage("reading");
        setResumeSignal((n) => n + 1);
      } else {
        setError(e instanceof Error ? e.message : "Kaydedilemedi.");
        setStage("error");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitAnswers = async (list: { questionId: number; selectedOption: string }[]) => {
    if (!session) return;
    setBusy(true);
    try {
      const a = await api.submitAnswers(session.id, list);
      setAskedQuestions(session.questions);
      setAnswers(a);
      celebrate(a.newAchievements);
      void refresh();
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cevaplar gönderilemedi.");
      setStage("error");
    } finally {
      setBusy(false);
    }
  };

  if (!child) return null;
  const latest = finishes[finishes.length - 1];

  return (
    <div>
      {stage === "starting" && <Spinner label="Metin hazırlanıyor…" />}
      {stage === "error" && error && <ErrorBox message={error} />}

      {/* Doğruluk adımında da monte kalır: sunucu reddederse kronometre kaldığı yerden devam eder. */}
      {(stage === "reading" || stage === "accuracy") && session && (
        <div className={stage === "accuracy" ? "hidden" : ""}>
          {notice && <div className="mb-4"><ErrorBox message={notice} /></div>}
          {session.attempt > 1 && (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-grape-100 px-4 py-1.5 font-extrabold text-grape-700">
              <Repeat className="size-4" /> {session.attempt}. okuma
            </p>
          )}
          <ReadingView
            key={session.id}
            content={text.content}
            mode={mode}
            targetWpm={session.targetWpm}
            level={child.current_level}
            resumeSignal={resumeSignal}
            onFinish={(d) => {
              setDuration(d);
              setStage("accuracy");
            }}
          />
        </div>
      )}

      {stage === "accuracy" && <AccuracyInput onSubmit={submitFinish} loading={busy} />}

      {stage === "between" && latest && (
        <Card className="animate-fade-up mx-auto max-w-md text-center">
          <p className="text-5xl font-black text-brand-600 tabular-nums">{Math.round(latest.wpm)}</p>
          <p className="font-extrabold text-ink/50">kelime/dk</p>
          <h2 className="mt-4 text-2xl font-black">Şimdi aynı metni bir kez daha oku!</h2>
          <p className="mt-1 font-semibold text-ink/60">Tekrar okumak akıcılığı ve anlamayı güçlendirir.</p>
          <Button className="mt-5 w-full" size="lg" onClick={start}>
            <Repeat className="size-5" /> Tekrar Oku
          </Button>
        </Card>
      )}

      {stage === "questions" && session && (
        <QuestionsView key={session.id} questions={session.questions} onSubmit={submitAnswers} loading={busy} />
      )}

      {stage === "result" && latest && (
        <>
          <ResultView finish={latest} answers={answers} questions={askedQuestions} />
          <div className="mx-auto mt-5 flex max-w-xl flex-col gap-3 sm:flex-row">
            {plan === "standard" && latest.canRepeat && (
              <Button variant="secondary" className="flex-1" onClick={start}>
                <Repeat className="size-5" /> Tekrar Oku ({latest.attemptNumber + 1}/3)
              </Button>
            )}
            <Button className="flex-1" size="lg" onClick={() => onComplete({ finishes, answers })}>
              {completeLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
