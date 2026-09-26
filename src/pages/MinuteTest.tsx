import { AlarmClock, Check, Flag, Play, RotateCcw, Timer, Trophy, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MinuteTestResult, MinuteTestStart } from "../../shared/api-types";
import { tokenize } from "../../shared/pacing";
import { api, ApiRequestError } from "../api/client";
import { Layout } from "../components/Layout";
import { AccuracyInput } from "../components/reading/AccuracyInput";
import { Metric } from "../components/reading/ResultView";
import { Button, Card, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { playAlarm, unlockAudio } from "../lib/alarm";
import { useApp, useAsync } from "../lib/app-state";
import { useRouter } from "../lib/router";

type Stage = "intro" | "starting" | "countdown" | "reading" | "select" | "accuracy" | "saving" | "result";

/**
 * 1 Dakika Okuma Testi (sözlü okuma akıcılığı ölçümü, ORF benzeri):
 * çocuk 60 saniye boyunca sesli okur; süre dolunca uyarı çalar ve çocuk son okuduğu kelimeye
 * dokunur. Metni önce bitirirse süre kendiliğinden durur. Sonuç backend'de hesaplanır.
 */
export function MinuteTest() {
  const { child, refresh, celebrate } = useApp();
  const { navigate } = useRouter();
  const history = useAsync(() => api.minuteHistory(child!.id), [child?.id]);
  const [stage, setStage] = useState<Stage>("intro");
  const [test, setTest] = useState<MinuteTestStart | null>(null);
  const [count, setCount] = useState(3);
  const [remaining, setRemaining] = useState(60);
  const [lastWord, setLastWord] = useState<number | null>(null);
  const [finishedText, setFinishedText] = useState(false);
  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<MinuteTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);

  const tokens = useMemo(() => (test ? tokenize(test.text.content) : []), [test]);
  const paragraphs = useMemo(() => {
    const out: number[][] = [];
    tokens.forEach((t, i) => (out[t.paragraph] ??= []).push(i));
    return out;
  }, [tokens]);

  const begin = async () => {
    if (!child) return;
    unlockAudio();
    setError(null);
    setResult(null);
    setLastWord(null);
    setFinishedText(false);
    setStage("starting");
    try {
      const t = await api.startMinuteTest(child.id);
      setTest(t);
      setRemaining(t.seconds);
      setCount(3);
      setStage("countdown");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test başlatılamadı.");
      setStage("intro");
    }
  };

  // 3-2-1 geri sayım.
  useEffect(() => {
    if (stage !== "countdown") return;
    if (count === 0) {
      startedAt.current = performance.now();
      setStage("reading");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [stage, count]);

  // 60 saniyelik süre.
  useEffect(() => {
    if (stage !== "reading" || !test) return;
    const id = setInterval(() => {
      const elapsed = (performance.now() - startedAt.current) / 1000;
      const left = Math.max(0, test.seconds - elapsed);
      setRemaining(Math.ceil(left));
      if (left <= 0) {
        clearInterval(id);
        setDuration(test.seconds);
        playAlarm();
        setStage("select");
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage, test]);

  const finishEarly = () => {
    setDuration(Math.max(1, Math.round((performance.now() - startedAt.current) / 100) / 10));
    setFinishedText(true);
    setLastWord(tokens.length - 1);
    setStage("accuracy");
  };

  const submit = async (errorCount: number | null) => {
    if (!test || lastWord === null) return;
    setStage("saving");
    setError(null);
    try {
      const r = await api.finishMinuteTest(test.testId, {
        durationSeconds: duration,
        wordsRead: lastWord + 1,
        errorCount,
        finishedText,
      });
      setResult(r);
      celebrate(r.newAchievements);
      void refresh();
      history.reload();
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
      // Yanlış kelime seçildiyse yeniden seçtir; diğer hatalarda baştan başlat.
      setStage(e instanceof ApiRequestError && e.code === "UNREALISTIC_SPEED" && !finishedText ? "select" : "intro");
    }
  };

  const label = result?.accuracy !== null && result?.accuracy !== undefined ? "doğru kelime/dk" : "kelime/dk";

  return (
    <Layout back="/">
      {stage === "intro" && (
        <>
          <PageTitle sub="Bir dakikada kaç kelime okuyabildiğini ölçelim.">1 Dakika Okuma Testi</PageTitle>
          {error && <div className="mb-4"><ErrorBox message={error} /></div>}
          <Card className="animate-fade-up">
            <ul className="flex flex-col gap-3 text-lg font-bold text-ink/75">
              <li className="flex gap-3"><Timer className="size-6 shrink-0 text-brand-600" /> 60 saniyen var. Metni <b>sesli</b> ve dikkatlice oku.</li>
              <li className="flex gap-3"><AlarmClock className="size-6 shrink-0 text-coral-500" /> Süre dolunca bir ses duyacaksın. Son okuduğun kelimeye dokun.</li>
              <li className="flex gap-3"><Flag className="size-6 shrink-0 text-grape-500" /> Süre dolmadan bitirirsen <b>Bitirdim</b>'e bas.</li>
            </ul>
            <p className="mt-4 rounded-2xl bg-sun-100 p-3 text-sm font-semibold text-sun-700">
              İpucu: Hızlı okumak için acele etme. Doğru ve anlayarak okumak daha önemli. Bir büyüğün dinlerse hatalarını da sayabilir.
            </p>
            <Button size="lg" className="mt-5 w-full" onClick={begin}>
              <Play className="size-6 fill-white" /> Teste Başla
            </Button>
          </Card>
          <HistoryCard history={history.data} />
        </>
      )}

      {stage === "starting" && <Spinner label="Metin hazırlanıyor…" />}

      {stage === "countdown" && (
        <div className="grid min-h-[50vh] place-items-center">
          <div key={count} className="animate-pop text-center">
            <p className="text-9xl font-black text-brand-600 tabular-nums">{count || "Başla!"}</p>
            <p className="mt-2 text-lg font-bold text-ink/50">{test?.text.title}</p>
          </div>
        </div>
      )}

      {(stage === "reading" || stage === "select") && test && (
        <div>
          <div className="sticky top-[68px] z-10 -mx-4 mb-4 flex items-center gap-3 bg-paper/90 px-4 py-2 backdrop-blur">
            {stage === "reading" ? (
              <>
                <TimerRing remaining={remaining} total={test.seconds} />
                <p className="flex-1 font-black">{test.text.title}</p>
                <Button variant="sun" onClick={finishEarly}><Check className="size-5" /> Bitirdim</Button>
              </>
            ) : (
              <div className="animate-pop flex w-full flex-wrap items-center gap-3 rounded-2xl bg-coral-100 p-3 text-coral-700" role="alert">
                <AlarmClock className="size-7 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 font-black">Süre doldu! En son okuduğun kelimeye dokun.</p>
                <Button disabled={lastWord === null} onClick={() => setStage("accuracy")}>Onayla</Button>
              </div>
            )}
          </div>
          {error && stage === "select" && <div className="mb-3"><ErrorBox message={error} /></div>}
          <article className="rounded-3xl bg-white p-6 font-read text-[1.35rem] leading-[2.1] tracking-wide shadow-[0_6px_24px_rgba(15,81,75,0.08)] sm:p-8 sm:text-[1.5rem]">
            {paragraphs.map((idxs, p) => (
              <p key={p} className="mb-5 last:mb-0">
                {idxs.map((i) =>
                  stage === "select" ? (
                    <span key={i}>
                      <button
                        onClick={() => setLastWord(i)}
                        className={`rounded-lg px-0.5 transition ${
                          lastWord === i
                            ? "bg-coral-500 text-white"
                            : lastWord !== null && i < lastWord
                              ? "bg-brand-100"
                              : "hover:bg-sun-300"
                        }`}
                      >
                        {tokens[i].text}
                      </button>{" "}
                    </span>
                  ) : (
                    <span key={i}>{tokens[i].text} </span>
                  ),
                )}
              </p>
            ))}
          </article>
        </div>
      )}

      {stage === "accuracy" && <AccuracyInput onSubmit={submit} loading={false} />}
      {stage === "saving" && <Spinner label="Hesaplanıyor…" />}

      {stage === "result" && result && (
        <div className="animate-fade-up mx-auto flex max-w-xl flex-col gap-4">
          <Card className="text-center">
            {result.isRecord ? (
              <p className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full bg-sun-400 px-4 py-1.5 font-black">
                <Trophy className="size-5" aria-hidden /> Yeni rekor!
              </p>
            ) : null}
            <p className="text-7xl font-black text-brand-600 tabular-nums">{Math.round(result.wcpm)}</p>
            <p className="text-lg font-extrabold text-ink/55">{label}</p>
            <p className="mt-2 font-semibold text-ink/60">
              {result.finishedText
                ? `Metnin tamamını ${Math.round(result.durationSeconds)} saniyede bitirdin!`
                : `1 dakikada ${result.wordsRead} kelime okudun.`}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Metric icon={<Trophy className="size-6" />} label="En iyi" value={String(Math.round(Math.max(result.wcpm, result.previousBest ?? 0)))} tone="bg-sun-100 text-sun-700" />
              <Metric
                icon={<TrendingUp className="size-6" />}
                label="Önceki"
                value={result.previous === null ? "—" : String(Math.round(result.previous))}
                tone="bg-grape-100 text-grape-700"
              />
              <Metric icon={<Check className="size-6" />} label="XP" value={`+${result.xpEarned}`} tone="bg-coral-100 text-coral-700" />
            </div>
            {result.previous !== null && (
              <p className="mt-4 font-bold text-ink/65">
                {result.wcpm > result.previous
                  ? `Önceki testine göre ${Math.round(result.wcpm - result.previous)} kelime daha fazla!`
                  : "Her gün biraz okumak hızını artırır. Devam!"}
              </p>
            )}
          </Card>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => setStage("intro")}><RotateCcw className="size-5" /> Tekrar</Button>
            <Button className="flex-1" size="lg" onClick={() => navigate("/")}>Ana Sayfa</Button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const low = remaining <= 10;
  return (
    <div className="relative size-14 shrink-0" role="timer" aria-label={`${remaining} saniye kaldı`}>
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(31,42,55,0.1)" strokeWidth={6} />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          stroke={low ? "var(--color-coral-500)" : "var(--color-brand-500)"}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - remaining / total)}
          className="transition-[stroke-dashoffset] duration-100"
        />
      </svg>
      <span className={`absolute inset-0 grid place-items-center text-lg font-black tabular-nums ${low ? "text-coral-700" : "text-ink"}`}>{remaining}</span>
    </div>
  );
}

function HistoryCard({ history }: { history: import("../../shared/api-types").MinuteTestHistory | null }) {
  if (!history || history.count === 0) return null;
  const items = history.items.slice(0, 8).reverse();
  const max = Math.max(...items.map((i) => i.wcpm), 1);
  return (
    <Card className="mt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-black">Sonuçlarım</h2>
        <p className="font-bold text-ink/55">
          En iyi: <span className="text-brand-700">{Math.round(history.best ?? 0)}</span> · {history.count} test
        </p>
      </div>
      <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label="Son 1 dakika testi sonuçları">
        {items.map((i) => (
          <div key={i.id} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-black tabular-nums text-ink/70">{Math.round(i.wcpm)}</span>
            <div
              className={`w-full rounded-t-lg ${i.is_record ? "bg-sun-400" : "bg-brand-300"}`}
              style={{ height: `${Math.max(8, (i.wcpm / max) * 96)}px` }}
              title={`${i.title}: ${Math.round(i.wcpm)}`}
            />
            <span className="text-[10px] font-bold text-ink/45">
              {new Date(i.completed_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
