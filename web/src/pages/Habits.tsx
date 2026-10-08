import * as React from 'react';
import { Plus, ChevronLeft, ChevronRight, Flame, Zap } from 'lucide-react';
import { today, addMonths, startOfMonth, endOfMonth, eachDay, addDays, startOfWeek, formatFr, FR_MONTHS, weekdayOf } from '@shared/dates';
import { useList, useInvalidate } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, IconButton, Progress, Stat } from '@/components/ui';
import { useHabitDays, toggleHabit } from '@/components/widgets';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, pct } from '@/lib/utils';

export function HabitsPage() {
  const [month, setMonth] = React.useState(startOfMonth(today()));
  const days = eachDay(month, endOfMonth(month));
  const from = addDays(month, -60);
  const { data: habits = [] } = useList('habit');
  const { data: logs = [] } = useList('habitLog', { where: { date: { gte: from, lte: endOfMonth(month) } } });
  const status = useHabitDays(from, endOfMonth(month));
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const t0 = today();
  const active = habits.filter((h) => h.active);
  const wk = startOfWeek(t0);
  const weekDays = eachDay(wk, addDays(wk, 6));

  const streak = (h: any) => {
    const st = status(h);
    let n = 0;
    let d = st.has(t0) ? t0 : addDays(t0, -1);
    while (st.has(d) && n < 365) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  };

  const doneToday = active.filter((h) => status(h).has(t0)).length;
  const pastDays = days.filter((d) => d <= t0);
  const monthRate = active.length && pastDays.length ? Math.round((active.reduce((s, h) => s + pastDays.filter((d) => status(h).has(d)).length, 0) / (active.length * pastDays.length)) * 100) : 0;

  return (
    <Page>
      <PageHeader eyebrow="Lifestyle" title="Habit" accent="Tracker" subtitle="Des objectifs réalistes, une régularité visible. Certaines habitudes se valident toutes seules (sport, eau, TOEIC…)." coverKey="habits" variant={0} actions={<Button icon={Plus} onClick={() => open({ resource: 'habit' })}>Habitude</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Aujourd’hui" value={`${doneToday}/${active.length}`} icon={Zap} />
        <Stat label="Régularité du mois" value={`${monthRate} %`} />
        <Stat label="Meilleure série" value={`${Math.max(0, ...active.map(streak))} j`} icon={Flame} />
        <Stat label="Habitudes actives" value={active.length} />
      </div>

      {active.length === 0 ? (
        <Card>
          <Empty icon={Flame} title="Aucune habitude" action={<Button variant="soft" icon={Plus} onClick={() => open({ resource: 'habit' })}>Créer une habitude</Button>} />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((h) => {
              const st = status(h);
              const weekDone = weekDays.filter((d) => st.has(d)).length;
              return (
                <Card key={h.id} className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl text-lg" style={{ background: `${h.color}22` }}>
                      {h.emoji}
                    </span>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => open({ resource: 'habit', id: h.id })}>
                      <div className="font-semibold">{h.name}</div>
                      <div className="text-[11px] text-muted">
                        {weekDone}/{h.targetPerWeek} cette semaine · série {streak(h)} j{h.autoLink && h.autoLink !== 'none' ? ' · auto' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between gap-1">
                    {weekDays.map((d) => {
                      const done = st.has(d);
                      return (
                        <button
                          key={d}
                          disabled={d > t0 || st.isAuto(d)}
                          onClick={async () => {
                            await toggleHabit(h.id, d, logs);
                            invalidate();
                          }}
                          className={cn('flex h-10 flex-1 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition disabled:cursor-default', done ? 'text-white' : d === t0 ? 'border border-wine/30 text-wine' : 'bg-sunken text-muted', d > t0 && 'opacity-40')}
                          style={done ? { background: h.color } : undefined}
                          title={st.isAuto(d) ? 'Validé automatiquement' : formatFr(d)}
                        >
                          {'DLMMJVS'[weekdayOf(d)]}
                          <span className="num text-[9px] font-normal opacity-80">{+d.slice(8)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Progress value={pct(weekDone, h.targetPerWeek)} className="mt-3" color={h.color} height={4} />
                </Card>
              );
            })}
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line/70 px-5 py-3">
              <IconButton icon={ChevronLeft} label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} />
              <div className="h-display min-w-[160px] text-center text-xl capitalize">
                {FR_MONTHS[+month.slice(5, 7) - 1]} {month.slice(0, 4)}
              </div>
              <IconButton icon={ChevronRight} label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} />
              <span className="ml-auto text-xs text-muted">Calendrier mensuel</span>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface pr-3 text-left" />
                    {days.map((d) => (
                      <th key={d} className={cn('num w-7 pb-2 text-center font-medium text-muted', d === t0 && 'text-wine')}>
                        {+d.slice(8)}
                      </th>
                    ))}
                    <th className="pl-3 text-right text-muted">%</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((h) => {
                    const st = status(h);
                    const done = pastDays.filter((d) => st.has(d)).length;
                    return (
                      <tr key={h.id}>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-surface py-1 pr-3 font-medium">
                          {h.emoji} {h.name}
                        </td>
                        {days.map((d) => (
                          <td key={d} className="p-0.5">
                            <button
                              disabled={d > t0 || st.isAuto(d)}
                              onClick={async () => {
                                await toggleHabit(h.id, d, logs);
                                invalidate();
                              }}
                              className={cn('block h-6 w-6 rounded-md transition', st.has(d) ? '' : 'bg-sunken hover:bg-petal', d > t0 && 'opacity-30')}
                              style={st.has(d) ? { background: h.color, opacity: st.isAuto(d) ? 0.75 : 1 } : undefined}
                              aria-label={`${h.name} ${d}`}
                            />
                          </td>
                        ))}
                        <td className="num pl-3 text-right font-semibold">{pastDays.length ? Math.round((done / pastDays.length) * 100) : 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}
