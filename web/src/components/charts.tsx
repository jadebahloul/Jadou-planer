import * as React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { CHART, nf } from '@/lib/utils';
import { eur } from '@shared/finance';

const axis = { stroke: 'rgb(var(--muted))', fontSize: 11, tickLine: false, axisLine: false } as const;

export type Fmt = 'eur' | 'num' | 'pct' | ((v: number) => string);
const format = (f: Fmt | undefined, v: number) => (typeof f === 'function' ? f(v) : f === 'eur' ? eur(v) : f === 'pct' ? `${nf(v)} %` : nf(v, 1));

function TooltipBox({ active, payload, label, fmt, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2 text-xs shadow-lift">
      <div className="mb-1 font-semibold text-ink">{labelFmt ? labelFmt(label) : label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name}</span>
          <span className="num ml-auto pl-3 font-semibold text-ink">{format(fmt, p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export interface Series {
  key: string;
  name: string;
  color?: string;
}

function LegendRow({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? CHART[i] }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export function TrendChart({ data, x, series, fmt, height = 220, labelFmt, type = 'area' }: { data: any[]; x: string; series: Series[]; fmt?: Fmt; height?: number; labelFmt?: (v: any) => string; type?: 'area' | 'line' }) {
  const id = React.useId().replace(/:/g, '');
  const Chart = type === 'area' ? AreaChart : LineChart;
  return (
    <div>
      <LegendRow series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? CHART[i]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color ?? CHART[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="0" strokeOpacity={0.7} />
          <XAxis dataKey={x} {...axis} tickFormatter={labelFmt} minTickGap={16} />
          <YAxis {...axis} width={56} tickFormatter={(v) => (fmt === 'eur' ? `${nf(v)} €` : nf(v))} />
          <Tooltip content={<TooltipBox fmt={fmt} labelFmt={labelFmt} />} cursor={{ stroke: 'rgb(var(--muted))', strokeDasharray: '3 3' }} />
          {series.map((s, i) =>
            type === 'area' ? (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? CHART[i]} strokeWidth={2} fill={`url(#${id}-${s.key})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} />
            ) : (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? CHART[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: s.color ?? CHART[i] }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} connectNulls />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({ data, x, series, fmt, height = 220, labelFmt, stacked, layout = 'horizontal' }: { data: any[]; x: string; series: Series[]; fmt?: Fmt; height?: number; labelFmt?: (v: any) => string; stacked?: boolean; layout?: 'horizontal' | 'vertical' }) {
  const vertical = layout === 'vertical';
  return (
    <div>
      <LegendRow series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={{ top: 6, right: 8, left: vertical ? 8 : -12, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={vertical} horizontal={!vertical} stroke="rgb(var(--line))" strokeOpacity={0.7} />
          {vertical ? (
            <>
              <XAxis type="number" {...axis} tickFormatter={(v) => (fmt === 'eur' ? `${nf(v)} €` : nf(v))} />
              <YAxis type="category" dataKey={x} {...axis} width={110} tickFormatter={labelFmt} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} {...axis} tickFormatter={labelFmt} />
              <YAxis {...axis} width={56} tickFormatter={(v) => (fmt === 'eur' ? `${nf(v)} €` : nf(v))} />
            </>
          )}
          <Tooltip content={<TooltipBox fmt={fmt} labelFmt={labelFmt} />} cursor={{ fill: 'rgb(var(--petal) / .5)' }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? CHART[i]} stackId={stacked ? 'a' : undefined} radius={stacked ? 0 : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} stroke="rgb(var(--surface))" strokeWidth={stacked ? 1 : 0} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, fmt = 'eur', height = 200, center }: { data: { name: string; value: number; color?: string }[]; fmt?: Fmt; height?: number; center?: React.ReactNode }) {
  // fixed order; more than 6 slices fold into "Autres"
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((s, d) => s + d.value, 0);
  const slices = rest ? [...top, { name: 'Autres', value: rest, color: 'rgb(var(--muted))' }] : top;
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="rgb(var(--surface))" strokeWidth={2} cornerRadius={4}>
              {slices.map((s, i) => (
                <Cell key={s.name} fill={s.color ?? CHART[i]} />
              ))}
            </Pie>
            <Tooltip content={<TooltipBox fmt={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>
      </div>
      <div className="w-full space-y-2">
        {slices.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color ?? CHART[i] }} />
            <span className="truncate text-ink/80">{s.name}</span>
            <span className="num ml-auto font-medium">{format(fmt, s.value)}</span>
            <span className="num w-10 text-right text-xs text-muted">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { Legend };
