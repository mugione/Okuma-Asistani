import { AlignLeft, Headphones, Highlighter, Rows3 } from "lucide-react";
import type { ReadingModeName } from "../../../shared/api-types";

export type PickerMode = Exclude<ReadingModeName, "placement"> | "listen";

export const MODES: { id: Exclude<ReadingModeName, "placement">; title: string; sub: string; icon: React.ReactNode }[] = [
  { id: "normal", title: "Normal Okuma", sub: "Kendi hızında oku", icon: <AlignLeft className="size-7" /> },
  { id: "tracking", title: "Kelime Takip", sub: "Sarı işareti takip et", icon: <Highlighter className="size-7" /> },
  { id: "chunks", title: "Kelime Grupları", sub: "Kelimeleri grup grup oku", icon: <Rows3 className="size-7" /> },
];

const LISTEN_MODE = { id: "listen" as const, title: "Dinle-Oku", sub: "Önce dinle, sonra oku", icon: <Headphones className="size-7" /> };

export function ModePicker({ value, onChange, withListen = false }: { value: PickerMode; onChange: (m: PickerMode) => void; withListen?: boolean }) {
  const options: { id: PickerMode; title: string; sub: string; icon: React.ReactNode }[] = withListen ? [...MODES, LISTEN_MODE] : MODES;
  return (
    <div className={`grid gap-3 ${withListen ? "sm:grid-cols-2" : "sm:grid-cols-3"}`} role="radiogroup" aria-label="Okuma modu">
      {options.map((m) => (
        <button
          key={m.id}
          role="radio"
          aria-checked={value === m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-3 rounded-2xl border-3 p-4 text-left transition sm:flex-col sm:text-center ${
            value === m.id ? "border-brand-500 bg-brand-50 text-brand-800" : "border-transparent bg-white hover:bg-brand-50"
          }`}
        >
          {m.icon}
          <span>
            <span className="block text-lg font-black">{m.title}</span>
            <span className="block text-sm font-bold opacity-60">{m.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
