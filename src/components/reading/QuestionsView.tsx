import { useState } from "react";
import type { PublicQuestion } from "../../../shared/api-types";
import { Button, Card, ProgressBar } from "../ui";

export function QuestionsView({
  questions,
  onSubmit,
  loading,
}: {
  questions: PublicQuestion[];
  onSubmit: (answers: { questionId: number; selectedOption: string }[]) => void;
  loading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const q = questions[index];
  const selected = answers[q.id];
  const last = index === questions.length - 1;

  return (
    <div className="animate-fade-up mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-extrabold text-ink/60">Soru {index + 1} / {questions.length}</span>
        <ProgressBar value={((index + (selected ? 1 : 0)) / questions.length) * 100} color="bg-grape-500" className="flex-1" />
      </div>
      <Card>
        <h2 className="text-2xl font-black leading-snug">{q.question}</h2>
        <div className="mt-5 flex flex-col gap-3" role="radiogroup">
          {q.options.map((o) => (
            <button
              key={o.key}
              role="radio"
              aria-checked={selected === o.key}
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
              className={`flex items-center gap-3 rounded-2xl border-3 p-4 text-left text-lg font-bold transition ${
                selected === o.key ? "border-grape-500 bg-grape-100" : "border-ink/10 bg-white hover:border-grape-500/40"
              }`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-base font-black uppercase ${selected === o.key ? "bg-grape-500 text-white" : "bg-ink/5 text-ink/60"}`}>
                {o.key}
              </span>
              {o.text}
            </button>
          ))}
        </div>
      </Card>
      <div className="mt-5 flex justify-between gap-3">
        <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Önceki</Button>
        {last ? (
          <Button
            disabled={Object.keys(answers).length < questions.length}
            loading={loading}
            onClick={() => onSubmit(questions.map((qq) => ({ questionId: qq.id, selectedOption: answers[qq.id] })))}
          >
            Cevapları Gönder
          </Button>
        ) : (
          <Button disabled={!selected} onClick={() => setIndex((i) => i + 1)}>Sonraki</Button>
        )}
      </div>
    </div>
  );
}
