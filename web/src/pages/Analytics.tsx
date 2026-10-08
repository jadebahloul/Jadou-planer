import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { today, addDays, startOfWeek, startOfMonth, endOfMonth, addMonths, formatFr } from '@shared/dates';
import { eur } from '@shared/finance';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, Segmented } from '@/components/ui';
import { BarsChart, TrendChart } from '@/components/charts';
import { cn, nf } from '@/lib/utils';

type P = 'week' | 'month' | 'quarter' | 'year';

function range(p: P, offset: number) {
  const t0 = today();
  if (p === 'week') {
    const f = addDays(startOfWeek(t0), offset * 7);
    return { from: f, to: addDays(f, 6), label: `S. ${formatFr(f)}` };
  }
  if (p === 'month') {
    const f = addMonths(startOfMonth(t0), offset);
    return { from: f, to: endOfMonth(f), label: new Date(+f.slice(0, 4), +f.slice(5, 7) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) };
  }
  if (p === 'quarter') {
    const m = Math.floor((+t0.slice(5, 7) - 1) / 3) * 3;
    const f = addMonths(`${t0.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`, offset * 3);
    return { from: f, to: endOfMonth(addMonths(f, 2)), label: `T${Math.floor((+f.slice(5, 7) - 1) / 3) + 1} ${f.slice(2, 4)}` };
  }
  const y = +t0.slice(0, 4) + offset;
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
}

const METRICS: { key: string; label: string; fmt: (v: number) => string; good?: 'up' | 'down' }[] = [
  { key: 'tasksDone', label: 'Tâches réalisées', fmt: (v) => nf(v), good: 'up' },
  { key: 'studyMinutes', label: 'Temps d’étude (focus)', fmt: (v) => `${nf(v / 60, 1)} h`, good: 'up' },
  { key: 'toeicMinutes', label: 'Révisions TOEIC', fmt: (v) => `${nf(v)} min`, good: 'up' },
  { key: 'workouts', label: 'Séances sportives', fmt: (v) => nf(v), good: 'up' },
  { key: 'income', label: 'Revenus', fmt: (v) => eur(v), good: 'up' },
  { key: 'expense', label: 'Dépenses', fmt: (v) => eur(v), good: 'down' },
  { key: 'saved', label: 'Épargne versée', fmt: (v) => eur(v), good: 'up' },
  { key: 'projectsUpdated', label: 'Projets avancés', fmt: (v) => nf(v), good: 'up' },
  { key: 'goalsCount', label: 'Objectifs atteints', fmt: (v) => nf(v), good: 'up' },
];

export function AnalyticsPage() {
  const [p, setP] = React.useState<P>('month');
  const n = p === 'week' ? 8 : p === 'month' ? 6 : p === 'quarter' ? 4 : 3;
  const ranges = Array.from({ length: n }, (_, i) => range(p, i - (n - 1)));
  const results = useQueries({ queries: ranges.map((r) => ({ queryKey: ['api', `/stats/period?from=${r.from}&to=${r.to}`], queryFn: () => api<any>(`/stats/period?from=${r.from}&to=${r.to}`) })) });
  const data = results.map((r, i) => ({ ...(r.data ?? {}), goalsCount: r.data?.goalsDone?.length ?? 0, label: ranges[i].label }));
  const cur = data[data.length - 1];
  const prev = data[data.length - 2];
  const { data: series = [] } = useApi<any[]>('/stats/money-series?months=12');
  const ready = results.every((r) => r.data);
  return (
    <Page>
      <PageHeader eyebrow="Organization" title="Life" accent="Analytics" subtitle="Comparer tes périodes — uniquement à partir de tes données enregistrées." coverKey="analytics" variant={2} compact />
      <Segmented className="mb-5" value={p} onChange={setP} options={[{ value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }, { value: 'quarter', label: 'Trimestre' }, { value: 'year', label: 'Année' }]} />
      {ready && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {METRICS.map((m) => {
              const v = cur?.[m.key] ?? 0;
              const pv = prev?.[m.key] ?? 0;
              const d = v - pv;
              const better = d === 0 ? null : (d > 0) === (m.good === 'up');
              return (
                <Card key={m.key} className="p-4">
                  <div className="eyebrow">{m.label}</div>
                  <div className="num mt-2 font-display text-[28px] leading-none">{m.fmt(v)}</div>
                  <div className={cn('mt-2 inline-flex items-center gap-1 text-xs', better === null ? 'text-muted' : better ? 'text-good' : 'text-bad')}>
                    {d === 0 ? <Minus className="h-3 w-3" /> : d > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {d === 0 ? 'stable' : `${d > 0 ? '+' : '−'}${m.fmt(Math.abs(d))}`} vs période précédente
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader title="Productivité" /><div className="p-5"><BarsChart data={data} x="label" series={[{ key: 'tasksDone', name: 'Tâches' }, { key: 'workouts', name: 'Séances' }]} /></div></Card>
            <Card><CardHeader title="Argent" /><div className="p-5"><BarsChart data={data} x="label" fmt="eur" series={[{ key: 'income', name: 'Revenus' }, { key: 'expense', name: 'Dépenses' }, { key: 'saved', name: 'Épargne' }]} /></div></Card>
            <Card><CardHeader title="Apprentissage" eyebrow="minutes" /><div className="p-5"><BarsChart data={data} x="label" series={[{ key: 'studyMinutes', name: 'Études (focus)' }, { key: 'toeicMinutes', name: 'TOEIC' }]} /></div></Card>
            <Card><CardHeader title="Évolution du patrimoine (comptes)" eyebrow="12 mois" /><div className="p-5"><TrendChart data={series} x="month" fmt="eur" labelFmt={(m) => new Date(+m.slice(0, 4), +m.slice(5) - 1).toLocaleDateString('fr-FR', { month: 'short' })} series={[{ key: 'balance', name: 'Solde total' }]} /></div></Card>
          </div>
        </>
      )}
    </Page>
  );
}
