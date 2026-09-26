import { Blocks } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { isSafeForSyllables, syllabify } from "../../../shared/turkish";
import { PRIMARY_WORDS, sample, shuffle } from "../../lib/games-data";
import { GameShell, type GameSummary, type RoundOutcome } from "./GameShell";

interface Item {
  word: string;
  syllables: string[];
}

function buildItems(level: number, rounds: number): Item[] {
  const [min, max] = level <= 2 ? [2, 2] : level <= 4 ? [2, 3] : [3, 4];
  const pool = PRIMARY_WORDS.filter(isSafeForSyllables)
    .map((word) => ({ word, syllables: syllabify(word) }))
    .filter((w) => w.syllables.length >= min && w.syllables.length <= max);
  return sample(pool, rounds);
}

/** Karıştırılmış heceler asla doğru sırada gelmesin. */
function scramble(syllables: string[]): { id: number; text: string }[] {
  const chips = syllables.map((text, id) => ({ id, text }));
  let out = shuffle(chips);
  for (let tries = 0; tries < 10 && out.map((c) => c.text).join("") === syllables.join(""); tries++) out = shuffle(chips);
  return out;
}

/**
 * Heceleri Birleştir: Türkçe okuma öğretiminin temeli olan heceleme becerisini
 * otomatikleştirir. Heceler karışık gelir; çocuk doğru sırayla dokunur.
 */
export function Syllables({ level, rounds = 8, onDone, doneLabel }: { level: number; rounds?: number; onDone: (s: GameSummary) => void; doneLabel?: string }) {
  const items = useMemo(() => buildItems(level, rounds), [level, rounds]);
  return (
    <GameShell
      gameType="syllables"
      title="Heceleri Birleştir"
      intro="Heceler karışmış! Kelimeyi oluşturmak için heceleri doğru sırayla dokun."
      icon={<Blocks className="size-10" />}
      rounds={items.length}
      onDone={onDone}
      doneLabel={doneLabel}
      renderRound={(r, end) => <Round item={items[r]} onEnd={end} />}
    />
  );
}

function Round({ item, onEnd }: { item: Item; onEnd: (o: RoundOutcome) => void }) {
  const chips = useMemo(() => scramble(item.syllables), [item]);
  const [used, setUsed] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const mistakes = useRef(0);
  const shownAt = useRef(performance.now());
  const done = used.length === item.syllables.length;

  const tap = (chip: { id: number; text: string }) => {
    if (done || used.includes(chip.id)) return;
    // Aynı metne sahip iki hece varsa hangisi seçilirse seçilsin doğru sayılır.
    if (chip.text === item.syllables[used.length]) {
      const next = [...used, chip.id];
      setUsed(next);
      if (next.length === item.syllables.length) {
        setTimeout(() => onEnd({ correct: mistakes.current === 0, reactionMs: Math.round(performance.now() - shownAt.current) }), 800);
      }
    } else {
      mistakes.current++;
      setShake(chip.id);
      setTimeout(() => setShake(null), 400);
    }
  };

  return (
    <div>
      <div className={`mb-6 flex min-h-24 items-center justify-center gap-2 rounded-3xl bg-white p-5 shadow-[0_6px_24px_rgba(15,81,75,0.08)] ${done ? "ring-4 ring-brand-400" : ""}`}>
        {item.syllables.map((_, i) => (
          <span
            key={i}
            className={`font-read grid h-14 min-w-16 place-items-center rounded-2xl px-3 text-3xl font-semibold ${
              i < used.length ? "bg-brand-100 text-brand-800" : "border-3 border-dashed border-ink/15"
            }`}
          >
            {i < used.length ? item.syllables[i] : ""}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => tap(chip)}
            disabled={used.includes(chip.id)}
            className={`font-read min-w-20 rounded-2xl border-3 px-5 py-4 text-3xl font-semibold transition ${
              used.includes(chip.id)
                ? "border-transparent bg-ink/5 text-ink/20"
                : shake === chip.id
                  ? "animate-pulse border-coral-500 bg-coral-100 text-coral-700"
                  : "border-ink/10 bg-white hover:border-brand-300 hover:bg-brand-50"
            }`}
          >
            {chip.text}
          </button>
        ))}
      </div>
    </div>
  );
}
