import { ArrowLeftRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { GAME_DATA, shuffle, type AntonymItem } from "../../lib/games-data";
import { GameShell, OptionGrid, type GameSummary, type RoundOutcome } from "./GameShell";

/** Okur seviyesine göre kelime seviyeleri; kolaydan zora sıralı. */
function buildItems(level: number, rounds: number): AntonymItem[] {
  const levels = level <= 2 ? [1, 1, 2] : level <= 4 ? [1, 2, 3] : [2, 3, 3];
  const pools = new Map([1, 2, 3].map((l) => [l, shuffle(GAME_DATA.antonyms.filter((a) => a.level === l))]));
  const picked: AntonymItem[] = [];
  for (let i = 0; picked.length < rounds && i < rounds * 3; i++) {
    const item = pools.get(levels[i % levels.length])?.pop();
    if (item) picked.push(item);
  }
  return picked.sort((a, b) => a.level - b.level);
}

/**
 * Zıt Anlamlı Kelimeler: kelimenin zıt anlamlısını seç. Kelime bilgisini ve kelimeler arası
 * anlam ilişkilerini güçlendirir; kelime bilgisi okuduğunu anlamanın en güçlü belirleyicilerindendir.
 */
export function Antonyms({ level, rounds = 10, onDone, doneLabel }: { level: number; rounds?: number; onDone: (s: GameSummary) => void; doneLabel?: string }) {
  const items = useMemo(() => buildItems(level, rounds), [level, rounds]);
  return (
    <GameShell
      gameType="antonyms"
      title="Zıt Anlamlı Kelimeler"
      intro="Ekrandaki kelimenin zıt anlamlısını bul! Örneğin: sıcak ↔ soğuk."
      icon={<ArrowLeftRight className="size-10" />}
      rounds={items.length}
      onDone={onDone}
      doneLabel={doneLabel}
      renderRound={(r, end) => <Round item={items[r]} onEnd={end} />}
    />
  );
}

function Round({ item, onEnd }: { item: AntonymItem; onEnd: (o: RoundOutcome) => void }) {
  const shownAt = useRef(performance.now());
  const options = useMemo(() => shuffle(item.options), [item]);
  const [answered, setAnswered] = useState(false);
  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
        <p className="text-sm font-extrabold uppercase tracking-wide text-ink/45">Zıt anlamlısı hangisi?</p>
        <p className="font-read text-5xl font-semibold">{item.word}</p>
        <p className={`flex items-center gap-2 text-lg font-black text-brand-700 transition ${answered ? "opacity-100" : "opacity-0"}`} aria-live="polite">
          {item.word} <ArrowLeftRight className="size-5" aria-hidden /> {item.options[0]}
        </p>
      </div>
      <OptionGrid
        options={options}
        correct={item.options[0]}
        onAnswer={(ok) => {
          setAnswered(true);
          onEnd({ correct: ok, reactionMs: Math.round(performance.now() - shownAt.current) });
        }}
      />
    </div>
  );
}
