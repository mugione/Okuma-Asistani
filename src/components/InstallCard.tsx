import { Download, Share, X } from "lucide-react";
import { useState } from "react";
import { useInstallPrompt } from "../lib/pwa";
import { load, save } from "../lib/storage";
import { Button, Card } from "./ui";

const DISMISS_KEY = "okuhiz.installDismissedAt";
const DISMISS_DAYS = 14;

/**
 * "Ana ekrana ekle" kartı. Uygulama zaten yüklüyse (tam ekran açıldıysa veya bu tarayıcıda
 * yüklendiyse) ya da tarayıcı yüklemeyi desteklemiyorsa görünmez.
 * `dismissible`: "Şimdi değil" ile 14 gün gizlenir (ana sayfada sürekli çıkmasın diye).
 */
export function InstallCard({ dismissible = false, className = "" }: { dismissible?: boolean; className?: string }) {
  const install = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible) return false;
    const at = Number(load(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  });

  if (install.installed || dismissed || (!install.canPrompt && !install.ios)) return null;

  const dismiss = () => {
    save(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <Card className={`animate-fade-up relative flex flex-wrap items-center gap-3 !p-4 ${className}`}>
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50">
        <img src="/icons/icon-192.png" alt="" className="size-9" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-black">OkuHız'ı ana ekrana ekle</p>
        <p className="text-sm font-semibold text-ink/55">
          {install.ios && !install.canPrompt ? (
            <>
              Safari'de <Share className="inline size-4 align-text-bottom" aria-label="Paylaş" /> düğmesine, ardından
              "Ana Ekrana Ekle"ye dokunun.
            </>
          ) : (
            "Uygulama gibi tam ekran açılır, internet yokken de açılabilir."
          )}
        </p>
      </div>
      {install.canPrompt && (
        <Button size="sm" onClick={install.prompt}>
          <Download className="size-4" /> Yükle
        </Button>
      )}
      {dismissible && (
        <button onClick={dismiss} className="absolute top-2 right-2 rounded-full p-1.5 text-ink/35 hover:bg-ink/5 hover:text-ink/70" aria-label="Şimdi değil">
          <X className="size-4" />
        </button>
      )}
    </Card>
  );
}
