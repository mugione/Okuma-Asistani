import { Loader2, Star } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "sun" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-white shadow-[0_5px_0_var(--color-brand-700)] hover:bg-brand-400",
  secondary: "bg-white text-brand-700 border-2 border-brand-200 shadow-[0_4px_0_var(--color-brand-200)] hover:bg-brand-50",
  sun: "bg-sun-400 text-ink shadow-[0_5px_0_var(--color-sun-500)] hover:bg-sun-300",
  ghost: "bg-transparent text-brand-700 hover:bg-brand-50",
  danger: "bg-coral-500 text-white shadow-[0_5px_0_var(--color-coral-700)] hover:bg-coral-400",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const sizes = { sm: "px-4 py-2 text-sm", md: "px-6 py-3 text-base", lg: "px-8 py-4 text-xl" };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition active:translate-y-1 active:shadow-none disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-[0_6px_24px_rgba(15,81,75,0.08)] ${className}`}>{children}</div>;
}

export function Spinner({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-brand-600" role="status">
      <Loader2 className="size-10 animate-spin" aria-hidden />
      <span className="font-bold">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-coral-400 bg-coral-100 p-4 text-coral-700" role="alert">
      <p className="font-bold">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Tekrar dene
        </Button>
      )}
    </div>
  );
}

export function Stars({ count, max = 3, size = 36 }: { count: number; max?: number; size?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${count} yıldız`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size, animationDelay: `${i * 150}ms` }}
          className={`animate-pop ${i < count ? "fill-sun-400 text-sun-500" : "fill-ink/5 text-ink/15"}`}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function ProgressBar({ value, className = "", color = "bg-brand-500" }: { value: number; className?: string; color?: string }) {
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-ink/10 ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{children}</h1>
      {sub && <p className="mt-1 text-lg font-semibold text-ink/60">{sub}</p>}
    </div>
  );
}
