import { Check, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildChunks, chunkSizeForLevel, stepDuration, tokenize, wordBaseDurations } from "../../../shared/pacing";
import type { ReadingModeName } from "../../../shared/api-types";
import { formatClock, useStopwatch } from "../../hooks/useStopwatch";
import { Button, ProgressBar } from "../ui";

interface Props {
  content: string;
  mode: ReadingModeName;
  targetWpm: number;
  level: number;
  /** Okuma bittiğinde (buton veya otomatik) saniye cinsinden süreyle çağrılır. */
  onFinish: (durationSeconds: number) => void;
  /** Sunucu "çok hızlı" dediğinde okumaya devam edebilmek için. */
  resumeSignal?: number;
}

export function ReadingView({ content, mode, targetWpm, level, onFinish, resumeSignal }: Props) {
  const tokens = useMemo(() => tokenize(content), [content]);
  const chunks = useMemo(
    () => (mode === "chunks" ? buildChunks(tokens, chunkSizeForLevel(level)) : tokens.map((_, i) => [i])),
    [mode, tokens, level],
  );
  const bases = useMemo(() => wordBaseDurations(tokens, targetWpm), [tokens, targetWpm]);
  const paced = mode === "tracking" || mode === "chunks";
  const watch = useStopwatch();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0); // aktif grup/kelime
  const finishedRef = useRef(false);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    watch.pause();
    onFinish(Math.max(1, Math.round(watch.elapsedMs() / 100) / 10));
  };

  // Sunucu reddederse okumaya kaldığı yerden devam.
  useEffect(() => {
    if (!resumeSignal) return;
    finishedRef.current = false;
    watch.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSignal]);

  // Tempolu modlarda sıradaki kelime/gruba geç.
  useEffect(() => {
    if (!paced || !watch.running) return;
    if (step >= chunks.length) {
      finish();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), stepDuration(tokens, chunks[step], bases));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paced, watch.running, step, chunks, tokens, bases]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step]);

  const begin = () => {
    setStarted(true);
    watch.start();
  };

  // Paragraf → grup indeksleri (gruplar paragraf sınırını aşmaz).
  const paragraphs = useMemo(() => {
    const out: number[][] = [];
    chunks.forEach((c, ci) => (out[tokens[c[0]].paragraph] ??= []).push(ci));
    return out;
  }, [chunks, tokens]);

  return (
    <div>
      <div className="sticky top-[68px] z-10 -mx-4 mb-4 flex items-center gap-3 bg-paper/90 px-4 py-2 backdrop-blur">
        <span className="rounded-xl bg-white px-3 py-1.5 font-mono text-lg font-bold tabular-nums shadow-sm" aria-label="Geçen süre">
          {formatClock(watch.elapsedMs())}
        </span>
        {paced && <ProgressBar value={(step / chunks.length) * 100} className="flex-1" />}
        {!paced && <span className="flex-1" />}
        {started && (
          <Button variant="secondary" size="sm" onClick={() => (watch.running ? watch.pause() : watch.start())}>
            {watch.running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {watch.running ? "Duraklat" : "Devam"}
          </Button>
        )}
      </div>

      <div className="relative">
        <article
          className={`rounded-3xl bg-white p-6 font-read text-[1.35rem] leading-[2.1] tracking-wide text-ink shadow-[0_6px_24px_rgba(15,81,75,0.08)] sm:p-8 sm:text-[1.5rem] ${
            !started ? "select-none blur-md" : ""
          } ${started && !watch.running ? "opacity-40" : ""}`}
          aria-hidden={!started}
        >
          {paragraphs.map((idxs, p) => (
            <p key={p} className="mb-5 last:mb-0">
              {idxs.map((ci) => {
                const active = paced && ci === step;
                const done = paced && ci < step;
                return (
                  <span key={ci}>
                    <span
                      ref={active ? activeRef : undefined}
                      className={`rounded-lg px-1 py-0.5 transition-colors duration-150 [box-decoration-break:clone] ${
                        active ? "bg-sun-300 text-ink" : done ? "text-ink/45" : ""
                      }`}
                    >
                      {chunks[ci].map((ti) => tokens[ti].text).join(" ")}
                    </span>{" "}
                  </span>
                );
              })}
            </p>
          ))}
        </article>
        {!started && (
          <div className="absolute inset-x-0 top-10 flex justify-center px-4">
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/90 p-6 text-center shadow-lg">
              <p className="max-w-xs text-lg font-bold text-ink/70">
                {mode === "normal" || mode === "placement"
                  ? "Hazır olduğunda başla. Kendi hızında, dikkatlice oku."
                  : `Sarı işareti takip et. Hedef hızın: ${targetWpm} kelime/dk.`}
              </p>
              <Button size="lg" onClick={begin}>
                <Play className="size-6 fill-white" /> Okumaya Başla
              </Button>
            </div>
          </div>
        )}
      </div>

      {started && (
        <div className="mt-6 flex justify-center">
          <Button size="lg" variant="sun" onClick={finish}>
            <Check className="size-6" /> Bitirdim
          </Button>
        </div>
      )}
    </div>
  );
}
