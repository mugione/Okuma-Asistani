import { Ear, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "../ui";

/**
 * Doğru okuma oranı: MVP'de ses tanıma yok. Bir yetişkin sesli okumayı dinlediyse
 * takılınan / yanlış okunan kelime sayısını girer. Girilmezse doğruluk "ölçülmedi" kalır.
 */
export function AccuracyInput({ onSubmit, loading }: { onSubmit: (errorCount: number | null) => void; loading: boolean }) {
  const [listened, setListened] = useState(false);
  const [errors, setErrors] = useState(0);
  return (
    <Card className="animate-fade-up mx-auto max-w-md text-center">
      <Ear className="mx-auto size-12 text-grape-500" aria-hidden />
      <h2 className="mt-2 text-2xl font-black">Süper, bitirdin!</h2>
      {!listened ? (
        <>
          <p className="mt-2 font-semibold text-ink/60">Sesli okurken seni bir büyüğün dinledi mi?</p>
          <div className="mt-5 flex flex-col gap-3">
            <Button variant="secondary" onClick={() => setListened(true)}>Evet, dinledi</Button>
            <Button onClick={() => onSubmit(null)} loading={loading}>Hayır, devam et</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 font-semibold text-ink/60">Kaç kelimede takıldı ya da yanlış okudu?</p>
          <div className="mt-5 flex items-center justify-center gap-5">
            <button className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700" onClick={() => setErrors((e) => Math.max(0, e - 1))} aria-label="Azalt">
              <Minus className="size-7" />
            </button>
            <span className="w-16 text-5xl font-black tabular-nums" aria-live="polite">{errors}</span>
            <button className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700" onClick={() => setErrors((e) => Math.min(300, e + 1))} aria-label="Artır">
              <Plus className="size-7" />
            </button>
          </div>
          <Button className="mt-6 w-full" onClick={() => onSubmit(errors)} loading={loading}>Kaydet</Button>
        </>
      )}
    </Card>
  );
}
