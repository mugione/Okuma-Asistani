import { Blocks, Eye, Link2, ListChecks, MessageSquareText, PuzzleIcon } from "lucide-react";
import { api } from "../api/client";
import { MissingWord } from "../components/games/MissingWord";
import { SentenceRecall } from "../components/games/SentenceRecall";
import { SentenceVerify } from "../components/games/SentenceVerify";
import { Syllables } from "../components/games/Syllables";
import { WordCatch } from "../components/games/WordCatch";
import { WordChain } from "../components/games/WordChain";
import { Layout } from "../components/Layout";
import { PageTitle, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { Link, useRouter } from "../lib/router";

const GAMES = [
  { slug: "dogru-mu-yanlis-mi", title: "Doğru mu Yanlış mı?", sub: "90 saniyede hızlı ve anlayarak oku", icon: <ListChecks className="size-10" />, tone: "bg-sun-100 text-sun-700", badge: "Yeni" },
  { slug: "kelime-zinciri", title: "Kelime Zinciri", sub: "Yapışık kelimeleri ayır", icon: <Link2 className="size-10" />, tone: "bg-brand-100 text-brand-800", badge: "Yeni" },
  { slug: "heceleri-birlestir", title: "Heceleri Birleştir", sub: "Heceleri sıraya diz", icon: <Blocks className="size-10" />, tone: "bg-grape-100 text-grape-700", badge: "Yeni" },
  { slug: "kelimeyi-yakala", title: "Kelimeyi Yakala", sub: "Kısa süre görünen kelimeyi bul", icon: <Eye className="size-10" />, tone: "bg-brand-50 text-brand-700" },
  { slug: "cumleyi-hatirla", title: "Cümleyi Hatırla", sub: "Cümleyi oku, ayrıntıyı hatırla", icon: <MessageSquareText className="size-10" />, tone: "bg-grape-100 text-grape-700" },
  { slug: "eksik-kelime", title: "Eksik Kelime", sub: "Boşluğa uygun kelimeyi seç", icon: <PuzzleIcon className="size-10" />, tone: "bg-coral-100 text-coral-700" },
];

export function GamesHub() {
  return (
    <Layout back="/">
      <PageTitle sub="Kelimeleri daha hızlı tanı, daha akıcı oku.">Kelime Oyunları</PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link key={g.slug} to={`/oyunlar/${g.slug}`} className={`relative flex items-center gap-5 rounded-3xl p-5 transition hover:-translate-y-0.5 ${g.tone}`}>
            {g.icon}
            <span>
              <span className="block text-xl font-black">{g.title}</span>
              <span className="block text-sm font-bold opacity-75">{g.sub}</span>
            </span>
            {g.badge && <span className="absolute -top-2 -right-1 rounded-full bg-coral-500 px-2.5 py-0.5 text-xs font-black text-white">{g.badge}</span>}
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
  const level = child?.current_level ?? 2;

  return (
    <Layout back="/oyunlar">
      {today.loading && <Spinner />}
      {today.data && slug === "kelimeyi-yakala" && <WordCatch initialDisplayMs={today.data.wordCatchDisplayMs} onDone={back} />}
      {today.data && slug === "cumleyi-hatirla" && <SentenceRecall targetWpm={today.data.targets.wpm} onDone={back} />}
      {today.data && slug === "eksik-kelime" && <MissingWord onDone={back} />}
      {today.data && slug === "dogru-mu-yanlis-mi" && <SentenceVerify level={level} onDone={back} />}
      {today.data && slug === "kelime-zinciri" && <WordChain level={level} onDone={back} />}
      {today.data && slug === "heceleri-birlestir" && <Syllables level={level} onDone={back} />}
    </Layout>
  );
}
