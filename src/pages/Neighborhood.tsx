import { Crown, EyeOff, KeyRound, MapPinHouse } from "lucide-react";
import { useState } from "react";
import type { LeaderboardPeriod } from "../../shared/api-types";
import { api } from "../api/client";
import { Avatar } from "../components/Avatar";
import { Layout } from "../components/Layout";
import { Card, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { Link } from "../lib/router";

const PERIODS: { id: LeaderboardPeriod; label: string; sub: string }[] = [
  { id: "day", label: "Günlük", sub: "Bugün kazanılan XP" },
  { id: "week", label: "Haftalık", sub: "Bu hafta (pazartesiden beri) kazanılan XP" },
  { id: "year", label: "Yıllık", sub: "Bu yıl kazanılan XP" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

/** Mahalle: kayıtlı okurların seçilen dönemde kazandığı XP'ye göre ilk 10. */
export function Neighborhood() {
  const { child } = useApp();
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const { data, error, loading, reload } = useAsync(() => api.leaderboard(period, child?.id), [period, child?.id]);
  const current = PERIODS.find((p) => p.id === period)!;
  const meInTop = data?.top.some((e) => e.isMe);

  return (
    <Layout back="/">
      <PageTitle sub="Okudukça XP kazan, mahallenin okurları arasında yerini gör!">
        <span className="inline-flex items-center gap-2"><MapPinHouse className="size-9 text-brand-600" aria-hidden /> Mahalle</span>
      </PageTitle>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm" role="tablist" aria-label="Dönem">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-xl py-2.5 font-extrabold transition ${period === p.id ? "bg-brand-500 text-white" : "text-ink/60 hover:bg-brand-50"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm font-bold text-ink/50">{current.sub}{data ? ` · ${data.participants} okur` : ""}</p>

      {loading && !data && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}

      {data && (
        <>
          {data.top.length === 0 ? (
            <Card className="text-center">
              <Crown className="mx-auto size-10 text-sun-500" aria-hidden />
              <p className="mt-2 text-lg font-black">Bu dönemde henüz kimse XP kazanmadı.</p>
              <p className="font-semibold text-ink/55">İlk sırayı sen al: bir metin oku ya da oyun oyna!</p>
            </Card>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.top.map((e, i) => (
                <li
                  key={i}
                  className={`animate-fade-up flex items-center gap-3 rounded-2xl p-3 ${
                    e.isMe ? "border-3 border-brand-400 bg-brand-50" : e.rank <= 3 ? "bg-sun-100" : "bg-white shadow-sm"
                  }`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="w-9 text-center text-2xl font-black tabular-nums text-ink/60">{e.rank <= 3 ? MEDALS[e.rank - 1] : e.rank}</span>
                  <Avatar id={e.avatar} size={44} />
                  <span className="min-w-0 flex-1 truncate text-lg font-black">
                    {e.name}
                    {e.isMe && <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-xs text-white">Sen</span>}
                  </span>
                  <span className="text-lg font-black tabular-nums text-sun-700">{e.xp} XP</span>
                </li>
              ))}
            </ol>
          )}

          {data.me && !meInTop && (
            <div className="mt-4">
              {data.me.eligible ? (
                <Card className="flex items-center gap-3 !p-3">
                  <span className="w-9 text-center text-xl font-black tabular-nums text-ink/60">{data.me.rank ?? "–"}</span>
                  {child && <Avatar id={child.avatar} size={44} />}
                  <span className="flex-1 font-black">
                    Sen {data.me.rank ? `${data.me.rank}. sıradasın` : "bu dönemde henüz XP kazanmadın"}
                  </span>
                  <span className="font-black tabular-nums text-sun-700">{data.me.xp} XP</span>
                </Card>
              ) : data.me.reason === "no_account" ? (
                <Card className="flex items-center gap-3 !bg-sun-100 !p-4 text-sun-700">
                  <KeyRound className="size-6 shrink-0" aria-hidden />
                  <p className="font-bold">
                    Sıralamada görünmek için bir büyüğün <Link to="/ebeveyn" className="underline">ebeveyn panelinden</Link> kullanıcı adı ve şifre belirlemesi gerekiyor.
                  </p>
                </Card>
              ) : (
                <Card className="flex items-center gap-3 !p-4 text-ink/60">
                  <EyeOff className="size-6 shrink-0" aria-hidden />
                  <p className="font-bold">Sıralamada görünmüyorsun. Bu ayar ebeveyn panelinden değiştirilebilir.</p>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
