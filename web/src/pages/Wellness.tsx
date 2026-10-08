import * as React from 'react';
import { Moon, Smile, Zap, Lock, Plus } from 'lucide-react';
import { today, addDays, formatFr } from '@shared/dates';
import { useList, useSave, type Row } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Rating, Stat, Input, Switch, Textarea, Empty } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { TrendChart } from '@/components/charts';
import { nf } from '@/lib/utils';

function CheckIn({ existing }: { existing?: Row }) {
  const save = useSave('wellnessLog');
  const [v, setV] = React.useState<Record<string, any>>(existing ?? { date: today(), sleepHours: null, sleepQuality: 0, mood: 0, energy: 0, digestion: 0, period: false, notes: '' });
  React.useEffect(() => {
    if (existing) setV(existing);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const row = (label: string, k: string) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <Rating value={v[k]} onChange={(x) => set(k, x || null)} size={22} />
    </div>
  );
  return (
    <Card>
      <CardHeader icon={Smile} eyebrow={formatFr(today(), { weekday: true })} title="Check-in du jour" />
      <div className="space-y-1 p-5">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-muted">Sommeil (heures)</span>
          <Input type="number" step={0.5} className="w-24" value={v.sleepHours ?? ''} onChange={(e) => set('sleepHours', e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        {row('Qualité du sommeil', 'sleepQuality')}
        {row('Humeur', 'mood')}
        {row('Énergie', 'energy')}
        {row('Digestion', 'digestion')}
        <div className="py-2">
          <Switch checked={!!v.period} onChange={(x) => set('period', x)} label="Règles (suivi facultatif)" />
        </div>
        <Textarea placeholder="Comment je me sens…" value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        <Button className="mt-2 w-full" loading={save.isPending} onClick={() => save.mutate({ id: existing?.id, data: { ...v, sleepQuality: v.sleepQuality || null, mood: v.mood || null, energy: v.energy || null, digestion: v.digestion || null } })}>
          {existing ? 'Mettre à jour' : 'Enregistrer'}
        </Button>
      </div>
    </Card>
  );
}

export function WellnessPage() {
  const from = addDays(today(), -29);
  const { data: logs = [] } = useList('wellnessLog', { where: { date: { gte: from } }, orderBy: 'date', dir: 'asc' });
  const todayLog = logs.find((l) => l.date === today());
  const avg = (k: string) => {
    const xs = logs.filter((l) => l[k] != null).map((l) => l[k]);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  return (
    <Page>
      <PageHeader eyebrow="Wellness" title="Wellness" accent="& balance" subtitle={<span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Sommeil, humeur, énergie, digestion, cycle — données de santé strictement privées.</span>} coverKey="wellness" variant={0} compact />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sommeil moyen" value={avg('sleepHours') != null ? `${nf(avg('sleepHours')!, 1)} h` : '—'} icon={Moon} sub="30 derniers jours" />
        <Stat label="Humeur moyenne" value={avg('mood') != null ? `${nf(avg('mood')!, 1)}/5` : '—'} icon={Smile} />
        <Stat label="Énergie moyenne" value={avg('energy') != null ? `${nf(avg('energy')!, 1)}/5` : '—'} icon={Zap} />
        <Stat label="Check-ins" value={logs.length} sub="sur 30 jours" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <CheckIn existing={todayLog} />
        <Card>
          <CardHeader title="Tendances" eyebrow="30 jours" />
          <div className="p-5">
            {logs.length >= 2 ? (
              <TrendChart type="line" data={logs.map((l) => ({ date: l.date, mood: l.mood, energy: l.energy, sleepQuality: l.sleepQuality }))} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'mood', name: 'Humeur' }, { key: 'energy', name: 'Énergie' }, { key: 'sleepQuality', name: 'Sommeil' }]} fmt={(v) => `${v}/5`} height={260} />
            ) : (
              <Empty title="Fais quelques check-ins" text="Tes tendances apparaîtront ici." icon={Plus} />
            )}
          </div>
        </Card>
      </div>
      <ResourceTable resource="wellnessLog" title="Historique" className="mt-5" defaults={{ date: today() }} />
    </Page>
  );
}
