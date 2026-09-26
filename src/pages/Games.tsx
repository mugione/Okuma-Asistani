import { Eye, MessageSquareText, PuzzleIcon } from "lucide-react";
import { api } from "../api/client";
import { MissingWord } from "../components/games/MissingWord";
import { SentenceRecall } from "../components/games/SentenceRecall";
import { WordCatch } from "../components/games/WordCatch";
import { Layout } from "../components/Layout";
import { PageTitle, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { Link, useRouter } from "../lib/router";

const GAMES = [
  { slug: "kelimeyi-yakala", title: "Kelimeyi Yakala", sub: "Kısa süre görünen kelimeyi bul", icon: <Eye className="size-10" />, tone: "bg-brand-50 text-brand-700" },
  { slug: "cumleyi-hatirla", title: "Cümleyi Hatırla", sub: "Cümleyi oku, ayrıntıyı hatırla", icon: <MessageSquareText className="size-10" />, tone: "bg-grape-100 text-grape-700" },
  { slug: "eksik-kelime", title: "Eksik Kelime", sub: "Boşluğa uygun kelimeyi seç", icon: <PuzzleIcon className="size-10" />, tone: "bg-coral-100 text-coral-700" },
];

export function GamesHub() {
  return (
    <Layout back="/">
      <PageTitle sub="Gözünü ve dikkatini çalıştır.">Kelime Oyunları</PageTitle>
      <div className="grid gap-4">
        {GAMES.map((g) => (
          <Link key={g.slug} to={`/oyunlar/${g.slug}`} className={`flex items-center gap-5 rounded-3xl p-6 transition hover:-translate-y-0.5 ${g.tone}`}>
            {g.icon}
            <span>
              <span className="block text-2xl font-black">{g.title}</span>
              <span className="block font-bold opacity-75">{g.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </Layout>
  );
}

export function GamePage({ slug }: { slug: string }) {
  const { child } = useApp();
  const { navigate } = useRouter();
  const today = useAsync(() => api.today(child!.id), [child?.id]);
  const back = () => navigate("/oyunlar");

  return (
    <Layout back="/oyunlar">
      {today.loading && <Spinner />}
      {today.data && slug === "kelimeyi-yakala" && <WordCatch initialDisplayMs={today.data.wordCatchDisplayMs} onDone={back} />}
      {today.data && slug === "cumleyi-hatirla" && <SentenceRecall targetWpm={today.data.targets.wpm} onDone={back} />}
      {today.data && slug === "eksik-kelime" && <MissingWord onDone={back} />}
    </Layout>
  );
}
