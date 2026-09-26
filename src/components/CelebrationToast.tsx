import { X } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "../lib/app-state";
import { AchievementIcon } from "./icons";

export function CelebrationToast() {
  const { celebrations, dismissCelebration } = useApp();
  const current = celebrations[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismissCelebration, 5000);
    return () => clearTimeout(t);
  }, [current, dismissCelebration]);
  if (!current) return null;
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div key={current.id} className="animate-pop flex max-w-sm items-center gap-4 rounded-3xl border-3 border-sun-400 bg-white p-4 shadow-xl">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-100 text-sun-700">
          <AchievementIcon name={current.icon} className="size-8" />
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-sun-700">Yeni rozet!</p>
          <p className="text-lg font-black">{current.title}</p>
          <p className="text-sm font-semibold text-ink/60">{current.description}</p>
        </div>
        <button onClick={dismissCelebration} className="self-start text-ink/40 hover:text-ink" aria-label="Kapat">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
