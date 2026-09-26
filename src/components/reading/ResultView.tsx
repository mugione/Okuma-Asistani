import { CheckCircle2, Gauge, Brain, Target, TrendingUp, XCircle, Sparkles } from "lucide-react";
import type { FinishReadingResult, PublicQuestion, SubmitAnswersResult } from "../../../shared/api-types";
import { Card, Stars } from "../ui";

function comprehensionMessage(c: number): { title: string; body: string } {
  if (c >= 90) return { title: "Harika anladın!", body: "Hem akıcı hem dikkatli okudun." };
  if (c >= 80) return { title: "Çok iyi!", body: "Okuduğunu gayet iyi anladın." };
  if (c >= 70) return { title: "Güzel!", body: "Bir dahaki sefere ayrıntılara biraz daha dikkat edelim." };
  return { title: "Hızdan önce anlamak önemli", body: "Bir dahaki sefere biraz daha yavaş ve dikkatli okuyabilirsin." };
}

export function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl p-3 text-center ${tone}`}>
      {icon}
      <span className="mt-1 text-2xl font-black tabular-nums">{value}</span>
      <span className="text-xs font-extrabold uppercase tracking-wide opacity-70">{label}</span>
    </div>
  );
}

export function AttemptBars({ attempts }: { attempts: FinishReadingResult["attempts"] }) {
  if (attempts.length < 2) return null;
  const max = Math.max(...attempts.map((a) => a.wpm));
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/50">Tekrarlı okuma</p>
      <div className="flex flex-col gap-2">
        {attempts.map((a) => (
          <div key={a.attempt_number} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm font-bold text-ink/60">{a.attempt_number}. okuma</span>
            <div className="h-8 flex-1 overflow-hidden rounded-xl bg-ink/5">
              <div
                className="flex h-full items-center justify-end rounded-xl bg-brand-400 pr-2 text-sm font-black text-white transition-all duration-700"
                style={{ width: `${Math.max(18, (a.wpm / max) * 100)}%` }}
              >
                {Math.round(a.wpm)} kelime/dk
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultView({
  finish,
  answers,
  questions,
}: {
  finish: FinishReadingResult;
  answers: SubmitAnswersResult | null;
  questions: PublicQuestion[];
}) {
  const xp = finish.xpEarned + (answers?.xpEarned ?? 0);
  const targetChanged = answers && answers.newTargetWpm !== answers.previousTargetWpm;
  return (
    <div className="animate-fade-up mx-auto flex max-w-xl flex-col gap-4">
      <Card className="text-center">
        {answers ? (
          <div className="flex justify-center"><Stars count={answers.stars} size={52} /></div>
        ) : (
          <Sparkles className="mx-auto size-12 text-sun-500" aria-hidden />
        )}
        <h2 className="mt-3 text-3xl font-black">
          {answers ? comprehensionMessage(answers.comprehension).title : "Okumayı tamamladın!"}
        </h2>
        {answers && <p className="mt-1 font-semibold text-ink/60">{comprehensionMessage(answers.comprehension).body}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {answers && (
            <Metric icon={<Brain className="size-6" />} label="Anlama" value={`%${Math.round(answers.comprehension)}`} tone="bg-grape-100 text-grape-700" />
          )}
          <Metric
            icon={<Target className="size-6" />}
            label="Doğruluk"
            value={finish.accuracy === null ? "—" : `%${Math.round(finish.accuracy)}`}
            tone="bg-brand-50 text-brand-700"
          />
          <Metric icon={<Gauge className="size-6" />} label="Kelime/dk" value={String(Math.round(finish.wpm))} tone="bg-sun-100 text-sun-700" />
          <Metric icon={<Sparkles className="size-6" />} label="XP" value={`+${xp}`} tone="bg-coral-100 text-coral-700" />
        </div>

        {finish.improvementPercent !== null && (
          <p className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-brand-50 p-3 text-lg font-extrabold text-brand-700">
            <TrendingUp className="size-6" aria-hidden />
            {finish.improvementPercent > 0
              ? `İlk okumaya göre %${finish.improvementPercent} daha akıcı okudun.`
              : "Tekrar okumak anlamayı güçlendirir. Harika çalışma!"}
          </p>
        )}
        <AttemptBars attempts={finish.attempts} />
        {targetChanged && (
          <p className="mt-4 text-base font-bold text-ink/70">
            {answers.newTargetWpm > answers.previousTargetWpm ? "Yeni hedefin yükseldi: " : "Yeni hedefin: "}
            <span className="text-brand-700">{answers.newTargetWpm} kelime/dk</span>
          </p>
        )}
      </Card>

      {answers && (
        <Card>
          <h3 className="mb-3 text-lg font-black">Cevapların</h3>
          <ul className="flex flex-col gap-3">
            {answers.results.map((r) => {
              const q = questions.find((x) => x.id === r.questionId);
              const correctText = q?.options.find((o) => o.key === r.correctOption)?.text;
              return (
                <li key={r.questionId} className="flex gap-3">
                  {r.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-500" aria-label="Doğru" />
                  ) : (
                    <XCircle className="mt-0.5 size-6 shrink-0 text-coral-500" aria-label="Yanlış" />
                  )}
                  <div>
                    <p className="font-bold">{q?.question}</p>
                    {!r.isCorrect && <p className="text-sm font-semibold text-ink/60">Doğru cevap: {correctText}</p>}
                    {r.explanation && !r.isCorrect && <p className="text-sm text-ink/60">{r.explanation}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
