import * as React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { Plus, Timer, CalendarDays, Repeat, Play, Inbox, ListTodo, Columns3, AlertCircle, CalendarRange, Sun } from 'lucide-react';
import { today, addDays, startOfWeek, formatFr, relativeDay } from '@shared/dates';
import { CATEGORIES, TASK_STATUS, PRIORITIES, categoryColor, optionLabel } from '@shared/registry';
import { useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Segmented, Badge, Select, Progress } from '@/components/ui';
import { TaskCheck } from '@/components/widgets';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { useFocus, fmtTimer } from '@/components/layout/Focus';
import { cn } from '@/lib/utils';

type View = 'today' | 'week' | 'overdue' | 'all' | 'kanban';

function KanbanCard({ t }: { t: Row }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const open = useRecordDialog();
  const subs = (t.subtasks ?? []) as { done?: boolean }[];
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => open({ resource: 'task', id: t.id })}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn('card cursor-grab touch-none p-3.5 active:cursor-grabbing', isDragging && 'z-20 rotate-1 shadow-lift')}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(t.category) }} />
        {optionLabel(CATEGORIES, t.category)}
        {(t.priority === 'high' || t.priority === 'urgent') && <Badge color={PRIORITIES.find((p) => p.value === t.priority)?.color} className="ml-auto">{optionLabel(PRIORITIES, t.priority)}</Badge>}
      </div>
      <div className="text-sm font-medium">{t.title}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
        {t.date && <span className={cn(t.date < today() && t.status !== 'done' && 'text-bad')}>{relativeDay(t.date)}</span>}
        {t.time && <span>{t.time}</span>}
        {subs.length > 0 && <span>☑ {subs.filter((s) => s.done).length}/{subs.length}</span>}
      </div>
      {subs.length > 0 && <Progress value={(subs.filter((s) => s.done).length / subs.length) * 100} className="mt-2" height={3} />}
    </div>
  );
}

function KanbanColumn({ status, label, color, tasks }: { status: string; label: string; color?: string; tasks: Row[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const open = useRecordDialog();
  return (
    <div ref={setNodeRef} className={cn('flex min-h-[300px] flex-col rounded-3xl bg-sunken/60 p-3 transition', isOver && 'bg-petal')}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="num text-xs text-muted">{tasks.length}</span>
        <button onClick={() => open({ resource: 'task', defaults: { status, date: today() } })} className="ml-auto text-muted hover:text-wine" aria-label="Ajouter">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <KanbanCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

function FocusPanel({ tasks }: { tasks: Row[] }) {
  const focus = useFocus();
  const [taskId, setTaskId] = React.useState<string>('');
  const [minutes, setMinutes] = React.useState(25);
  const { data: sessions = [] } = useList('focusSession', { where: { date: today() } });
  const todayMin = sessions.reduce((s, x) => s + x.minutes, 0);
  const task = tasks.find((t) => String(t.id) === taskId);
  return (
    <Card className="overflow-hidden">
      <div className="bg-wine p-5 text-onwine">
        <div className="eyebrow text-onwine/70">Focus Mode</div>
        <div className="num mt-1 font-display text-5xl">{focus.state ? fmtTimer(focus.state.remaining) : fmtTimer(minutes * 60)}</div>
        <div className="mt-1 truncate text-xs text-onwine/70">{focus.state ? focus.state.label : 'Pomodoro — une tâche à la fois'}</div>
      </div>
      <div className="space-y-3 p-4">
        {!focus.state ? (
          <>
            <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">Session libre</option>
              {tasks.filter((t) => t.status !== 'done').map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
            <div className="flex gap-1.5">
              {[15, 25, 45, 60].map((m) => (
                <button key={m} onClick={() => setMinutes(m)} className={cn('chip flex-1 justify-center', minutes === m && 'chip-active')}>
                  {m} min
                </button>
              ))}
            </div>
            <Button className="w-full" icon={Play} onClick={() => focus.start({ label: task?.title ?? 'Session libre', taskId: task?.id, category: task?.category ?? 'perso', minutes })}>
              Démarrer
            </Button>
          </>
        ) : (
          <div className="flex gap-2">
            <Button variant="soft" className="flex-1" onClick={focus.toggle}>
              {focus.state.running ? 'Pause' : 'Reprendre'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => focus.stop(true)}>
              Terminer
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between rounded-xl bg-sunken/70 px-3 py-2 text-xs text-muted">
          <span>Concentration aujourd’hui</span>
          <span className="num font-semibold text-ink">{todayMin} min</span>
        </div>
      </div>
    </Card>
  );
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'today';
  const setView = (v: View) => setParams({ view: v });
  const [cat, setCat] = React.useState<string | null>(null);
  const { data: all = [] } = useList('task');
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const t0 = today();
  const wk = startOfWeek(t0);

  const filtered = all.filter((t) => !cat || t.category === cat);
  const rank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortFn = (a: Row, b: Row) => String(a.date ?? '9999').localeCompare(String(b.date ?? '9999')) || String(a.time ?? '99').localeCompare(String(b.time ?? '99')) || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);

  const lists: Record<Exclude<View, 'kanban'>, Row[]> = {
    today: filtered.filter((t) => t.date === t0 || (t.focus && t.status !== 'done' && (!t.date || t.date <= t0))).sort(sortFn),
    week: filtered.filter((t) => t.date && t.date >= wk && t.date <= addDays(wk, 6)).sort(sortFn),
    overdue: filtered.filter((t) => t.date && t.date < t0 && t.status !== 'done').sort(sortFn),
    all: filtered.filter((t) => t.status !== 'done').sort(sortFn),
  };
  const counts = { today: lists.today.filter((t) => t.status !== 'done').length, week: lists.week.filter((t) => t.status !== 'done').length, overdue: lists.overdue.length, all: lists.all.length };

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const t = all.find((x) => x.id === e.active.id);
    if (!t || t.status === e.over.id) return;
    await api(`/r/task/${t.id}`, { method: 'PATCH', body: { status: e.over.id } });
    invalidate();
  };

  const reschedule = async (days: number) => {
    for (const t of lists.overdue) await api(`/r/task/${t.id}`, { method: 'PATCH', body: { date: addDays(t0, days) } });
    invalidate();
  };

  const groups = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(wk, i)) : null;
  const doneHistory = all.filter((t) => t.status === 'done' && t.date && t.date < t0).length;

  return (
    <Page>
      <PageHeader eyebrow="Home" title="My" accent="Tasks" subtitle={`${counts.today} à faire aujourd’hui · ${counts.overdue} en retard · ${doneHistory} terminées au total`} coverKey="tasks" variant={2} compact actions={<Button icon={Plus} onClick={() => open({ resource: 'task', defaults: { date: t0 } })}>Nouvelle tâche</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: `Aujourd’hui ${counts.today || ''}`, icon: Sun },
            { value: 'week', label: 'Semaine', icon: CalendarRange },
            { value: 'overdue', label: `En retard ${counts.overdue || ''}`, icon: AlertCircle },
            { value: 'all', label: 'Toutes', icon: ListTodo },
            { value: 'kanban', label: 'Kanban', icon: Columns3 },
          ]}
        />
        <Link to="/calendar" className="chip">
          <CalendarDays className="h-3.5 w-3.5" /> Vue calendrier
        </Link>
      </div>
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <button className={cn('chip shrink-0', !cat && 'chip-active')} onClick={() => setCat(null)}>
          Toutes catégories
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} className={cn('chip shrink-0', cat === c.value && 'chip-active')} onClick={() => setCat(cat === c.value ? null : c.value)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </button>
        ))}
      </div>

      {view === 'kanban' ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-3">
            {TASK_STATUS.map((s) => (
              <KanbanColumn key={s.value} status={s.value} label={s.label} color={s.color} tasks={filtered.filter((t) => t.status === s.value && (s.value !== 'done' || (t.date ?? '') >= addDays(t0, -14))).sort(sortFn)} />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <Card className="p-2 sm:p-3">
            {view === 'overdue' && lists.overdue.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-bad/5 px-4 py-3 text-sm">
                <AlertCircle className="h-4 w-4 text-bad" />
                <span className="mr-auto">Replanifier toutes les tâches en retard :</span>
                <Button size="sm" variant="outline" onClick={() => reschedule(0)}>
                  Aujourd’hui
                </Button>
                <Button size="sm" variant="outline" onClick={() => reschedule(1)}>
                  Demain
                </Button>
              </div>
            )}
            {groups ? (
              groups.map((d) => {
                const ts = lists.week.filter((t) => t.date === d);
                return (
                  <div key={d} className="mb-2">
                    <div className={cn('flex items-center gap-2 px-3 pb-1 pt-3', d === t0 && 'text-wine')}>
                      <span className="font-display text-lg capitalize">{formatFr(d, { weekday: true })}</span>
                      <span className="text-xs text-muted">{ts.filter((t) => t.status !== 'done').length || ''}</span>
                      <button onClick={() => open({ resource: 'task', defaults: { date: d } })} className="ml-auto text-muted hover:text-wine" aria-label="Ajouter">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {ts.length === 0 ? <div className="px-3 py-1 text-xs text-muted/70">—</div> : ts.map((t) => <TaskRow key={t.id} t={t} />)}
                  </div>
                );
              })
            ) : lists[view as Exclude<View, 'kanban' | 'week'>].length === 0 ? (
              <Empty icon={Inbox} title={view === 'overdue' ? 'Aucun retard ✨' : 'Rien ici'} text={view === 'today' ? 'Ajoute une tâche ou demande à Jadou AI d’organiser ta journée.' : undefined} />
            ) : (
              lists[view as Exclude<View, 'kanban' | 'week'>].map((t) => <TaskRow key={t.id} t={t} showDate={view !== 'today'} />)
            )}
          </Card>
          <div className="space-y-4">
            <FocusPanel tasks={all.filter((t) => t.date === t0 || t.focus)} />
            <Card className="p-4 text-xs text-muted">
              <div className="eyebrow mb-2">Récurrence</div>
              <div className="flex gap-2">
                <Repeat className="h-4 w-4 shrink-0 text-wine" />
                Les tâches récurrentes (quotidiennes, jours de semaine, hebdo, mensuelles) se recréent automatiquement à la date suivante quand tu les termines.
              </div>
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}

function TaskRow({ t, showDate }: { t: Row; showDate?: boolean }) {
  const focus = useFocus();
  return (
    <div className="group flex items-center">
      <TaskCheck task={t} showDate={showDate} className="flex-1" />
      {t.recurrence && t.recurrence !== 'none' && <Repeat className="mr-2 h-3.5 w-3.5 text-muted" />}
      {t.focusMinutes > 0 && <span className="num mr-2 text-[11px] text-muted">{t.focusMinutes} min</span>}
      {t.status !== 'done' && (
        <button onClick={() => focus.start({ label: t.title, taskId: t.id, category: t.category })} className="mr-2 hidden h-8 w-8 place-items-center rounded-full text-muted hover:bg-petal hover:text-wine group-hover:grid" title="Mode focus">
          <Timer className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
