import { BookOpen, Brain, Clock, Gauge, Info, Lock, Plus, Target, Trophy, Type } from "lucide-react";
import { useMemo, useState } from "react";
import type { Child, StatsRange } from "../../shared/api-types";
import { TARGET_WPM_MAX, TARGET_WPM_MIN } from "../../shared/reading";
import { api } from "../api/client";
import { AccountCard } from "../components/AccountCard";
import { InstallCard } from "../components/InstallCard";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { Layout } from "../components/Layout";
import { ComprehensionChart, WpmChart } from "../components/ProgressCharts";
import { Button, Card, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { useApp, useAsync } from "../lib/app-state";
import { Link } from "../lib/router";

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "7", label: "Son 7 gün" },
  { id: "30", label: "Son 30 gün" },
  { id: "all", label: "Tüm zamanlar" },
];

const MODE_LABELS: Record<string, string> = { placement: "Seviye testi", normal: "Normal", tracking: "Kelime takip", chunks: "Kelime grupları" };

/** Çocukların yanlışlıkla girmesini önleyen basit ebeveyn kapısı (güvenlik önlemi değildir). */
function ParentGate({ onPass }: { onPass: () => void }) {
  const [a] = useState(() => 6 + Math.floor(Math.random() * 4));
  const [b] = useState(() => 6 + Math.floor(Math.random() * 4));
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <Card className="mx-auto max-w-sm text-center">
      <Lock className="mx-auto size-10 text-brand-600" aria-hidden />
      <h1 className="mt-2 text-2xl font-black">Ebeveyn Paneli</h1>
      <p className="mt-1 font-semibold text-ink/60">Devam etmek için soruyu cevaplayın.</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(value) === a * b) onPass();
          else setWrong(true);
        }}
      >
        <label className="text-2xl font-black" htmlFor="gate">{a} × {b} = ?</label>
        <input
          id="gate"
          inputMode="numeric"
          className="rounded-2xl border-2 border-ink/10 px-4 py-3 text-center text-2xl font-black outline-none focus:border-brand-400"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          autoFocus
        />
        {wrong && <p className="font-bold text-coral-700">Cevap doğru değil.</p>}
        <Button type="submit">Giriş</Button>
      </form>
    </Card>
  );
}

function Tile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-ink/55">{icon}{label}</div>
      <p className="mt-1 text-3xl font-black tabular-nums">{value}</p>
      {hint && <p className="text-xs font-semibold text-ink/45">{hint}</p>}
    </Card>
  );
}

const fmt = (v: number | null, suffix = "") => (v === null ? "—" : `${Math.round(v)}${suffix}`);

function ChildDashboard({ child }: { child: Child }) {
  const [range, setRange] = useState<StatsRange>("30");
  const stats = useAsync(() => api.stats(child.id, range), [child.id, range]);
  const progress = useAsync(() => api.progress(child.id, range), [child.id, range]);
  const hasData = (stats.data?.sessionCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Zaman aralığı">
        {RANGES.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            onClick={() => setRange(r.id)}
            className={`rounded-full px-4 py-2 font-extrabold ${range === r.id ? "bg-brand-500 text-white" : "bg-white text-ink/70 hover:bg-brand-50"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {(stats.error || progress.error) && <ErrorBox message={stats.error ?? progress.error!} />}
      {stats.loading && !stats.data && <Spinner />}
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile icon={<Brain className="size-4" />} label="Anlama" value={fmt(stats.data.averageComprehension, "%")} hint="ortalama" />
          <Tile icon={<Target className="size-4" />} label="Doğruluk" value={fmt(stats.data.averageAccuracy, "%")} hint="yetişkin dinlediğinde" />
          <Tile icon={<Gauge className="size-4" />} label="Okuma hızı" value={fmt(stats.data.averageWpm)} hint={`kelime/dk · en iyi ${fmt(stats.data.bestWpm)}`} />
          <Tile icon={<Clock className="size-4" />} label="Çalışma süresi" value={`${Math.round(stats.data.totalMinutes)} dk`} hint={`${stats.data.activeDays} aktif gün`} />
          <Tile icon={<Type className="size-4" />} label="Toplam kelime" value={stats.data.totalWords.toLocaleString("tr-TR")} />
          <Tile icon={<BookOpen className="size-4" />} label="Okuma sayısı" value={String(stats.data.sessionCount)} />
          <Tile icon={<Trophy className="size-4" />} label="Oyunlar" value={String(stats.data.gamesPlayed)} hint={stats.data.gameAccuracy !== null ? `%${Math.round(stats.data.gameAccuracy)} doğru` : undefined} />
          <Tile icon={<Gauge className="size-4" />} label="Güncel hedef" value={String(child.target_wpm)} hint={`kelime/dk · seviye ${child.current_level}`} />
        </div>
      )}

      {progress.data && hasData && (
        <>
          <Card>
            <h2 className="text-lg font-black">Okuma hızı gelişimi</h2>
            <p className="mb-3 text-sm font-semibold text-ink/55">
              Tek günlük yüksek ya da düşük sonuçlar yanıltmasın diye trend, son 7 aktif günün hareketli ortalamasıdır.
            </p>
            <WpmChart points={progress.data.points} />
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-black">Okuduğunu anlama</h2>
            <ComprehensionChart points={progress.data.points} />
          </Card>
          <Card className="overflow-x-auto">
            <h2 className="mb-3 text-lg font-black">Son okumalar</h2>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-ink/50">
                <tr>
                  <th className="py-2 font-bold">Tarih</th>
                  <th className="font-bold">Metin</th>
                  <th className="font-bold">Mod</th>
                  <th className="text-right font-bold">Kelime/dk</th>
                  <th className="text-right font-bold">Doğruluk</th>
                  <th className="text-right font-bold">Anlama</th>
                </tr>
              </thead>
              <tbody>
                {progress.data.recentSessions.map((s) => (
                  <tr key={s.id} className="border-t border-ink/5 font-semibold">
                    <td className="py-2 tabular-nums">{new Date(s.completed_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</td>
                    <td>{s.title}{s.attempt_number > 1 && <span className="ml-1 text-ink/45">({s.attempt_number}. okuma)</span>}</td>
                    <td>{MODE_LABELS[s.reading_mode] ?? s.reading_mode}</td>
                    <td className="text-right tabular-nums">{Math.round(s.wpm)}</td>
                    <td className="text-right tabular-nums">{fmt(s.accuracy_percentage, "%")}</td>
                    <td className="text-right tabular-nums">{fmt(s.comprehension_percentage, "%")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {stats.data && !hasData && (
        <Card className="text-center font-bold text-ink/55">Bu aralıkta henüz okuma yok.</Card>
      )}

      <ChildSettings child={child} />
    </div>
  );
}

function ChildSettings({ child }: { child: Child }) {
  const { refresh } = useApp();
  const [name, setName] = useState(child.name);
  const [avatar, setAvatar] = useState(child.avatar);
  const [grade, setGrade] = useState<number | null>(child.grade);
  const [target, setTarget] = useState(child.target_wpm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await api.updateChild(child.id, { name: name.trim(), avatar, grade, targetWpm: target });
      await refresh();
      setMsg("Kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-black">Profil ve hedef ayarları</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 font-bold">
            Ad
            <input className="rounded-2xl border-2 border-ink/10 px-4 py-2.5 font-bold outline-none focus:border-brand-400" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label className="flex flex-col gap-1 font-bold">
            Sınıf
            <select className="rounded-2xl border-2 border-ink/10 px-4 py-2.5 font-bold" value={grade ?? ""} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}. sınıf</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-bold">
            Hedef okuma hızı: <span className="text-brand-700">{target} kelime/dk</span>
            <input type="range" min={TARGET_WPM_MIN} max={TARGET_WPM_MAX} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="accent-brand-500" />
            <span className="text-xs font-semibold text-ink/50">Hedef her okumadan sonra anlama ve doğruluğa göre otomatik ayarlanır. Gerekirse buradan elle değiştirebilirsiniz.</span>
          </label>
        </div>
        <div>
          <p className="mb-2 font-bold">Avatar</p>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
      </div>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} loading={busy} disabled={!name.trim()}>Kaydet</Button>
        {msg && <span className="font-bold text-brand-700">{msg}</span>}
      </div>
    </Card>
  );
}

export function ParentPanel() {
  const { children, child: activeChild } = useApp();
  const [passed, setPassed] = useState(false);
  const [selected, setSelected] = useState<string | null>(activeChild?.id ?? null);
  const child = useMemo(() => children.find((c) => c.id === selected) ?? children[0], [children, selected]);

  return (
    <Layout back="/" wide>
      {!passed ? (
        <ParentGate onPass={() => setPassed(true)} />
      ) : (
        <>
          <PageTitle sub="Gelişimi takip edin. Başarı ölçütleri öncelik sırasıyla: anlama, doğruluk, akıcılık, hız.">Ebeveyn Paneli</PageTitle>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`flex items-center gap-2 rounded-full py-1 pr-4 pl-1 font-extrabold ${child?.id === c.id ? "bg-brand-500 text-white" : "bg-white text-ink/70"}`}
              >
                <Avatar id={c.avatar} size={32} /> {c.name}
              </button>
            ))}
            <Link to="/yeni-okur" className="flex items-center gap-1 rounded-full bg-white px-4 py-2 font-extrabold text-brand-700 hover:bg-brand-50">
              <Plus className="size-4" /> Okur ekle
            </Link>
          </div>
          <AccountCard />
          <InstallCard className="mb-4" />
          <Card className="mb-4 flex gap-3 !bg-grape-100 !p-4 text-sm font-semibold text-grape-700">
            <Info className="size-5 shrink-0" aria-hidden />
            <p>
              Doğru okuma oranı için çocuğunuz sesli okurken dinleyip, okuma sonunda takıldığı veya yanlış okuduğu kelime sayısını girebilirsiniz.
              Ses kaydı alınmaz ve saklanmaz. Uygulama çocukları birbiriyle karşılaştırmaz.
            </p>
          </Card>
          {child && <ChildDashboard key={child.id} child={child} />}
        </>
      )}
    </Layout>
  );
}
