import { Award, BookOpen, Brain, Flame, Gamepad2, Gauge, Play, Star, Target, Timer, Trophy } from "lucide-react";
import { api } from "../api/client";
import { InstallCard } from "../components/InstallCard";
import { Layout } from "../components/Layout";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { Link, useRouter } from "../lib/router";

export function Home() {
  const { child } = useApp();
  const { navigate } = useRouter();
  const { data, error, loading, reload } = useAsync(() => api.today(child!.id), [child?.id, child?.xp]);

  if (!child) return null;
  return (
    <Layout>
      {loading && !data && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <div className="flex flex-col gap-5">
          <h1 className="text-4xl font-black tracking-tight">Merhaba {child.name}!</h1>

          <InstallCard dismissible />

          {!child.placement_completed ? (
            <Card className="animate-fade-up border-3 border-sun-400 !bg-sun-100">
              <h2 className="text-2xl font-black">Önce seni tanıyalım</h2>
              <p className="mt-1 font-semibold text-ink/70">
                Kısa bir metin okuyup birkaç soru cevaplayacaksın. Böylece sana en uygun hedefi belirleyeceğiz.
              </p>
              <Button size="lg" variant="primary" className="mt-4" onClick={() => navigate("/seviye-testi")}>
                <Play className="size-6 fill-white" /> Seviye Testine Başla
              </Button>
            </Card>
          ) : (
            <Card className="animate-fade-up overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-white/70">Bugünkü Antrenman</p>
                  <p className="text-4xl font-black">10 dakika</p>
                  <p className="mt-1 font-semibold text-white/80">
                    {data.today.trainingDone ? "Bugünkü antrenmanı tamamladın! İstersen tekrar yapabilirsin." : data.plan.map((p) => `${p.minutes} dk ${p.label.toLowerCase()}`).join(" · ")}
                  </p>
                </div>
                <Button size="lg" variant="sun" onClick={() => navigate("/antrenman")}>
                  <Play className="size-6 fill-ink" /> {data.today.trainingDone ? "TEKRAR" : "BAŞLA"}
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <p className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink/50">Bugünkü hedef</p>
            <div className="grid grid-cols-3 gap-3">
              <Goal icon={<Brain className="size-7" />} value={`%${data.targets.comprehension}`} label="anlama" tone="bg-grape-100 text-grape-700" />
              <Goal icon={<Target className="size-7" />} value={`%${data.targets.accuracy}`} label="doğruluk" tone="bg-brand-50 text-brand-700" />
              <Goal icon={<Gauge className="size-7" />} value={String(data.targets.wpm)} label="kelime/dk" tone="bg-sun-100 text-sun-700" />
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Flame className="size-8 fill-coral-400 text-coral-500" />} value={data.streak} label="günlük seri" />
            <Stat icon={<Star className="size-8 fill-sun-400 text-sun-500" />} value={child.xp} label="XP" />
            <Stat icon={<Trophy className="size-8 text-grape-500" />} value={data.totalStars} label="yıldız" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Tile to="/kutuphane" icon={<BookOpen className="size-9" />} title="Kütüphane" sub="Metin seç ve oku" tone="bg-coral-100 text-coral-700" />
            <Tile to="/dakika-testi" icon={<Timer className="size-9" />} title="1 Dakika Testi" sub="Dakikada kaç kelime?" tone="bg-grape-100 text-grape-700" />
            <Tile to="/oyunlar" icon={<Gamepad2 className="size-9" />} title="Kelime Oyunları" sub="Göz ve dikkat" tone="bg-brand-50 text-brand-700" />
            <Tile to="/rozetler" icon={<Award className="size-9" />} title="Rozetlerim" sub="Kazandıkların" tone="bg-sun-100 text-sun-700" />
          </div>

          {data.today.sessionsCompleted > 0 && (
            <p className="text-center font-bold text-ink/50">
              Bugün {data.today.sessionsCompleted} okuma · {data.today.wordsRead} kelime · {data.today.readingMinutes} dk çalıştın.
            </p>
          )}
        </div>
      )}
    </Layout>
  );
}

function Goal({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl p-3 ${tone}`}>
      {icon}
      <span className="mt-1 text-2xl font-black tabular-nums">{value}</span>
      <span className="text-sm font-bold opacity-75">{label}</span>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <Card className="flex flex-col items-center !p-4 text-center">
      {icon}
      <span className="mt-1 text-3xl font-black tabular-nums">{value}</span>
      <span className="text-sm font-bold text-ink/50">{label}</span>
    </Card>
  );
}

function Tile({ to, icon, title, sub, tone }: { to: string; icon: React.ReactNode; title: string; sub: string; tone: string }) {
  return (
    <Link to={to} className={`flex items-center gap-4 rounded-3xl p-5 transition hover:-translate-y-0.5 ${tone}`}>
      {icon}
      <span>
        <span className="block text-xl font-black">{title}</span>
        <span className="block text-sm font-bold opacity-75">{sub}</span>
      </span>
    </Link>
  );
}
