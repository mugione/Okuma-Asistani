import { ArrowLeft, Flame, RefreshCw, Star, Users, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { effectiveStreak, istanbulDate } from "../../shared/reading";
import { useApp } from "../lib/app-state";
import { useOnline, useUpdateReady } from "../lib/pwa";
import { Link, useRouter } from "../lib/router";
import { Avatar } from "./Avatar";
import { CelebrationToast } from "./CelebrationToast";

export function Layout({ children, back, wide }: { children: ReactNode; back?: string; wide?: boolean }) {
  const { child } = useApp();
  const { navigate } = useRouter();
  const online = useOnline();
  const updateReady = useUpdateReady();
  return (
    <div className="min-h-dvh pb-16">
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-coral-100 px-4 py-2 text-sm font-extrabold text-coral-700" role="status">
          <WifiOff className="size-4" aria-hidden /> İnternet bağlantısı yok. Okumalar kaydedilemez; bağlantı gelince devam edebilirsin.
        </div>
      )}
      {updateReady && (
        <div className="flex items-center justify-center gap-3 bg-brand-50 px-4 py-2 text-sm font-extrabold text-brand-700" role="status">
          OkuHız'ın yeni sürümü hazır.
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-white">
            <RefreshCw className="size-3.5" aria-hidden /> Yenile
          </button>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-brand-100/70 bg-paper/85 backdrop-blur">
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          {back ? (
            <button
              onClick={() => navigate(back)}
              className="grid size-11 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm hover:bg-brand-50"
              aria-label="Geri"
            >
              <ArrowLeft className="size-6" />
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="size-10" />
              <span className="hidden text-2xl font-black tracking-tight text-brand-700 sm:inline">
                Oku<span className="text-coral-500">Hız</span>
              </span>
            </Link>
          )}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {child && (
              <>
                <span className="flex items-center gap-1 rounded-full bg-coral-100 px-3 py-1.5 text-sm font-extrabold text-coral-700" title="Günlük seri">
                  <Flame className="size-4 fill-coral-400" aria-hidden /> {effectiveStreak(child.current_streak, child.last_active_date, istanbulDate())}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-sun-100 px-3 py-1.5 text-sm font-extrabold text-sun-700" title="XP">
                  <Star className="size-4 fill-sun-400 text-sun-500" aria-hidden /> {child.xp}
                </span>
                <Link to="/profiller" className="rounded-full ring-2 ring-white" >
                  <Avatar id={child.avatar} size={40} />
                  <span className="sr-only">Profil değiştir</span>
                </Link>
              </>
            )}
            <Link to="/ebeveyn" className="grid size-10 place-items-center rounded-full bg-white text-ink/60 shadow-sm hover:text-brand-700">
              <Users className="size-5" aria-hidden />
              <span className="sr-only">Ebeveyn paneli</span>
            </Link>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 pt-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>{children}</main>
      <CelebrationToast />
    </div>
  );
}
