import * as React from 'react';
import { Plus, Ruler, Lock } from 'lucide-react';
import { today, formatFr } from '@shared/dates';
import { useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TrendChart } from '@/components/charts';
import { nf } from '@/lib/utils';

const METRICS = [
  { key: 'weight', label: 'Poids', unit: 'kg' },
  { key: 'glutes', label: 'Fessiers', unit: 'cm' },
  { key: 'hips', label: 'Hanches', unit: 'cm' },
  { key: 'waist', label: 'Taille', unit: 'cm' },
  { key: 'thigh', label: 'Cuisse', unit: 'cm' },
  { key: 'arm', label: 'Bras', unit: 'cm' },
];

export function BodyPage() {
  const { data: rows = [] } = useList('bodyMetric', { orderBy: 'date', dir: 'asc' });
  const open = useRecordDialog();
  const [metric, setMetric] = React.useState('glutes');
  const m = METRICS.find((x) => x.key === metric)!;
  const series = rows.filter((r) => r[metric] != null).map((r) => ({ date: r.date, v: r[metric] }));
  const delta = (k: string) => {
    const s = rows.filter((r) => r[k] != null);
    if (s.length < 2) return null;
    return s[s.length - 1][k] - s[0][k];
  };
  const photos = rows.filter((r) => r.photo).reverse();
  return (
    <Page>
      <PageHeader eyebrow="Wellness" title="Body" accent="Progress" subtitle={<span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Données privées — jamais partagées, même avec Jadou AI (sauf autorisation).</span>} coverKey="body" variant={2} compact actions={<Button icon={Plus} onClick={() => open({ resource: 'bodyMetric', defaults: { date: today() } })}>Mesure</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {METRICS.map((x) => {
          const last = [...rows].reverse().find((r) => r[x.key] != null);
          const d = delta(x.key);
          return <Stat key={x.key} label={x.label} value={last ? `${nf(last[x.key], 1)} ${x.unit}` : '—'} sub={d != null ? `${d > 0 ? '+' : ''}${nf(d, 1)} ${x.unit} depuis le début` : 'Pas encore d’évolution'} />;
        })}
      </div>
      <Card className="mb-5">
        <CardHeader icon={Ruler} title="Évolution" action={<Segmented size="sm" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.key, label: x.label }))} />} />
        <div className="p-5">{series.length >= 2 ? <TrendChart type="line" data={series} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'v', name: `${m.label} (${m.unit})` }]} fmt={(v) => `${nf(v, 1)} ${m.unit}`} /> : <Empty title="Au moins deux mesures nécessaires" text="Mesure-toi toutes les 2 à 4 semaines, dans les mêmes conditions." className="py-8" />}</div>
      </Card>
      {photos.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Photos de progression" eyebrow="Privé" />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => (
              <button key={p.id} onClick={() => open({ resource: 'bodyMetric', id: p.id })} className="group overflow-hidden rounded-2xl">
                <img src={p.photo} alt="" className="aspect-[3/4] w-full object-cover transition group-hover:scale-105" />
                <div className="py-1 text-center text-xs text-muted">{formatFr(p.date)}</div>
              </button>
            ))}
          </div>
        </Card>
      )}
      <ResourceTable resource="bodyMetric" title="Historique des mesures" defaults={{ date: today() }} />
    </Page>
  );
}
