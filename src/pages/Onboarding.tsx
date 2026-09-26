import { BookHeart, KeyRound, Sparkles, Smartphone } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { AvatarPicker } from "../components/Avatar";
import { Button, Card, ErrorBox } from "../components/ui";
import { useApp } from "../lib/app-state";
import { useRouter } from "../lib/router";

export const inputClass =
  "w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-brand-400";

export function UsernameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 font-bold">
      Kullanıcı adı
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ""))}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        minLength={3}
        maxLength={24}
        pattern="[a-z0-9._\-]+"
        required
      />
      <span className="text-xs font-semibold text-ink/50">Küçük harf (a-z), rakam, nokta, tire veya alt çizgi. E-posta gerekmez.</span>
    </label>
  );
}

export function PasswordField({
  value,
  onChange,
  label = "Şifre",
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 font-bold">
      {label}
      <input
        className={inputClass}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={autoComplete === "new-password" ? 8 : 1}
        maxLength={128}
        required
      />
      {autoComplete === "new-password" && <span className="text-xs font-semibold text-ink/50">En az 8 karakter.</span>}
    </label>
  );
}

/** İlk kurulum: karşılama → (giriş | ebeveyn → çocuk). Ebeveyn zaten varsa yalnızca çocuk eklenir. */
export function Onboarding({ addChildOnly = false }: { addChildOnly?: boolean }) {
  const { account, signInDevice, signInWithSession, selectChild, refresh } = useApp();
  const { navigate } = useRouter();
  const [step, setStep] = useState<"welcome" | "login" | "parent" | "child">(addChildOnly || account ? "child" : "welcome");
  const [parentName, setParentName] = useState("");
  const [withAccount, setWithAccount] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(3);
  const [birthYear, setBirthYear] = useState<string>("");
  const [avatar, setAvatar] = useState("avatar-1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir sorun oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const login = () =>
    run(async () => {
      const r = await api.login({ username, password });
      signInWithSession(r.token, r.account);
      navigate(r.account.children.length > 1 ? "/profiller" : "/", { replace: true });
    });

  const createParent = () =>
    run(async () => {
      if (withAccount) {
        const r = await api.register({ name: parentName.trim(), username, password });
        signInWithSession(r.token, r.account);
      } else {
        const p = await api.createParent({ name: parentName.trim() });
        await signInDevice(p.id);
      }
      setStep("child");
    });

  const createChild = () =>
    run(async () => {
      if (!account) return;
      const c = await api.createChild({
        parentId: account.id,
        name: name.trim(),
        grade,
        birthYear: birthYear ? Number(birthYear) : null,
        avatar,
      });
      selectChild(c.id);
      await refresh();
      navigate("/seviye-testi", { replace: true });
    });

  const thisYear = new Date().getFullYear();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      {step === "welcome" && (
        <div className="animate-fade-up text-center">
          <img src="/favicon.svg" alt="" className="animate-float mx-auto size-24" />
          <h1 className="mt-4 text-5xl font-black tracking-tight text-brand-700">
            Oku<span className="text-coral-500">Hız</span>
          </h1>
          <p className="mt-3 text-xl font-bold text-ink/60">Akıllı okuma antrenörün!</p>
          <ul className="mx-auto mt-8 flex max-w-sm flex-col gap-3 text-left text-lg font-bold">
            <li className="flex items-center gap-3"><BookHeart className="size-7 text-coral-500" /> Eğlenceli metinler oku</li>
            <li className="flex items-center gap-3"><Sparkles className="size-7 text-sun-500" /> Anla, yıldız ve rozet kazan</li>
            <li className="flex items-center gap-3"><img src="/favicon.svg" alt="" className="size-7" /> Her gün biraz daha akıcı oku</li>
          </ul>
          <Button size="lg" className="mt-10 w-full" onClick={() => setStep("parent")}>Başlayalım</Button>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => setStep("login")}>
            <KeyRound className="size-5" /> Hesabım var, giriş yap
          </Button>
        </div>
      )}

      {step === "login" && (
        <Card className="animate-fade-up">
          <h2 className="text-3xl font-black">Giriş yap</h2>
          <p className="mt-1 font-semibold text-ink/60">Başka bir cihazda oluşturduğunuz hesapla devam edin.</p>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <UsernameField value={username} onChange={setUsername} />
            <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
            {error && <ErrorBox message={error} />}
            <Button type="submit" size="lg" loading={busy}>Giriş yap</Button>
            <Button type="button" variant="ghost" onClick={() => { setError(null); setStep("welcome"); }}>Geri</Button>
          </form>
        </Card>
      )}

      {step === "parent" && (
        <Card className="animate-fade-up">
          <p className="text-sm font-extrabold uppercase tracking-wide text-brand-600">Adım 1 / 2 · Ebeveyn</p>
          <h2 className="mt-1 text-3xl font-black">Merhaba! Siz kimsiniz?</h2>
          <p className="mt-1 font-semibold text-ink/60">Bu adımı bir yetişkin tamamlamalı. E-posta istenmez.</p>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void createParent();
            }}
          >
            <label className="flex flex-col gap-1 font-bold">
              Adınız
              <input className={inputClass} value={parentName} onChange={(e) => setParentName(e.target.value)} required maxLength={60} autoFocus />
            </label>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hesap türü">
              {[
                { v: true, icon: <KeyRound className="size-6" />, t: "Hesap oluştur", s: "Her cihazdan giriş" },
                { v: false, icon: <Smartphone className="size-6" />, t: "Sadece bu cihaz", s: "Şifresiz" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={withAccount === o.v}
                  onClick={() => setWithAccount(o.v)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-3 p-3 text-center transition ${
                    withAccount === o.v ? "border-brand-500 bg-brand-50 text-brand-800" : "border-ink/10 bg-white"
                  }`}
                >
                  {o.icon}
                  <span className="font-black">{o.t}</span>
                  <span className="text-xs font-bold opacity-60">{o.s}</span>
                </button>
              ))}
            </div>

            {withAccount ? (
              <>
                <UsernameField value={username} onChange={setUsername} />
                <PasswordField value={password} onChange={setPassword} />
              </>
            ) : (
              <p className="rounded-2xl bg-sun-100 p-3 text-sm font-semibold text-sun-700">
                Veriler yalnızca bu cihazdan görülebilir. İstediğiniz zaman ebeveyn panelinden kullanıcı adı ve şifre ekleyebilirsiniz.
              </p>
            )}
            {error && <ErrorBox message={error} />}
            <Button type="submit" size="lg" loading={busy} disabled={!parentName.trim()}>Devam</Button>
          </form>
        </Card>
      )}

      {step === "child" && (
        <Card className="animate-fade-up">
          <p className="text-sm font-extrabold uppercase tracking-wide text-brand-600">{addChildOnly ? "Yeni okur" : "Adım 2 / 2 · Okur"}</p>
          <h2 className="mt-1 text-3xl font-black">Okurumuzu tanıyalım</h2>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void createChild();
            }}
          >
            <label className="flex flex-col gap-1 font-bold">
              Adı
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-bold">
                Sınıfı
                <select className={inputClass} value={grade ?? ""} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Seçiniz</option>
                  {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}. sınıf</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-bold">
                Doğum yılı
                <select className={inputClass} value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Array.from({ length: 10 }, (_, i) => thisYear - 4 - i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
            <div className="font-bold">
              <p className="mb-2">Avatarını seç</p>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
            {error && <ErrorBox message={error} />}
            <Button type="submit" size="lg" loading={busy} disabled={!name.trim()}>Hadi Başlayalım!</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
