"use client";

// Dependency-free inline-SVG charts for the analytics dashboard (no chart library — same
// convention as the inline icon set). All are theme-neutral and scale to their container width.

/** Builds an SVG path `d` for a polyline through `values`, scaled into [x0,x1]×[y0,y1]. */
function linePath(values: number[], x0: number, x1: number, y0: number, y1: number, max: number): string {
  if (values.length === 0) return "";
  const span = values.length > 1 ? (x1 - x0) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = x0 + i * span;
      const y = y1 - (max > 0 ? (v / max) * (y1 - y0) : 0);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Tiny trend line for the stat cards. */
export function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const max = Math.max(1, ...values);
  const d = linePath(values, 1, 119, 4, 34, max);
  return (
    <svg viewBox="0 0 120 38" className="h-9 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface AreaSeries {
  label: string;
  color: string;
  values: number[];
}

/** Stacked-look dual area chart (Views vs Unique) with y grid + sparse x labels. */
export function AreaChart({ series, labels }: { series: AreaSeries[]; labels: string[] }) {
  const W = 760;
  const H = 280;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const x0 = padL;
  const x1 = W - padR;
  const y0 = padT;
  const y1 = H - padB;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = niceCeil(max);
  const gridLines = 4;

  const xLabelEvery = Math.max(1, Math.ceil(labels.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-72 w-full" role="img" aria-label="Traffic over time">
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>

      {/* y grid + labels */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = y0 + ((y1 - y0) / gridLines) * i;
        const val = Math.round(niceMax - (niceMax / gridLines) * i);
        return (
          <g key={i}>
            <line x1={x0} y1={y} x2={x1} y2={y} stroke="currentColor" className="text-slate-100" strokeWidth={1} />
            <text x={x0 - 8} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
              {formatAxis(val)}
            </text>
          </g>
        );
      })}

      {/* areas + lines (draw first series on top last for overlap) */}
      {series.map((s, i) => {
        const line = linePath(s.values, x0, x1, y0, y1, niceMax);
        const area = `${line} L${x1},${y1} L${x0},${y1} Z`;
        return (
          <g key={i}>
            <path d={area} fill={`url(#area-grad-${i})`} stroke="none" />
            <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}

      {/* x labels */}
      {labels.map((lab, i) =>
        i % xLabelEvery === 0 || i === labels.length - 1 ? (
          <text
            key={i}
            x={x0 + (labels.length > 1 ? ((x1 - x0) / (labels.length - 1)) * i : 0)}
            y={H - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[10px]"
          >
            {lab}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  color: string;
  value: number;
}

/** Donut chart. Centre shows the total. */
export function Donut({ segments, centerLabel, centerSub }: { segments: DonutSegment[]; centerLabel: string; centerSub?: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative mx-auto aspect-square w-44">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx={70} cy={70} r={r} fill="none" stroke="currentColor" className="text-slate-100" strokeWidth={16} />
        {total > 0 &&
          segments.map((seg, i) => {
            const len = (seg.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={i}
                cx={70}
                cy={70}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={16}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{centerLabel}</span>
        {centerSub && <span className="text-[11px] text-slate-400">{centerSub}</span>}
      </div>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / pow) * pow;
}
function formatAxis(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}
