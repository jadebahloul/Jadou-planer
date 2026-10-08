import * as React from 'react';
import { Droplets, Trash2 } from 'lucide-react';
import { today, addDays, eachDay, formatFr } from '@shared/dates';
import { useList, useSettings, useSaveSetting, useRemove } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, Input, Stat, Empty } from '@/components/ui';
import { WaterQuick } from '@/components/widgets';
import { BarsChart } from '@/components/charts';
import { nf } from '@/lib/utils';

export function WaterPage() {
  const from = addDays(today(), -29);
  const { data: logs = [] } = useList('waterLog', { where: { date: { gte: from } } });
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const remove = useRemove('waterLog');
  const goal = settings?.goals?.waterMl ?? 2000;
  const days = eachDay(from, today());
  const series = days.map((d) => ({ day: d, ml: logs.filter((l) => l.date === d).reduce((s, l) => s + l.ml, 0) }));
  const tracked = series.filter((s) => s.ml > 0);
  const avg = tracked.length ? Math.round(tracked.reduce((s, x) => s + x.ml, 0) / tracked.length) : 0;
  const reached = series.filter((s) => s.ml >= goal).length;
  const todayLogs = logs.filter((l) => l.date === today()).sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return (
    <Page>
      <PageHeader eyebrow="Wellness" title="Water" accent="Tracker" subtitle="Un verre après l’autre ♡" coverKey="water" variant={1} compact />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-6 sm:p-8">
          <WaterQuick big />
          <div className="mt-6 flex items-center gap-3 border-t border-line/70 pt-4 text-sm">
            <span className="text-muted">Objectif quotidien</span>
            <Input type="number" step={100} className="w-28" defaultValue={goal} onBlur={(e) => Number(e.target.value) > 0 && save.mutate({ key: 'goals', value: { ...settings?.goals, waterMl: Number(e.target.value) } })} />
            <span className="text-muted">ml</span>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 self-start">
          <Stat label="Moyenne (jours suivis)" value={`${nf(avg / 1000, 2)} L`} icon={Droplets} />
          <Stat label="Objectif atteint" value={`${reached} j`} sub="sur 30 jours" />
          <Card className="col-span-2">
            <CardHeader title="Aujourd’hui" />
            <div className="p-3">
              {todayLogs.length === 0 && <Empty title="Aucun verre" className="py-4" />}
              {todayLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl px-3 py-1.5 text-sm hover:bg-sunken">
                  <span className="num text-muted">{l.time ?? '—'}</span>
                  <span className="num font-medium">+{l.ml} ml</span>
                  <button onClick={() => remove.mutate(l.id)} className="text-muted hover:text-bad" aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <Card className="mt-5">
        <CardHeader title="Historique — 30 derniers jours" eyebrow={`Objectif ${goal} ml`} />
        <div className="p-5">
          <BarsChart data={series} x="day" labelFmt={(d) => formatFr(d).split(' ')[0]} series={[{ key: 'ml', name: 'Eau (ml)', color: '#4E79C4' }]} fmt={(v) => `${nf(v)} ml`} />
        </div>
      </Card>
    </Page>
  );
}
