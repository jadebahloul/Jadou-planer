import * as React from 'react';
import { Check, Droplets, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { useInvalidate, useList, useSettings, type Row } from '@/lib/hooks';
import { today, addDays, eachDay, startOfWeek } from '@shared/dates';
import { categoryColor, optionLabel, CATEGORIES, PRIORITIES } from '@shared/registry';
import { Badge } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, nf } from '@/lib/utils';
import { toast } from 'sonner';

export function TaskCheck({ task, onToggled, showDate, className }: { task: Row; onToggled?: () => void; showDate?: boolean; className?: string }) {
  const invalidate = useInvalidate();
  const open = useRecordDialog();
  const done = task.status === 'done';
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api(`/r/task/${task.id}`, { method: 'PATCH', body: { status: done ? 'todo' : 'done' } });
    invalidate();
    onToggled?.();
    if (!done) toast.success('Bravo ♡', { description: task.title });
  };
  const subs = (task.subtasks ?? []) as { done?: boolean }[];
  return (
    <div onClick={() => open({ resource: 'task', id: task.id })} className={cn('group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-sunken/70', className)}>
      <button onClick={toggle} className={cn('grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition', done ? 'border-wine bg-wine text-onwine' : 'border-line group-hover:border-wine/50')} aria-label={done ? 'Rouvrir' : 'Terminer'}>
        {done && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <Check className="h-3 w-3" strokeWidth={3} />
          </motion.span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-medium', done && 'text-muted line-through')}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(task.category) }} />
            {optionLabel(CATEGORIES, task.category)}
          </span>
          {showDate && task.date && <span>{task.date === today() ? 'aujourd’hui' : task.date}</span>}
          {task.time && <span>{task.time}</span>}
          {subs.length > 0 && (
            <span>
              {subs.filter((s) => s.done).length}/{subs.length}
            </span>
          )}
        </div>
      </div>
      {(task.priority === 'high' || task.priority === 'urgent') && !done && <Badge className="hidden sm:inline-flex" color={PRIORITIES.find((p) => p.value === task.priority)?.color}>{optionLabel(PRIORITIES, task.priority)}</Badge>}
    </div>
  );
}

export function WaterQuick({ big }: { big?: boolean }) {
  const { data: settings } = useSettings();
  const { data: logs = [] } = useList('waterLog', { where: { date: today() } });
  const invalidate = useInvalidate();
  const goal = settings?.goals?.waterMl ?? 2000;
  const ml = logs.reduce((s, l) => s + (l.ml ?? 0), 0);
  const p = Math.min(100, Math.round((ml / goal) * 100));
  const add = async (n: number) => {
    const d = new Date();
    await api('/r/waterLog', { body: { date: today(), ml: n, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` } });
    invalidate();
  };
  const undo = async () => {
    const last = [...logs].sort((a, b) => b.id - a.id)[0];
    if (!last) return;
    await api(`/r/waterLog/${last.id}`, { method: 'DELETE' });
    invalidate();
  };
  const glass = big ? 'h-56 w-36' : 'h-28 w-[72px]';
  return (
    <div className={cn('flex items-center gap-5', big && 'flex-col sm:flex-row sm:gap-10')}>
      <div className={cn('relative overflow-hidden rounded-b-[28px] rounded-t-xl border-2 border-[#6C8EBF]/30 bg-surface', glass)}>
        <motion.div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#6C8EBF]/70 to-[#9DB8DE]/50" initial={{ height: 0 }} animate={{ height: `${p}%` }} transition={{ type: 'spring', bounce: 0.25, duration: 1.2 }}>
          <svg className="absolute -top-2 left-0 w-[200%] animate-[shimmer_4s_linear_infinite]" viewBox="0 0 200 10" preserveAspectRatio="none" style={{ height: 10 }}>
            <path d="M0 5 Q 12.5 0 25 5 T 50 5 T 75 5 T 100 5 T 125 5 T 150 5 T 175 5 T 200 5 V10 H0Z" fill="#9DB8DE" fillOpacity=".55" />
          </svg>
        </motion.div>
        <div className="absolute inset-0 grid place-items-center">
          <span className={cn('num font-display font-semibold text-ink', big ? 'text-3xl' : 'text-lg')}>{p}%</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="num font-display text-3xl">
          {nf(ml / 1000, 2)} <span className="text-base text-muted">/ {nf(goal / 1000, 1)} L</span>
        </div>
        <div className="mb-3 text-xs text-muted">{ml >= goal ? 'Objectif atteint, bravo ♡' : `Encore ${nf(goal - ml)} ml`}</div>
        <div className="flex flex-wrap gap-1.5">
          {[150, 250, 500].map((n) => (
            <button key={n} onClick={() => add(n)} className="inline-flex items-center gap-1 rounded-full bg-[#6C8EBF]/12 px-3 py-1.5 text-xs font-semibold text-[#3d5f93] transition hover:bg-[#6C8EBF]/20 dark:text-[#9DB8DE]">
              <Droplets className="h-3 w-3" /> +{n} ml
            </button>
          ))}
          {logs.length > 0 && (
            <button onClick={undo} className="chip px-2 py-1.5" title="Annuler le dernier ajout">
              <Undo2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** compute the set of days a habit is validated (manual logs + automatic links) */
export function useHabitDays(from: string, to: string) {
  const { data: logs = [] } = useList('habitLog', { where: { date: { gte: from, lte: to } } });
  const { data: sessions = [] } = useList('workoutSession', { where: { date: { gte: from, lte: to }, status: 'done' } });
  const { data: water = [] } = useList('waterLog', { where: { date: { gte: from, lte: to } } });
  const { data: attempts = [] } = useList('toeicAttempt', { where: { date: { gte: from, lte: to } } });
  const { data: journal = [] } = useList('journalEntry', { where: { date: { gte: from, lte: to } } });
  const { data: focus = [] } = useList('focusSession', { where: { date: { gte: from, lte: to } } });
  const { data: routineLogs = [] } = useList('routineLog', { where: { date: { gte: from, lte: to } } });
  const { data: routines = [] } = useList('routine');
  const { data: settings } = useSettings();
  return React.useMemo(() => {
    const goal = settings?.goals?.waterMl ?? 2000;
    const waterBy: Record<string, number> = {};
    for (const w of water) waterBy[w.date] = (waterBy[w.date] ?? 0) + (w.ml ?? 0);
    const skincare = routines.filter((r) => r.type?.startsWith('skincare'));
    const auto: Record<string, Set<string>> = {
      sport: new Set(sessions.map((s) => s.date)),
      water: new Set(Object.entries(waterBy).filter(([, v]) => v >= goal).map(([d]) => d)),
      toeic: new Set(attempts.map((a) => a.date)),
      journal: new Set(journal.map((j) => j.date)),
      focus: new Set(focus.map((f) => f.date)),
      skincare: new Set(routineLogs.filter((l) => { const r = skincare.find((x) => x.id === l.routineId); return r && (l.done ?? []).length >= (r.steps ?? []).length && (r.steps ?? []).length > 0; }).map((l) => l.date)),
    };
    return (habit: Row) => {
      const manual = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.date as string));
      const a = habit.autoLink && habit.autoLink !== 'none' ? auto[habit.autoLink] : undefined;
      return { manual, auto: a ?? new Set<string>(), has: (d: string) => manual.has(d) || !!a?.has(d), isAuto: (d: string) => !manual.has(d) && !!a?.has(d) };
    };
  }, [logs, sessions, water, attempts, journal, focus, routineLogs, routines, settings]);
}

export async function toggleHabit(habitId: number, date: string, logs: Row[]) {
  const existing = logs.find((l) => l.habitId === habitId && l.date === date);
  if (existing) await api(`/r/habitLog/${existing.id}`, { method: 'DELETE' });
  else await api('/r/habitLog', { body: { habitId, date } });
}

export function weekDays(ref = today()) {
  const mon = startOfWeek(ref);
  return eachDay(mon, addDays(mon, 6));
}
