import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProgressPoint } from "../../shared/api-types";

// Palet doğrulandı (dataviz validate_palette: brand-500 / grape-500, açık zemin).
const COLORS = {
  trend: "#0a8074", // brand-600: hareketli ortalama çizgisi
  daily: "#5dd5c3", // brand-300: günlük ortalama noktaları (aynı varlık, daha açık ton)
  comprehension: "#8b6cf0", // grape-500
  grid: "rgba(31,42,55,0.08)",
  axis: "rgba(31,42,55,0.55)",
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

interface TooltipRow { label: string; value: string; color: string; dashed?: boolean }

function ChartTooltip({ active, label, rows }: { active?: boolean; label?: string; rows: TooltipRow[] }) {
  if (!active || !label) return null;
  return (
    <div className="rounded-xl border border-ink/10 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-bold text-ink/50">{fmtDate(label)}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-0.5 w-3" style={{ background: r.color }} aria-hidden />
          <span className="font-black tabular-nums text-ink">{r.value}</span>
          <span className="font-semibold text-ink/55">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; kind: "line" | "dot" }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-sm font-semibold text-ink/65">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          {i.kind === "line" ? (
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: i.color }} aria-hidden />
          ) : (
            <span className="inline-block size-2.5 rounded-full" style={{ background: i.color }} aria-hidden />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

const axisProps = {
  stroke: COLORS.axis,
  tick: { fill: COLORS.axis, fontSize: 12, fontWeight: 600 },
  tickLine: false,
  axisLine: false,
} as const;

export function WpmChart({ points }: { points: ProgressPoint[] }) {
  return (
    <div>
      <Legend
        items={[
          { label: "7 günlük hareketli ortalama (trend)", color: COLORS.trend, kind: "line" },
          { label: "Günlük ortalama", color: COLORS.daily, kind: "dot" },
        ]}
      />
      <div className="h-64" role="img" aria-label="Okuma hızı gelişim grafiği (kelime/dakika)">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={24} {...axisProps} />
            <YAxis
              domain={[(min: number) => Math.max(0, Math.floor((min * 0.8) / 10) * 10), (max: number) => Math.ceil((max * 1.1) / 10) * 10]}
              allowDecimals={false}
              {...axisProps}
            />
            <Tooltip
              cursor={{ stroke: COLORS.axis, strokeWidth: 1 }}
              content={({ active, label, payload }) => {
                const p = payload?.[0]?.payload as ProgressPoint | undefined;
                return (
                  <ChartTooltip
                    active={active}
                    label={label as string}
                    rows={[
                      { label: "trend", value: p?.wpmTrend != null ? `${Math.round(p.wpmTrend)} k/dk` : "—", color: COLORS.trend },
                      { label: "günlük", value: p?.wpm != null ? `${Math.round(p.wpm)} k/dk` : "okuma yok", color: COLORS.daily },
                    ]}
                  />
                );
              }}
            />
            <Line
              dataKey="wpm"
              stroke="none"
              isAnimationActive={false}
              dot={{ r: 4.5, fill: COLORS.daily, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COLORS.daily, stroke: "#fff", strokeWidth: 2 }}
            />
            <Line dataKey="wpmTrend" stroke={COLORS.trend} strokeWidth={2} dot={false} connectNulls type="monotone" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ComprehensionChart({ points }: { points: ProgressPoint[] }) {
  return (
    <div className="h-48" role="img" aria-label="Okuduğunu anlama yüzdesi grafiği">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={24} {...axisProps} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 80, 100]} {...axisProps} />
          <ReferenceLine y={80} stroke={COLORS.axis} strokeDasharray="4 4" label={{ value: "hedef %80", position: "insideTopLeft", fill: COLORS.axis, fontSize: 11, fontWeight: 700 }} />
          <Tooltip
            cursor={{ stroke: COLORS.axis, strokeWidth: 1 }}
            content={({ active, label, payload }) => {
              const p = payload?.[0]?.payload as ProgressPoint | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={label as string}
                  rows={[{ label: "anlama", value: p?.comprehension != null ? `%${Math.round(p.comprehension)}` : "—", color: COLORS.comprehension }]}
                />
              );
            }}
          />
          <Line
            dataKey="comprehension"
            stroke={COLORS.comprehension}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
            dot={{ r: 4, fill: COLORS.comprehension, stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
