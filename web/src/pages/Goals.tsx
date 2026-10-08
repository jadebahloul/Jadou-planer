import * as React from 'react';
import { Plus, Target, Check, CalendarClock } from 'lucide-react';
import { GOAL_CATEGORIES, HORIZONS, optionLabel, optionColor } from '@shared/registry';
import { formatFr, diffDays, today } from '@shared/dates';
import { useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Segmented, Progress, Badge, Ring, Stat } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, nf } from '@/lib/utils';

export const goalPct = (g: Row) => (g.status === 'done' ? 100 : g.targetValue ? Math.min(100, Math.round(((g.currentValue ?? 0) / g.targetValue) * 100)) : g.progress ?? 0);

export function GoalCard({ g }: { g: Row }) {
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const steps = (g.steps ?? []) as { id: string; title: string; done?: boolean }[];
  const p = goalPct(g);
  const color = optionColor(GOAL_CATEGORIES, g.category) ?? '#713F4B';
  const toggleStep = async (id: string) => {
    await api(`/r/goal/${g.id}`, { method: 'PATCH', body: { steps: steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) } });
    invalidate();
  };
  const left = g.targetDate ? diffDays(g.targetDate, today()) : null;
  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start gap-4">
        <Ring value={p} size={58} stroke={5} color={color}>
          <span className="num text-xs font-semibold">{p}%</span>
        </Ring>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => open({ resource: 'goal', id: g.id })}>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Badge color={color}>{optionLabel(GOAL_CATEGORIES, g.category)}</Badge>
            <Badge>{optionLabel(HORIZONS, g.horizon)}</Badge>
            {g.status === 'done' && <Badge color="#3F8F5F">Atteint ✓</Badge>}
          </div>
          <div className="font-display text-xl leading-tight">{g.title}</div>
          {g.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{g.description}</p>}
        </div>
      </div>
      {g.targetValue ? (
        <div className="mt-4 text-xs text-muted">
          <span className="num font-semibold text-ink">{nf(g.currentValue ?? 0, 1)}</span> / {nf(g.targetValue, 1)} {g.unit}
          <Progress value={p} className="mt-1.5" color={color} />
        </div>
      ) : null}
      {steps.length > 0 && (
        <div className="mt-4 space-y-1">
          {steps.map((s) => (
            <button key={s.id} onClick={() => toggleStep(s.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-sunken/60">
              <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border', s.done ? 'border-wine bg-wine text-onwine' : 'border-line')}>{s.done && <Check className="h-3 w-3" strokeWidth={3} />}</span>
              <span className={cn(s.done && 'text-muted line-through')}>{s.title}</span>
            </button>
          ))}
        </div>
      )}
      {g.targetDate && (
        <div className={cn('mt-auto flex items-center gap-1.5 pt-4 text-[11px]', left !== null && left < 0 && g.status === 'active' ? 'text-bad' : 'text-muted')}>
          <CalendarClock className="h-3.5 w-3.5" /> {formatFr(g.targetDate, { year: true })} {left !== null && g.status === 'active' && `· ${left >= 0 ? `J-${left}` : `dépassé de ${-left} j`}`}
        </div>
      )}
    </Card>
  );
}

export function GoalsPage() {
  const { data: goals = [] } = useList('goal');
  const open = useRecordDialog();
  const [h, setH] = React.useState<string>('all');
  const [status, setStatus] = React.useState<'active' | 'done' | 'all'>('active');
  const list = goals.filter((g) => (h === 'all' || g.horizon === h) && (status === 'all' || (status === 'done' ? g.status === 'done' : g.status === 'active' || g.status === 'paused')));
  const active = goals.filter((g) => g.status === 'active');
  return (
    <Page>
      <PageHeader eyebrow="Organization" title="My" accent="Goals" subtitle="Hebdomadaires, mensuels, trimestriels, annuels et long terme." coverKey="goals" variant={1} actions={<Button icon={Plus} onClick={() => open({ resource: 'goal' })}>Objectif</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Actifs" value={active.length} icon={Target} />
        <Stat label="Progression moyenne" value={`${active.length ? Math.round(active.reduce((s, g) => s + goalPct(g), 0) / active.length) : 0} %`} />
        <Stat label="Atteints" value={goals.filter((g) => g.status === 'done').length} />
        <Stat label="Échéance < 30 j" value={active.filter((g) => g.targetDate && diffDays(g.targetDate, today()) <= 30 && diffDays(g.targetDate, today()) >= 0).length} />
      </div>
      <div className="mb-5 flex flex-wrap gap-3">
        <Segmented value={h} onChange={setH} options={[{ value: 'all', label: 'Tous' }, ...HORIZONS]} />
        <Segmented value={status} onChange={setStatus} options={[{ value: 'active', label: 'En cours' }, { value: 'done', label: 'Atteints' }, { value: 'all', label: 'Tout' }]} />
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty icon={Target} title="Aucun objectif ici" text="Définis un objectif clair, avec une date cible et des étapes." action={<Button variant="soft" icon={Plus} onClick={() => open({ resource: 'goal', defaults: { horizon: h === 'all' ? 'monthly' : h } })}>Créer un objectif</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <GoalCard key={g.id} g={g} />
          ))}
        </div>
      )}
    </Page>
  );
}
