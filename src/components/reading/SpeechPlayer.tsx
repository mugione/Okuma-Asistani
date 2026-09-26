import { Pause, Play, Repeat, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokenize } from "../../../shared/pacing";
import { calibrateRate, initialRate, sentencePause, splitSentences } from "../../../shared/speech";
import { speakSentence, stopSpeaking } from "../../lib/speech";
import { Button, ProgressBar } from "../ui";

/**
 * Metni cümle cümle sesli okur ve okunan kelimeyi vurgular.
 * - `echo`: her cümleden sonra durur, çocuk tekrar edip "Tekrarladım" der (yankı okuma).
 * - Bir cümleye dokununca oradan devam eder.
 * Konuşma hızı her cümleden sonra ölçülüp hedefe (desiredWpm) yaklaştırılır.
 */
export function SpeechPlayer({
  content,
  voice,
  desiredWpm,
  volume = 1,
  echo = false,
  onDone,
  doneLabel,
}: {
  content: string;
  voice: SpeechSynthesisVoice | null;
  desiredWpm: number;
  volume?: number;
  echo?: boolean;
  onDone: () => void;
  doneLabel: string;
}) {
  const tokens = useMemo(() => tokenize(content), [content]);
  const sentences = useMemo(() => splitSentences(tokens), [tokens]);
  const [index, setIndex] = useState(0); // aktif cümle
  const [word, setWord] = useState(-1); // aktif cümledeki kelime
  const [playing, setPlaying] = useState(false);
  const [waitingEcho, setWaitingEcho] = useState(false);
  const [finished, setFinished] = useState(false);
  const rate = useRef(initialRate(desiredWpm));
  const cancelRef = useRef<(() => void) | null>(null);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(
    (i: number) => {
      cancelRef.current?.();
      if (i >= sentences.length) {
        setPlaying(false);
        setFinished(true);
        setWord(-1);
        return;
      }
      const s = sentences[i];
      setIndex(i);
      setWord(0);
      setPlaying(true);
      setWaitingEcho(false);
      const words = s.tokens.map((t) => tokens[t].text);
      cancelRef.current = speakSentence(s, words, {
        voice,
        rate: rate.current,
        volume,
        expectedMs: (words.length / desiredWpm) * 60000,
        onWord: setWord,
        onEnd: (elapsed) => {
          rate.current = calibrateRate(rate.current, words.length, elapsed, desiredWpm);
          cancelRef.current = null;
          if (echo) {
            setPlaying(false);
            setWaitingEcho(true);
            setWord(-1);
          } else {
            // Ses doğal hızda kalır; hedef tempoya uymak için cümleler arasında duraklama eklenir.
            const t = window.setTimeout(() => play(i + 1), sentencePause(words.length, elapsed, desiredWpm));
            cancelRef.current = () => clearTimeout(t);
          }
        },
      });
    },
    [sentences, tokens, voice, volume, desiredWpm, echo],
  );

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [index]);

  const paragraphs = useMemo(() => {
    const out: number[][] = [];
    sentences.forEach((s, si) => (out[tokens[s.tokens[0]].paragraph] ??= []).push(si));
    return out;
  }, [sentences, tokens]);

  const started = playing || waitingEcho || index > 0 || finished;

  return (
    <div>
      <div className="sticky top-[68px] z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-paper/90 px-4 py-2 backdrop-blur">
        <ProgressBar value={((finished ? sentences.length : index) / sentences.length) * 100} className="min-w-24 flex-1" />
        {!finished && (
          playing ? (
            <Button size="sm" variant="secondary" onClick={stop}><Pause className="size-4" /> Duraklat</Button>
          ) : (
            <Button size="sm" onClick={() => play(waitingEcho ? index + 1 : index)}>
              <Play className="size-4 fill-white" /> {started ? "Devam" : "Dinle"}
            </Button>
          )
        )}
        {started && (
          <Button size="sm" variant="ghost" onClick={() => play(index)} aria-label="Cümleyi tekrar dinle">
            <Repeat className="size-4" /> Tekrar
          </Button>
        )}
        {finished && (
          <Button size="sm" variant="ghost" onClick={() => { setFinished(false); play(0); }}>
            <RotateCcw className="size-4" /> Baştan
          </Button>
        )}
      </div>

      <article className="rounded-3xl bg-white p-6 font-read text-[1.35rem] leading-[2.1] tracking-wide text-ink shadow-[0_6px_24px_rgba(15,81,75,0.08)] sm:p-8 sm:text-[1.5rem]">
        {paragraphs.map((sis, p) => (
          <p key={p} className="mb-5 last:mb-0">
            {sis.map((si) => {
              const s = sentences[si];
              const current = si === index && (playing || waitingEcho);
              return (
                <span key={si}>
                  <span
                    ref={si === index ? activeRef : undefined}
                    onClick={() => play(si)}
                    className={`cursor-pointer rounded-lg transition-colors ${current ? "bg-brand-50" : si < index || finished ? "text-ink/60" : ""}`}
                    title="Bu cümleyi dinle"
                  >
                    {s.tokens.map((t, k) => (
                      <span key={t}>
                        <span className={`rounded-md px-0.5 ${current && k === word ? "bg-sun-300 text-ink" : ""}`}>{tokens[t].text}</span>
                        {k < s.tokens.length - 1 ? " " : ""}
                      </span>
                    ))}
                  </span>{" "}
                </span>
              );
            })}
          </p>
        ))}
      </article>

      {waitingEcho && (
        <div className="animate-pop sticky bottom-4 z-10 mx-auto mt-4 flex max-w-md flex-col items-center gap-3 rounded-3xl border-3 border-grape-500 bg-white p-4 text-center shadow-xl">
          <p className="text-lg font-black text-grape-700">Şimdi sen oku: bu cümleyi sesli tekrar et.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => play(index)}><Repeat className="size-4" /> Bir daha dinle</Button>
            <Button onClick={() => play(index + 1)}>
              Tekrarladım <SkipForward className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {finished && (
        <div className="mt-6 flex justify-center">
          <Button size="lg" onClick={onDone}>{doneLabel}</Button>
        </div>
      )}
    </div>
  );
}
