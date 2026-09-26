import { Link2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { isValidSegmentation } from "../../../shared/turkish";
import { PRIMARY_WORDS, WORD_POOL, sample } from "../../lib/games-data";
import { Button } from "../ui";
import { GameShell, type GameSummary, type RoundOutcome } from "./GameShell";

const DICTIONARY = new Set(WORD_POOL);

interface Chain {
  words: string[];
  text: string;
}

/** Seviyeye göre zincir: kelime sayısı ve uzunluğu artar. */
function buildChains(level: number, rounds: number): Chain[] {
  const count = level <= 2 ? 2 : level <= 4 ? 3 : 4;
  const maxLen = level <= 2 ? 5 : level <= 4 ? 6 : 7;
  const pool = PRIMARY_WORDS.filter((w) => w.length >= 3 && w.length <= maxLen);
  return Array.from({ length: rounds }, () => {
    const words = sample(pool, count);
    return { words, text: words.join("") };
  });
}

/**
 * Kelime Zinciri (TOSWRF benzeri görev): boşluksuz yazılmış kelimeleri ayır.
 * Kelimeyi bütün olarak ve otomatik tanıma becerisini çalıştırır. Beklenenden farklı
 * ama her parçası gerçek kelime olan bölmeler de doğru sayılır.
 */
export function WordChain({ level, rounds = 8, onDone, doneLabel }: { level: number; rounds?: number; onDone: (s: GameSummary) => void; doneLabel?: string }) {
  const chains = useMemo(() => buildChains(level, rounds), [level, rounds]);
  return (
    <GameShell
      gameType="word_chain"
      title="Kelime Zinciri"
      intro="Kelimeler birbirine yapışmış! Her kelimenin bittiği harfe dokunarak kelimeleri ayır."
      icon={<Link2 className="size-10" />}
      rounds={chains.length}
      onDone={onDone}
      doneLabel={doneLabel}
      renderRound={(r, end) => <Round chain={chains[r]} onEnd={end} />}
    />
  );
}

function Round({ chain, onEnd }: { chain: Chain; onEnd: (o: RoundOutcome) => void }) {
  const letters = useMemo(() => [...chain.text], [chain]);
  const [cuts, setCuts] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const shownAt = useRef(performance.now());

  const expectedCuts = useMemo(() => {
    const s = new Set<number>();
    let pos = 0;
    chain.words.slice(0, -1).forEach((w) => s.add((pos += [...w].length) - 1));
    return s;
  }, [chain]);

  const toggle = (i: number) => {
    if (result || i === letters.length - 1) return;
    setCuts((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const check = () => {
    const pieces: string[] = [];
    let current = "";
    letters.forEach((ch, i) => {
      current += ch;
      if (cuts.has(i)) {
        pieces.push(current);
        current = "";
      }
    });
    pieces.push(current);
    const ok = isValidSegmentation(chain.text, pieces, DICTIONARY);
    setResult(ok ? "correct" : "wrong");
    if (!ok) setCuts(expectedCuts);
    setTimeout(() => onEnd({ correct: ok, reactionMs: Math.round(performance.now() - shownAt.current) }), ok ? 700 : 1800);
  };

  return (
    <div>
      <div
        className={`mb-6 flex flex-wrap justify-center gap-y-3 rounded-3xl bg-white p-5 shadow-[0_6px_24px_rgba(15,81,75,0.08)] ${
          result === "correct" ? "ring-4 ring-brand-400" : result === "wrong" ? "ring-4 ring-coral-400" : ""
        }`}
      >
        {letters.map((ch, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            aria-label={`${ch}${cuts.has(i) ? ", burada ayrıldı" : ""}`}
            className={`font-read grid h-14 min-w-9 place-items-center rounded-xl px-1 text-3xl font-semibold transition ${
              cuts.has(i) ? "mr-4 bg-sun-300" : "hover:bg-brand-50"
            }`}
          >
            {ch}
          </button>
        ))}
      </div>
      {result === "wrong" && <p className="mb-3 text-center font-bold text-coral-700">Doğrusu: {chain.words.join(" · ")}</p>}
      <div className="flex justify-center gap-3">
        <Button variant="ghost" onClick={() => setCuts(new Set())} disabled={!!result || cuts.size === 0}>Temizle</Button>
        <Button size="lg" onClick={check} disabled={!!result || cuts.size === 0}>Kontrol et</Button>
      </div>
    </div>
  );
}
