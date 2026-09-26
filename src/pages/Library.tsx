import { BookCheck, CheckCircle2, Clock, FileText, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateStars } from "../../shared/reading";
import { api } from "../api/client";
import { Layout } from "../components/Layout";
import { Card, ErrorBox, PageTitle, ProgressBar, Spinner, Stars } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { Link } from "../lib/router";

const CATEGORY_TONES: Record<string, string> = {
  Uzay: "bg-grape-100 text-grape-700",
  Hayvanlar: "bg-sun-100 text-sun-700",
  Bilim: "bg-brand-50 text-brand-700",
  Doğa: "bg-brand-100 text-brand-800",
  Macera: "bg-coral-100 text-coral-700",
  Spor: "bg-coral-100 text-coral-700",
  Teknoloji: "bg-grape-100 text-grape-700",
  "Günlük Yaşam": "bg-sun-100 text-sun-700",
  Tarih: "bg-sun-100 text-sun-700",
  Keşif: "bg-brand-50 text-brand-700",
};

type Status = "all" | "unread" | "read";

export function Difficulty({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Zorluk ${level}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < level ? "bg-coral-500" : "bg-ink/10"}`} />
      ))}
    </span>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-2 font-extrabold transition ${active ? "bg-brand-500 text-white" : "bg-white text-ink/70 hover:bg-brand-50"}`}
    >
      {children}
    </button>
  );
}

export function Library() {
  const { child } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.texts(), []);
  const history = useAsync(() => api.readingHistory(child!.id), [child?.id]);
  const [category, setCategory] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("all");

  const read = useMemo(() => new Map((history.data ?? []).map((h) => [h.text_id, h])), [history.data]);
  const categories = useMemo(() => [...new Set((data ?? []).map((t) => t.category))].sort((a, b) => a.localeCompare(b, "tr")), [data]);
  const list = (data ?? []).filter(
    (t) =>
      (!category || t.category === category) &&
      (!difficulty || t.difficulty === difficulty) &&
      (status === "all" || (status === "read") === read.has(t.id)),
  );
  const readCount = (data ?? []).filter((t) => read.has(t.id)).length;

  return (
    <Layout back="/">
      <PageTitle sub="Bir metin seç ve okumaya başla.">Kütüphane</PageTitle>
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <>
          <Card className="mb-4 flex items-center gap-4 !p-4">
            <BookCheck className="size-8 shrink-0 text-brand-600" aria-hidden />
            <div className="flex-1">
              <p className="font-black">
                {readCount} / {data.length} metin okundu
              </p>
              <ProgressBar value={(readCount / data.length) * 100} className="mt-1.5" />
            </div>
          </Card>

          <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Okuma durumu">
            <Chip active={status === "all"} onClick={() => setStatus("all")}>Hepsi</Chip>
            <Chip active={status === "unread"} onClick={() => setStatus("unread")}>
              <Sparkles className="mr-1 inline size-4" aria-hidden />Yeni
            </Chip>
            <Chip active={status === "read"} onClick={() => setStatus("read")}>
              <CheckCircle2 className="mr-1 inline size-4" aria-hidden />Okuduklarım
            </Chip>
            <span className="mx-1 w-px shrink-0 bg-ink/10" aria-hidden />
            {[1, 2, 3, 4, 5].map((d) => (
              <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(difficulty === d ? null : d)}>
                <span className="sr-only">Zorluk </span>
                {"●".repeat(d)}
              </Chip>
            ))}
          </div>
          <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Kategori">
            {[null, ...categories].map((c) => (
              <Chip key={c ?? "all"} active={category === c} onClick={() => setCategory(c)}>
                {c ?? "Tüm kategoriler"}
              </Chip>
            ))}
          </div>

          {list.length === 0 && <Card className="text-center font-bold text-ink/55">Bu seçimde metin yok.</Card>}
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((t) => {
              const h = read.get(t.id);
              return (
                <Link
                  key={t.id}
                  to={`/oku/${t.id}`}
                  className={`relative flex flex-col gap-2 rounded-3xl p-5 transition hover:-translate-y-0.5 ${
                    h
                      ? "border-2 border-brand-200 bg-brand-50/70"
                      : "bg-white shadow-[0_6px_24px_rgba(15,81,75,0.08)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${CATEGORY_TONES[t.category] ?? "bg-ink/5"}`}>{t.category}</span>
                    <Difficulty level={t.difficulty} />
                  </div>
                  <h2 className={`text-xl font-black ${h ? "text-brand-800" : ""}`}>{t.title}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-ink/50">
                    <span className="flex items-center gap-1"><FileText className="size-4" /> {t.word_count} kelime</span>
                    <span className="flex items-center gap-1"><Clock className="size-4" /> ~{Math.max(1, Math.round(t.estimated_duration / 60))} dk</span>
                  </div>
                  {h ? (
                    <div className="flex items-center justify-between gap-2 border-t border-brand-200/70 pt-2">
                      <span className="flex items-center gap-1.5 text-sm font-extrabold text-brand-700">
                        <CheckCircle2 className="size-4" aria-hidden />
                        {h.times_read > 1 ? `${h.times_read} kez okundu` : "Okundu"}
                      </span>
                      {h.best_comprehension !== null && <Stars count={calculateStars(h.best_comprehension, null)} size={18} />}
                    </div>
                  ) : (
                    <span className="absolute -top-2 -right-1 rounded-full bg-sun-400 px-2.5 py-0.5 text-xs font-black text-ink shadow-sm">Yeni</span>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
