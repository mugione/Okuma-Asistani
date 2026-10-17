import { Equal, Layers, ListChecks, PartyPopper, Play, RotateCcw, ThumbsUp, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { requeueMissed, SYNONYM_GROUPS } from "../../../shared/synonyms";
import { api } from "../../api/client";
import { useApp } from "../../lib/app-state";
import { shuffle } from "../../lib/games-data";
import { preloadWords, speakWords, stopSpeaking } from "../../lib/word-audio";
import { Button, Card, ErrorBox, ProgressBar, Stars } from "../ui";
import { GameShell, OptionGrid, type GameSummary, type RoundOutcome } from "./GameShell";

type Group = readonly string[];

/**
 * Eş Anlamlı Kelimeler: iki çalışma türü.
 * - Test: kelimenin eş anlamlısını 4 seçenek arasından bul.
 * - Kartlarla tekrar: kartı çevir, eş anlamlısını gör ve dinle; bilmediğin kart birkaç kart sonra yeniden gelir.
 * Kelimeler ElevenLabs sesiyle (yoksa tarayıcı sesiyle) okunur.
 */
export function Synonyms({ rounds = 10, onDone }: { rounds?: number; onDone: (s: GameSummary) => void }) {
  const [mode, setMode] = useState<"pick" | "quiz" | "cards">("pick");
  useEffect(() => stopSpeaking, []);

  if (mode === "quiz") return <SynonymQuiz rounds={rounds} onDone={onDone} />;
  if (mode === "cards") return <SynonymCards cards={rounds} onDone={onDone} />;
  return (
    <Card className="animate-fade-up mx-auto max-w-md text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-600"><Equal className="size-10" /></div>
      <h2 className="mt-3 text-3xl font-black">Eş Anlamlı Kelimeler</h2>
      <p className="mt-2 text-lg font-semibold text-ink/60">Aynı anlama gelen kelimeleri öğren! Örneğin: kalp = yürek.</p>
      <div className="mt-6 grid gap-3">
        <ModeButton icon={<Layers className="size-8" />} title="Kartlarla Tekrar" sub="Kartı çevir, dinle; bilmediklerin tekrar gelsin" onClick={() => setMode("cards")} />
        <ModeButton icon={<ListChecks className="size-8" />} title="Test" sub="Eş anlamlısını 4 seçenek arasından bul" onClick={() => setMode("quiz")} />
      </div>
    </Card>
  );
}

function ModeButton({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 rounded-2xl border-3 border-ink/10 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">{icon}</span>
      <span>
        <span className="block text-xl font-black">{title}</span>
        <span className="block text-sm font-bold text-ink/60">{sub}</span>
      </span>
    </button>
  );
}

function SpeakButton({ words, label }: { words: readonly string[]; label: string }) {
  return (
    <button
      onClick={() => void speakWords(words)}
      aria-label={label}
      className="grid size-12 place-items-center rounded-full bg-brand-100 text-brand-700 transition hover:bg-brand-200"
    >
      <Volume2 className="size-6" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Test

interface QuizItem { word: string; answer: string; group: Group; options: string[] }

function buildQuiz(rounds: number): QuizItem[] {
  const groups = shuffle([...SYNONYM_GROUPS]);
  return groups.slice(0, rounds).map((group) => {
    const [word, answer] = shuffle([...group]);
    // Çeldiriciler başka gruplardan; her gruptan en fazla bir kelime.
    const distractors = shuffle(groups.filter((g) => g !== group)).slice(0, 3).map((g) => shuffle([...g])[0]);
    return { word, answer, group, options: [answer, ...distractors] };
  });
}

function SynonymQuiz({ rounds, onDone }: { rounds: number; onDone: (s: GameSummary) => void }) {
  const items = useMemo(() => buildQuiz(rounds), [rounds]);
  return (
    <GameShell
      gameType="synonyms"
      title="Eş Anlamlı Kelimeler · Test"
      intro="Kelimeyi oku ve dinle, aynı anlama gelen kelimeyi bul!"
      icon={<Equal className="size-10" />}
      rounds={items.length}
      onDone={onDone}
      renderRound={(r, end) => <QuizRound item={items[r]} next={items[r + 1]} onEnd={end} />}
    />
  );
}

function QuizRound({ item, next, onEnd }: { item: QuizItem; next?: QuizItem; onEnd: (o: RoundOutcome) => void }) {
  const shownAt = useRef(performance.now());
  const options = useMemo(() => shuffle(item.options), [item]);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);

  useEffect(() => {
    void speakWords([item.word]);
    if (next) preloadWords([next.word, next.answer]);
  }, [item, next]);

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
        <p className="text-sm font-extrabold uppercase tracking-wide text-ink/45">Eş anlamlısı hangisi?</p>
        <div className="flex items-center gap-3">
          <p className="font-read text-5xl font-semibold">{item.word}</p>
          <SpeakButton words={[item.word]} label={`${item.word} kelimesini dinle`} />
        </div>
        {outcome && (
          <p className="animate-pop text-xl font-black text-brand-700" aria-live="polite">{item.group.join(" = ")}</p>
        )}
      </div>
      <OptionGrid
        options={options}
        correct={item.answer}
        onAnswer={(correct) => {
          const o = { correct, reactionMs: Math.round(performance.now() - shownAt.current) };
          setOutcome(o);
          void speakWords(item.group);
        }}
      />
      {outcome && (
        <Button size="lg" className="mt-5 w-full" onClick={() => onEnd(outcome)}>Devam</Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Kartlarla tekrar

function SynonymCards({ cards, onDone }: { cards: number; onDone: (s: GameSummary) => void }) {
  const { child, refresh, celebrate } = useApp();
  const [deck, setDeck] = useState<Group[]>(() => shuffle([...SYNONYM_GROUPS]).slice(0, cards));
  const [queue, setQueue] = useState<number[]>(() => deck.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<"intro" | "play" | "saving" | "done">("intro");
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const missed = useRef(new Set<number>());
  const seen = useRef(new Set<number>());
  /** "Bilemedim" sonrası kısa bilgi: kartın kaybolmadığını, birazdan geri geleceğini söyler. */
  const [notice, setNotice] = useState<string | null>(null);
  const startedAt = useRef(0);

  const card = queue.length ? deck[queue[0]] : null;
  const learned = deck.length - queue.length;

  useEffect(() => {
    if (phase !== "play" || !card) return;
    void speakWords([card[0]]);
    const upcoming = queue.slice(1, 3).flatMap((i) => deck[i]);
    preloadWords([...card.slice(1), ...upcoming]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, queue]);

  const start = (newDeck = deck) => {
    missed.current = new Set();
    seen.current = new Set();
    setNotice(null);
    setDeck(newDeck);
    setQueue(newDeck.map((_, i) => i));
    setFlipped(false);
    setSummary(null);
    setError(null);
    startedAt.current = performance.now();
    setPhase("play");
  };

  const flip = () => {
    setFlipped(true);
    if (card) void speakWords(card);
  };

  const finish = async () => {
    stopSpeaking();
    setPhase("saving");
    const total = deck.length;
    const correct = total - missed.current.size;
    const durationSeconds = Math.max(1, Math.round((performance.now() - startedAt.current) / 100) / 10);
    let result = null;
    try {
      if (child) {
        result = await api.gameResult({ childId: child.id, gameType: "synonym_cards", totalItems: total, correctItems: correct, durationSeconds });
        celebrate(result.newAchievements);
        void refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sonuç kaydedilemedi.");
    }
    setSummary({ total, correct, result });
    setPhase("done");
  };

  const answer = (known: boolean) => {
    const [head, ...rest] = queue;
    seen.current.add(head);
    if (!known) missed.current.add(head);
    const next = known ? rest : requeueMissed(rest, head, seen.current);
    setNotice(known ? null : next.length > 1 ? `“${deck[head][0]}” birazdan tekrar gelecek.` : null);
    setFlipped(false);
    setQueue(next);
    if (!next.length) void finish();
  };

  if (phase === "intro") {
    return (
      <Card className="animate-fade-up mx-auto max-w-md text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-600"><Layers className="size-10" /></div>
        <h2 className="mt-3 text-3xl font-black">Kartlarla Tekrar</h2>
        <p className="mt-2 text-lg font-semibold text-ink/60">
          Kelimeyi oku ve dinle, eş anlamlısını düşün, sonra kartı çevir. Bilemediğin kartlar biraz sonra yeniden gelir; hepsini öğrenince bitir!
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => start()}>
          <Play className="size-6 fill-white" /> Başla
        </Button>
      </Card>
    );
  }

  if (phase === "done" && summary) {
    const pct = Math.round((summary.correct / summary.total) * 100);
    return (
      <Card className="animate-fade-up mx-auto max-w-md text-center">
        <PartyPopper className="mx-auto size-14 text-coral-500" aria-hidden />
        <div className="mt-2 flex justify-center"><Stars count={pct >= 90 ? 3 : pct >= 70 ? 2 : 1} size={44} /></div>
        <h2 className="mt-3 text-3xl font-black">{summary.total} kartın hepsini öğrendin!</h2>
        <p className="mt-1 text-lg font-bold text-ink/60">{summary.correct} kartı ilk seferde bildin.</p>
        {summary.result && <p className="mt-1 text-lg font-extrabold text-sun-700">+{summary.result.xpEarned} XP</p>}
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}
        {missed.current.size > 0 && (
          <Button variant="secondary" size="lg" className="mt-6 w-full" onClick={() => start([...missed.current].map((i) => deck[i]))}>
            <RotateCcw className="size-5" /> Zorlandıklarımı tekrar et ({missed.current.size})
          </Button>
        )}
        <Button size="lg" className="mt-3 w-full" onClick={() => onDone(summary)}>Bitti</Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm font-extrabold text-ink/60">{learned} / {deck.length} öğrenildi</span>
        <ProgressBar value={(learned / deck.length) * 100} className="flex-1" />
      </div>
      <p className={`mb-3 flex min-h-6 items-center justify-center gap-1.5 text-sm font-bold text-coral-700 ${notice ? "" : "invisible"}`} aria-live="polite">
        <RotateCcw className="size-4" aria-hidden /> {notice}
      </p>
      {phase === "saving" || !card ? (
        <p className="text-center font-bold text-ink/60">Kaydediliyor…</p>
      ) : (
        <div key={`${queue.length}-${queue[0]}`} className="animate-pop">
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-3xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(15,81,75,0.08)]">
            <div className="flex items-center gap-3">
              <p className="font-read text-5xl font-semibold">{card[0]}</p>
              <SpeakButton words={flipped ? card : [card[0]]} label={`${card[0]} kelimesini dinle`} />
            </div>
            {flipped ? (
              <div className="animate-pop flex flex-col items-center gap-1" aria-live="polite">
                <p className="text-sm font-extrabold uppercase tracking-wide text-ink/45">Eş anlamlısı</p>
                <p className="font-read text-4xl font-semibold text-brand-700">{card.slice(1).join(" · ")}</p>
              </div>
            ) : (
              <p className="font-bold text-ink/50">Eş anlamlısı ne olabilir? Düşün, sonra kartı çevir.</p>
            )}
          </div>
          {flipped ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="danger" size="lg" onClick={() => answer(false)}>
                <RotateCcw className="size-5" /> Bilemedim
              </Button>
              <Button size="lg" onClick={() => answer(true)}>
                <ThumbsUp className="size-5" /> Biliyordum
              </Button>
            </div>
          ) : (
            <Button variant="sun" size="lg" className="mt-5 w-full" onClick={flip}>Kartı Çevir</Button>
          )}
        </div>
      )}
    </div>
  );
}
