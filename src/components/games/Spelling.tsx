import { Lightbulb, SpellCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { GAME_DATA, shuffle, type SpellingItem } from "../../lib/games-data";
import { Button } from "../ui";
import { GameShell, type GameSummary, type RoundOutcome } from "./GameShell";

function buildItems(level: number, rounds: number): SpellingItem[] {
  const levels = level <= 2 ? [1, 1, 2] : level <= 4 ? [1, 2, 3] : [2, 3, 3];
  const pools = new Map([1, 2, 3].map((l) => [l, shuffle(GAME_DATA.spelling.filter((s) => s.level === l))]));
  const picked: SpellingItem[] = [];
  for (let i = 0; picked.length < rounds && i < rounds * 3; i++) {
    const item = pools.get(levels[i % levels.length])?.pop();
    if (item) picked.push(item);
  }
  return picked.sort((a, b) => a.level - b.level);
}

/**
 * Doğru Yazılanı Bul: doğru yazılışı yaygın yanlış yazılışlar arasından seç (TDK Yazım Kılavuzu).
 * Yanlış biçimlerle karşılaşmanın doğru yazımı bulanıklaştırmaması için her cevaptan sonra
 * doğru yazılış büyük gösterilir ve kısa bir kural ipucu verilir; çocuk "Devam"a basınca geçilir.
 */
export function Spelling({ level, rounds = 10, onDone, doneLabel }: { level: number; rounds?: number; onDone: (s: GameSummary) => void; doneLabel?: string }) {
  const items = useMemo(() => buildItems(level, rounds), [level, rounds]);
  return (
    <GameShell
      gameType="spelling"
      title="Doğru Yazılanı Bul"
      intro="Kelimelerden yalnızca biri doğru yazılmış. Dikkatlice oku ve doğru yazılanı bul!"
      icon={<SpellCheck className="size-10" />}
      rounds={items.length}
      onDone={onDone}
      doneLabel={doneLabel}
      renderRound={(r, end) => <Round item={items[r]} onEnd={end} />}
    />
  );
}

function Round({ item, onEnd }: { item: SpellingItem; onEnd: (o: RoundOutcome) => void }) {
  const shownAt = useRef(performance.now());
  const options = useMemo(() => shuffle([item.correct, ...item.wrong]), [item]);
  const [picked, setPicked] = useState<string | null>(null);
  const [reaction, setReaction] = useState(0);
  const phrase = item.correct.includes(" ");
  const correct = picked === item.correct;

  return (
    <div>
      <p className="mb-4 text-center text-sm font-extrabold uppercase tracking-wide text-ink/45">Hangisi doğru yazılmış?</p>
      {picked === null ? (
        <div className={`grid gap-3 ${phrase ? "grid-cols-1" : "grid-cols-2"}`}>
          {options.map((o) => (
            <button
              key={o}
              onClick={() => {
                setPicked(o);
                setReaction(Math.round(performance.now() - shownAt.current));
              }}
              className="font-read rounded-2xl border-3 border-ink/10 bg-white px-4 py-5 text-2xl font-semibold transition hover:border-brand-300 hover:bg-brand-50"
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        // Cevaptan sonra yanlış biçimler gizlenir; yalnızca doğru yazılış ve kural gösterilir.
        <div className="animate-pop flex flex-col items-center gap-4 rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
          <p className={`text-lg font-black ${correct ? "text-brand-700" : "text-coral-700"}`}>
            {correct ? "Doğru! 🎉" : "Doğrusu şöyle yazılır:"}
          </p>
          <p className="font-read rounded-2xl bg-brand-50 px-6 py-3 text-4xl font-semibold text-brand-800">{item.correct}</p>
          <p className="flex items-start gap-2 text-left font-semibold text-ink/70">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-sun-500" aria-hidden /> {item.tip}
          </p>
          <Button size="lg" onClick={() => onEnd({ correct, reactionMs: reaction })}>Devam</Button>
        </div>
      )}
    </div>
  );
}
