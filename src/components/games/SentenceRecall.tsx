import { MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { msPerWord } from "../../../shared/pacing";
import { countWords } from "../../../shared/reading";
import { GAME_DATA, sample, shuffle, type SentenceRecallItem } from "../../lib/games-data";
import { Button } from "../ui";
import { GameShell, OptionGrid, type GameSummary, type RoundOutcome } from "./GameShell";

/** Cümleyi hatırla: cümle hedef hıza göre kısa süre görünür, sonra ayrıntı sorulur. */
export function SentenceRecall({ targetWpm, rounds = 5, onDone }: { targetWpm: number; rounds?: number; onDone: (s: GameSummary) => void }) {
  const items = useMemo(() => sample(GAME_DATA.sentenceRecall, rounds), [rounds]);
  return (
    <GameShell
      gameType="sentence_recall"
      title="Cümleyi Hatırla"
      intro="Bir cümle kısa süre görünecek. Dikkatlice oku, sonra sorulan soruyu cevapla."
      icon={<MessageSquareText className="size-10" />}
      rounds={items.length}
      onDone={onDone}
      renderRound={(r, end) => <Round item={items[r]} targetWpm={targetWpm} onEnd={end} />}
    />
  );
}

function Round({ item, targetWpm, onEnd }: { item: SentenceRecallItem; targetWpm: number; onEnd: (o: RoundOutcome) => void }) {
  const [phase, setPhase] = useState<"show" | "ask">("show");
  const askedAt = useRef(0);
  const options = useMemo(() => shuffle(item.options), [item]);
  // Hedef hızdaki okuma süresi + 1,5 sn düşünme payı.
  const showMs = countWords(item.sentence) * msPerWord(targetWpm) + 1500;

  const ask = () => {
    askedAt.current = performance.now();
    setPhase("ask");
  };
  useEffect(() => {
    const t = setTimeout(ask, showMs);
    return () => clearTimeout(t);
  }, [showMs]);

  return phase === "show" ? (
    <div className="grid min-h-48 place-items-center rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
      <p className="font-read text-3xl leading-relaxed">{item.sentence}</p>
      <Button variant="ghost" size="sm" onClick={ask}>Hazırım</Button>
    </div>
  ) : (
    <div>
      <h2 className="mb-5 text-center text-2xl font-black">{item.question}</h2>
      <OptionGrid options={options} correct={item.options[0]} onAnswer={(ok) => onEnd({ correct: ok, reactionMs: Math.round(performance.now() - askedAt.current) })} />
    </div>
  );
}
