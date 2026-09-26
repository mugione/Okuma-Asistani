import { PartyPopper, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GameResultResponse, GameType } from "../../../shared/api-types";
import { api } from "../../api/client";
import { useApp } from "../../lib/app-state";
import { Button, Card, ErrorBox, ProgressBar, Stars } from "../ui";

export interface RoundOutcome {
  correct: boolean;
  reactionMs: number;
}

export interface GameSummary {
  total: number;
  correct: number;
  result: GameResultResponse | null;
}

/**
 * Oyunların ortak çerçevesi: giriş → turlar → sonuç kaydı.
 * `renderRound` her tur için çağrılır ve turu `onRoundEnd` ile bitirir.
 */
export function GameShell({
  gameType,
  title,
  intro,
  icon,
  rounds,
  renderRound,
  extraResult,
  onDone,
  doneLabel = "Bitti",
  timeLimitSec,
  summary: renderSummary,
}: {
  gameType: GameType;
  title: string;
  intro: string;
  icon: ReactNode;
  rounds: number;
  renderRound: (round: number, onRoundEnd: (o: RoundOutcome) => void) => ReactNode;
  extraResult?: () => { displayMs?: number };
  onDone: (s: GameSummary) => void;
  doneLabel?: string;
  /** Süreli oyun: süre dolunca (ya da maddeler bitince) oyun biter. */
  timeLimitSec?: number;
  /** Sonuç ekranına oyuna özgü ek bilgi. */
  summary?: (s: GameSummary, durationSec: number) => ReactNode;
}) {
  const { child, refresh, celebrate } = useApp();
  const [phase, setPhase] = useState<"intro" | "play" | "saving" | "done">("intro");
  const [round, setRound] = useState(0);
  const outcomes = useRef<RoundOutcome[]>([]);
  const startedAt = useRef(0);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(timeLimitSec ?? 0);
  const savingRef = useRef(false);
  const durationRef = useRef(0);

  const save = async () => {
    if (!child || savingRef.current) return;
    savingRef.current = true;
    durationRef.current = Math.max(1, Math.round((performance.now() - startedAt.current) / 100) / 10);
    setPhase("saving");
    if (!outcomes.current.length) {
      setSummary({ total: 0, correct: 0, result: null });
      setPhase("done");
      return;
    }
    const list = outcomes.current;
    const correct = list.filter((o) => o.correct).length;
    const avgReactionMs = Math.round(list.reduce((s, o) => s + o.reactionMs, 0) / Math.max(1, list.length));
    let result: GameResultResponse | null = null;
    try {
      result = await api.gameResult({
        childId: child.id,
        gameType,
        totalItems: list.length,
        correctItems: correct,
        avgReactionMs,
        displayMs: extraResult?.().displayMs ?? null,
        durationSeconds: durationRef.current,
      });
      celebrate(result.newAchievements);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sonuç kaydedilemedi.");
    }
    setSummary({ total: list.length, correct, result });
    setPhase("done");
  };

  // Süreli oyunlarda geri sayım.
  useEffect(() => {
    if (phase !== "play" || !timeLimitSec) return;
    const id = setInterval(() => {
      const left = Math.max(0, timeLimitSec - (performance.now() - startedAt.current) / 1000);
      setRemaining(Math.ceil(left));
      if (left <= 0) void save();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLimitSec]);

  const onRoundEnd = (o: RoundOutcome) => {
    if (savingRef.current) return;
    outcomes.current.push(o);
    if (round + 1 >= rounds) void save();
    else setRound((r) => r + 1);
  };

  if (phase === "intro") {
    return (
      <Card className="animate-fade-up mx-auto max-w-md text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-600">{icon}</div>
        <h2 className="mt-3 text-3xl font-black">{title}</h2>
        <p className="mt-2 text-lg font-semibold text-ink/60">{intro}</p>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => {
            outcomes.current = [];
            savingRef.current = false;
            setRemaining(timeLimitSec ?? 0);
            startedAt.current = performance.now();
            setRound(0);
            setPhase("play");
          }}
        >
          <Play className="size-6 fill-white" /> Başla
        </Button>
      </Card>
    );
  }

  if (phase === "done" && summary) {
    const pct = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
    return (
      <Card className="animate-fade-up mx-auto max-w-md text-center">
        <PartyPopper className="mx-auto size-14 text-coral-500" aria-hidden />
        <div className="mt-2 flex justify-center"><Stars count={pct >= 90 ? 3 : pct >= 70 ? 2 : 1} size={44} /></div>
        <h2 className="mt-3 text-3xl font-black">{summary.correct} / {summary.total} doğru</h2>
        {summary.result && <p className="mt-1 text-lg font-extrabold text-sun-700">+{summary.result.xpEarned} XP</p>}
        {renderSummary?.(summary, durationRef.current)}
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}
        <Button size="lg" className="mt-6 w-full" onClick={() => onDone(summary)}>{doneLabel}</Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        {timeLimitSec ? (
          <>
            <span className="w-14 text-sm font-extrabold tabular-nums text-ink/60" aria-live="off">{remaining} sn</span>
            <ProgressBar value={(remaining / timeLimitSec) * 100} color={remaining <= 10 ? "bg-coral-500" : "bg-brand-500"} className="flex-1" />
            <span className="text-sm font-extrabold text-brand-700">{outcomes.current.filter((o) => o.correct).length} ✓</span>
          </>
        ) : (
          <>
            <span className="text-sm font-extrabold text-ink/60">{Math.min(round + 1, rounds)} / {rounds}</span>
            <ProgressBar value={(round / rounds) * 100} className="flex-1" />
          </>
        )}
      </div>
      {phase === "saving" ? <p className="text-center font-bold text-ink/60">Kaydediliyor…</p> : <div key={round}>{renderRound(round, onRoundEnd)}</div>}
    </div>
  );
}

/** Seçenek butonları; seçimden sonra doğru/yanlışı kısaca gösterip turu bitirir. */
export function OptionGrid({
  options,
  correct,
  onAnswer,
  columns = 2,
}: {
  options: string[];
  correct: string;
  onAnswer: (isCorrect: boolean) => void;
  columns?: 1 | 2;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((o) => {
        const state = picked === null ? "idle" : o === correct ? "correct" : o === picked ? "wrong" : "dim";
        return (
          <button
            key={o}
            disabled={picked !== null}
            onClick={() => {
              setPicked(o);
              setTimeout(() => onAnswer(o === correct), o === correct ? 600 : 1300);
            }}
            className={`rounded-2xl border-3 px-4 py-5 text-xl font-black transition ${
              state === "correct"
                ? "animate-pop border-brand-500 bg-brand-100 text-brand-800"
                : state === "wrong"
                  ? "border-coral-500 bg-coral-100 text-coral-700"
                  : state === "dim"
                    ? "border-ink/5 bg-white text-ink/30"
                    : "border-ink/10 bg-white hover:border-brand-300 hover:bg-brand-50"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
