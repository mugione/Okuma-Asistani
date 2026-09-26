import { Lock } from "lucide-react";
import { api } from "../api/client";
import { AchievementIcon } from "../components/icons";
import { Layout } from "../components/Layout";
import { ErrorBox, PageTitle, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";

export function Achievements() {
  const { child } = useApp();
  const { data, error, loading } = useAsync(() => api.achievements(child!.id), [child?.id]);
  const earned = data?.filter((a) => a.earned_at).length ?? 0;
  return (
    <Layout back="/">
      <PageTitle sub={data ? `${earned} / ${data.length} rozet kazandın` : undefined}>Rozetlerim</PageTitle>
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data?.map((a) => (
          <div
            key={a.id}
            className={`flex flex-col items-center gap-2 rounded-3xl p-5 text-center ${a.earned_at ? "bg-white shadow-[0_6px_24px_rgba(15,81,75,0.08)]" : "bg-ink/5"}`}
          >
            <div className={`relative grid size-16 place-items-center rounded-2xl ${a.earned_at ? "bg-sun-100 text-sun-700" : "bg-ink/5 text-ink/25"}`}>
              <AchievementIcon name={a.icon} className="size-9" />
              {!a.earned_at && <Lock className="absolute -right-1 -bottom-1 size-5 rounded-full bg-white p-0.5 text-ink/40" aria-label="Kilitli" />}
            </div>
            <p className={`font-black ${a.earned_at ? "" : "text-ink/50"}`}>{a.title}</p>
            <p className="text-sm font-semibold text-ink/50">{a.description}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
