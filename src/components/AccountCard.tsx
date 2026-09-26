import { KeyRound, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { useApp } from "../lib/app-state";
import { useRouter } from "../lib/router";
import { PasswordField, UsernameField } from "../pages/Onboarding";
import { Button, Card, ErrorBox } from "./ui";

/** Ebeveyn panelinde hesap yönetimi: kullanıcı adı/şifre belirleme, şifre değiştirme, çıkış. */
export function AccountCard() {
  const { account, signInWithSession, logout } = useApp();
  const { navigate } = useRouter();
  const [mode, setMode] = useState<"idle" | "create" | "password" | "confirm-logout">("idle");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!account) return null;
  const hasAccount = !!account.username;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir sorun oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`grid size-11 place-items-center rounded-2xl ${hasAccount ? "bg-brand-50 text-brand-700" : "bg-sun-100 text-sun-700"}`}>
          {hasAccount ? <ShieldCheck className="size-6" aria-hidden /> : <Smartphone className="size-6" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black">{hasAccount ? `Kullanıcı adı: ${account.username}` : "Hesap yalnızca bu cihazda"}</p>
          <p className="text-sm font-semibold text-ink/55">
            {hasAccount
              ? "Başka bir cihazda \"Hesabım var, giriş yap\" ile bu kullanıcı adı ve şifreyle girebilirsiniz."
              : "Farklı cihazlardan takip etmek için kullanıcı adı ve şifre belirleyin. E-posta gerekmez."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!hasAccount && mode === "idle" && (
            <Button size="sm" onClick={() => setMode("create")}><KeyRound className="size-4" /> Kullanıcı adı ve şifre belirle</Button>
          )}
          {hasAccount && mode === "idle" && (
            <Button size="sm" variant="secondary" onClick={() => setMode("password")}>Şifreyi değiştir</Button>
          )}
          {mode === "idle" && (
            <Button size="sm" variant="ghost" onClick={() => (hasAccount ? void doLogout() : setMode("confirm-logout"))}>
              <LogOut className="size-4" /> Çıkış yap
            </Button>
          )}
        </div>
      </div>

      {mode === "create" && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await api.setCredentials({ username, password });
              signInWithSession(r.token, r.account);
              setMode("idle");
              setMsg("Hesap oluşturuldu. Artık diğer cihazlardan da giriş yapabilirsiniz.");
            });
          }}
        >
          <UsernameField value={username} onChange={setUsername} />
          <PasswordField value={password} onChange={setPassword} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={busy}>Kaydet</Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>Vazgeç</Button>
          </div>
        </form>
      )}

      {mode === "password" && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.changePassword({ currentPassword: current, newPassword: password });
              setMode("idle");
              setCurrent("");
              setPassword("");
              setMsg("Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.");
            });
          }}
        >
          <PasswordField value={current} onChange={setCurrent} label="Mevcut şifre" autoComplete="current-password" />
          <PasswordField value={password} onChange={setPassword} label="Yeni şifre" />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={busy}>Şifreyi değiştir</Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>Vazgeç</Button>
          </div>
        </form>
      )}

      {mode === "confirm-logout" && (
        <div className="mt-4 rounded-2xl border-2 border-coral-400 bg-coral-100 p-4 text-coral-700">
          <p className="font-black">Dikkat: bu ailenin kullanıcı adı ve şifresi yok.</p>
          <p className="mt-1 text-sm font-semibold">
            Çıkış yaparsanız bu verilere bir daha erişemezsiniz. Önce kullanıcı adı ve şifre belirlemeniz önerilir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode("create")}>Önce hesap oluştur</Button>
            <Button size="sm" variant="danger" onClick={() => void doLogout()}>Yine de çıkış yap</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Vazgeç</Button>
          </div>
        </div>
      )}

      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      {msg && <p className="mt-3 font-bold text-brand-700">{msg}</p>}
    </Card>
  );
}
