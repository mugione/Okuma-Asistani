import { PuzzleIcon } from "lucide-react";
import { useMemo, useRef } from "react";
import { GAME_DATA, sample, shuffle, type MissingWordItem } from "../../lib/games-data";
import { GameShell, OptionGrid, type GameSummary, type RoundOutcome } from "./GameShell";

/** Eksik kelime: cümleye anlamca ve dilbilgisi olarak uyan kelimeyi seç. */
export function MissingWord({ rounds = 8, onDone }: { rounds?: number; onDone: (s: GameSummary) => void }) {
  const items = useMemo(() => sample(GAME_DATA.missingWord, rounds), [rounds]);
  return (
    <GameShell
      gameType="missing_word"
      title="Eksik Kelime"
      intro="Cümlede bir kelime eksik. Cümleyi oku ve boşluğa en uygun kelimeyi seç."
      icon={<PuzzleIcon className="size-10" />}
      rounds={items.length}
      onDone={onDone}
      renderRound={(r, end) => <Round item={items[r]} onEnd={end} />}
    />
  );
}

function Round({ item, onEnd }: { item: MissingWordItem; onEnd: (o: RoundOutcome) => void }) {
  const shownAt = useRef(performance.now());
  const options = useMemo(() => shuffle(item.options), [item]);
  const [before, after] = item.sentence.split("_____");
  return (
    <div>
      <div className="mb-6 rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
        <p className="font-read text-3xl leading-relaxed">
          {before}
          <span className="mx-1 inline-block min-w-24 border-b-4 border-dashed border-brand-400">&nbsp;</span>
          {after}
        </p>
      </div>
      <OptionGrid options={options} correct={item.options[0]} columns={1} onAnswer={(ok) => onEnd({ correct: ok, reactionMs: Math.round(performance.now() - shownAt.current) })} />
    </div>
  );
}
