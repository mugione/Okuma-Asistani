import { Check, ListChecks, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_DATA, shuffle, type SentenceVerifyItem } from "../../lib/games-data";
import { GameShell, type GameSummary, type RoundOutcome } from "./GameShell";

export const VERIFY_SECONDS = 90;

/** Okur seviyesine göre cümle seviyeleri (1: kısa, 3: uzun). Kolaydan zora sıralanır. */
function buildItems(level: number): SentenceVerifyItem[] {
  const levels = level <= 2 ? [1, 2] : level <= 4 ? [1, 2, 3] : [2, 3];
  return levels.flatMap((l) => shuffle(GAME_DATA.sentenceVerify.filter((s) => s.level === l)).slice(0, 25));
}

/**
 * Doğru mu Yanlış mı? Süreli sessiz okuma akıcılığı oyunu (TOSREC benzeri görev):
 * çocuk kısa cümleleri olabildiğince hızlı ama anlayarak okur ve doğru/yanlış diye karar verir.
 * Hız tek başına ödüllendirilmez: yanlış cevaplar net puandan düşülür.
 */
export function SentenceVerify({ level, onDone, doneLabel }: { level: number; onDone: (s: GameSummary) => void; doneLabel?: string }) {
  const items = useMemo(() => buildItems(level), [level]);
  return (
    <GameShell
      gameType="sentence_verify"
      title="Doğru mu Yanlış mı?"
      intro={`${VERIFY_SECONDS} saniyen var! Cümleleri hızlı ama dikkatli oku ve doğru mu yanlış mı olduğuna karar ver. Rastgele basarsan puanın düşer.`}
      icon={<ListChecks className="size-10" />}
      rounds={items.length}
      timeLimitSec={VERIFY_SECONDS}
      onDone={onDone}
      doneLabel={doneLabel}
      summary={(s, secs) => {
        const wrong = s.total - s.correct;
        const net = Math.max(0, s.correct - wrong);
        return (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-50 p-3">
              <p className="text-3xl font-black text-brand-700 tabular-nums">{net}</p>
              <p className="text-xs font-extrabold uppercase text-brand-700/70">net puan</p>
            </div>
            <div className="rounded-2xl bg-sun-100 p-3">
              <p className="text-3xl font-black text-sun-700 tabular-nums">{Math.round((s.correct / Math.max(secs, 1)) * 60)}</p>
              <p className="text-xs font-extrabold uppercase text-sun-700/70">doğru cümle / dk</p>
            </div>
          </div>
        );
      }}
      renderRound={(r, end) => <Round item={items[r]} onEnd={end} />}
    />
  );
}

function Round({ item, onEnd }: { item: SentenceVerifyItem; onEnd: (o: RoundOutcome) => void }) {
  const shownAt = useRef(performance.now());
  const [picked, setPicked] = useState<boolean | null>(null);

  const answer = (value: boolean) => {
    if (picked !== null) return;
    setPicked(value);
    const correct = value === item.answer;
    // Akışı bozmamak için çok kısa geri bildirim.
    setTimeout(() => onEnd({ correct, reactionMs: Math.round(performance.now() - shownAt.current) }), correct ? 180 : 450);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "d") answer(true);
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "y") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const flash = picked === null ? "" : picked === item.answer ? "ring-4 ring-brand-400" : "ring-4 ring-coral-400";
  return (
    <div>
      <div className={`mb-6 grid min-h-40 place-items-center rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)] transition ${flash}`}>
        <p className="font-read text-2xl leading-relaxed sm:text-3xl">{item.sentence}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => answer(true)}
          disabled={picked !== null}
          className="flex items-center justify-center gap-2 rounded-2xl bg-brand-500 py-5 text-2xl font-black text-white shadow-[0_5px_0_var(--color-brand-700)] active:translate-y-1 active:shadow-none"
        >
          <Check className="size-7" aria-hidden /> Doğru
        </button>
        <button
          onClick={() => answer(false)}
          disabled={picked !== null}
          className="flex items-center justify-center gap-2 rounded-2xl bg-coral-500 py-5 text-2xl font-black text-white shadow-[0_5px_0_var(--color-coral-700)] active:translate-y-1 active:shadow-none"
        >
          <X className="size-7" aria-hidden /> Yanlış
        </button>
      </div>
      <p className="mt-3 hidden text-center text-xs font-bold text-ink/40 sm:block">Klavye: ← veya D = Doğru · → veya Y = Yanlış</p>
    </div>
  );
}
