import { Eye } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_DATA, sample, shuffle } from "../../lib/games-data";
import { GameShell, OptionGrid, type GameSummary, type RoundOutcome } from "./GameShell";

export const DISPLAY_MIN_MS = 250;
export const DISPLAY_MAX_MS = 1500;

/** Kelimeyi yakala: kelime kısa süre görünür; doğru cevapta süre kısalır, yanlışta uzar. */
export function WordCatch({ initialDisplayMs, rounds = 10, onDone, doneLabel }: {
  initialDisplayMs: number;
  rounds?: number;
  onDone: (s: GameSummary) => void;
  doneLabel?: string;
}) {
  const items = useMemo(() => sample(GAME_DATA.wordCatch, rounds, true), [rounds]);
  const displayMs = useRef(Math.min(DISPLAY_MAX_MS, Math.max(DISPLAY_MIN_MS, initialDisplayMs)));

  return (
    <GameShell
      gameType="word_catch"
      title="Kelimeyi Yakala"
      intro="Ekranda bir kelime çok kısa süre görünecek. Gözünü ayırma ve hangi kelime olduğunu seç!"
      icon={<Eye className="size-10" />}
      rounds={items.length}
      extraResult={() => ({ displayMs: displayMs.current })}
      onDone={onDone}
      doneLabel={doneLabel}
      renderRound={(r, end) => (
        <Round
          item={items[r]}
          displayMs={displayMs.current}
          onEnd={(o) => {
            displayMs.current = o.correct
              ? Math.max(DISPLAY_MIN_MS, displayMs.current - 50)
              : Math.min(DISPLAY_MAX_MS, displayMs.current + 100);
            end(o);
          }}
        />
      )}
    />
  );
}

function Round({ item, displayMs, onEnd }: { item: { word: string; options: string[] }; displayMs: number; onEnd: (o: RoundOutcome) => void }) {
  const [phase, setPhase] = useState<"ready" | "show" | "choose">("ready");
  const shownAt = useRef(0);
  const options = useMemo(() => shuffle(item.options), [item]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 700);
    const t2 = setTimeout(() => {
      setPhase("choose");
      shownAt.current = performance.now();
    }, 700 + displayMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [displayMs]);

  return (
    <div>
      <div className="mb-6 grid h-40 place-items-center rounded-3xl bg-white shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
        {phase === "ready" && <span className="text-4xl font-black text-ink/20">+</span>}
        {phase === "show" && <span className="font-read text-5xl font-semibold tracking-wider">{item.word}</span>}
        {phase === "choose" && <span className="text-lg font-bold text-ink/50">Hangi kelimeydi?</span>}
      </div>
      {phase === "choose" && (
        <OptionGrid
          options={options}
          correct={item.options[0]}
          onAnswer={(ok) => onEnd({ correct: ok, reactionMs: Math.round(performance.now() - shownAt.current) })}
        />
      )}
      <p className="mt-4 text-center text-sm font-bold text-ink/40">Gösterim süresi: {displayMs} ms</p>
    </div>
  );
}
