import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarClock, ListChecks, Target, Dumbbell, GraduationCap, Wallet, Gem, Flame, Plus, CalendarPlus, Receipt, Heart, Sparkles, Settings2, GripVertical, Eye, EyeOff,
  CloudSun, Sun, CloudRain, Cloud, Snowflake, CloudLightning, ArrowRight, Droplets, LineChart, CalendarDays, Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import { today, addDays, formatFr, startOfWeek, FR_DAYS, relativeDay, eachDay } from '@shared/dates';
import { categoryColor, CATEGORIES } from '@shared/registry';
import { eur } from '@shared/finance';
import { useApi, useList, useSettings, useSaveSetting, useInvalidate, type Row } from '@/lib/hooks';
import { Card, CardHeader, Button, Progress, Ring, Empty, Segmented, Badge } from '@/components/ui';
import { Page, CoverArt } from '@/components/layout/PageHeader';
import { TaskCheck, WaterQuick, useHabitDays, toggleHabit } from '@/components/widgets';
import { TrendChart, BarsChart } from '@/components/charts';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { askJadou } from '@/components/layout/Shell';
import { greeting, subtitleFor, cn, nf, pct } from '@/lib/utils';
import { uploadFiles } from '@/lib/api';

interface CalItem {
  id: string;
  source: string;
  sourceId: number;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  category: string;
  status?: string | null;
}

const WIDGETS: Record<string, string> = {
  focus: 'Today’s Focus',
  week: 'My Week',
  overview: 'Life Overview',
  water: 'Hydratation',
  quickActions: 'Quick Actions',
  progress: 'Monthly Progress',
  habits: 'Habitudes du jour',
  upcoming: 'À venir',
};

function useClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function WeatherIcon({ code }: { code?: number }) {
  const C = code == null ? CloudSun : code === 0 ? Sun : code <= 3 ? CloudSun : code <= 48 ? Cloud : code <= 67 || (code >= 80 && code <= 82) ? CloudRain : code <= 77 || code === 85 || code === 86 ? Snowflake : CloudLightning;
  return <C className="h-4 w-4" strokeWidth={1.7} />;
}

function Hero({ stats, agenda }: { stats: any; agenda: CalItem[] }) {
  const now = useClock();
  const { data: settings } = useSettings();
  const { data: weather } = useApi<any>('/weather', { refetchInterval: 30 * 60_000 });
  const save = useSaveSetting();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const photo = settings?.theme?.headerPhoto as string | undefined;
  const nick = settings?.profile?.nickname || 'Jadou';
  const nowStr = `${today()}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const next = agenda.find((i) => !i.allDay && i.start >= nowStr && i.start.slice(0, 10) === today()) ?? agenda.find((i) => i.start >= nowStr);
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 overflow-hidden rounded-[32px] border border-line/70">
      {photo ? (
        <>
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/80 to-canvas/0" />
        </>
      ) : (
        <CoverArt variant={0} />
      )}
      <div className="relative grid gap-6 p-6 sm:p-9 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="eyebrow mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-wine/80">
            <span>{formatFr(today(), { weekday: true, year: true })}</span>
            <span className="num">{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            {weather?.enabled && !weather.error && (
              <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                <WeatherIcon code={weather.code} /> {weather.temp}° · {weather.city}
              </span>
            )}
          </div>
          <h1 className="h-display text-[40px] leading-[1.02] sm:text-[58px]">
            {greeting(now)}, <em className="italic text-wine">{nick}</em> ♡
          </h1>
          <p className="mt-2 font-display text-xl italic text-ink/70 sm:text-2xl">{subtitleFor(now)}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <HeroChip icon={ListChecks} label={`${stats?.tasks.today ?? 0} tâche${(stats?.tasks.today ?? 0) > 1 ? 's' : ''} aujourd’hui`} to="/tasks" />
            {(stats?.tasks.overdue ?? 0) > 0 && <HeroChip icon={Flame} label={`${stats.tasks.overdue} en retard`} to="/tasks?view=overdue" warn />}
            <HeroChip icon={CalendarClock} label={next ? `${next.allDay ? relativeDay(next.start.slice(0, 10)) : next.start.slice(11, 16)} · ${next.title}` : 'Aucun rendez-vous à venir'} to="/calendar" />
            <HeroChip icon={Target} label={`${stats?.goals.active ?? 0} objectifs · ${stats?.goals.avg ?? 0} %`} to="/goals" />
          </div>
        </div>
        <div className="hidden items-end lg:flex">
          <Ring value={pct(stats?.tasks.doneToday ?? 0, (stats?.tasks.doneToday ?? 0) + (stats?.tasks.today ?? 0))} size={128} stroke={9}>
            <div className="text-center">
              <div className="num font-display text-3xl">{stats?.tasks.doneToday ?? 0}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted">faites</div>
            </div>
          </Ring>
        </div>
      </div>
      <div className="no-print absolute right-3 top-3 flex gap-1">
        <button onClick={() => fileRef.current?.click()} className="rounded-full bg-surface/70 px-3 py-1 text-[11px] text-muted backdrop-blur transition hover:text-wine">
          {photo ? 'Changer la photo' : '+ Ma photo'}
        </button>
        {photo && (
          <button onClick={() => save.mutate({ key: 'theme', value: { ...settings?.theme, headerPhoto: null } })} className="rounded-full bg-surface/70 px-2 py-1 text-[11px] text-muted backdrop-blur hover:text-bad">
            ✕
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            const [f] = await uploadFiles(e.target.files);
            save.mutate({ key: 'theme', value: { ...settings?.theme, headerPhoto: f.url } });
          }}
        />
      </div>
    </motion.section>
  );
}

function HeroChip({ icon: Icon, label, to, warn }: { icon: any; label: string; to: string; warn?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex max-w-full items-center gap-2 rounded-full border bg-surface/80 px-3.5 py-2 text-xs font-medium backdrop-blur transition hover:-translate-y-0.5 hover:shadow-card', warn ? 'border-bad/20 text-bad' : 'border-line text-ink/80')}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// ------------------------------------------------------------------ widgets
function FocusWidget() {
  const { data: tasks = [] } = useList('task', { where: { OR: [{ date: today() }, { date: { lt: today() }, status: { not: 'done' } }, { focus: true, status: { not: 'done' } }] } });
  const open = useRecordDialog();
  const rank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const focus = tasks.filter((t) => t.focus && (t.status !== 'done' || t.date === today()));
  const auto = tasks.filter((t) => t.status !== 'done').sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || String(a.time ?? '99').localeCompare(String(b.time ?? '99')));
  const list = (focus.length ? focus : auto).slice(0, 3);
  const rest = tasks.filter((t) => !list.includes(t) && t.date === today());
  return (
    <Card className="h-full">
      <CardHeader icon={Sparkles} eyebrow="Mes 3 priorités" title="Today’s Focus" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'task', defaults: { date: today(), focus: true, priority: 'high' } })}>Priorité</Button>} />
      <div className="p-2 pb-3">
        {list.length === 0 ? (
          <Empty title="Journée libre" text="Ajoute tes trois priorités pour démarrer la journée avec clarté." className="py-6" />
        ) : (
          list.map((t, i) => (
            <div key={t.id} className="flex items-center gap-1">
              <span className="w-7 shrink-0 text-center font-display text-2xl italic text-blush">{i + 1}</span>
              <TaskCheck task={t} className="flex-1" />
            </div>
          ))
        )}
        {!focus.length && list.length > 0 && <p className="px-4 pt-1 text-[11px] text-muted">Proposées automatiquement selon la priorité — coche « Priorité du jour » dans une tâche pour choisir toi-même.</p>}
        {rest.length > 0 && (
          <Link to="/tasks" className="mx-3 mt-2 flex items-center justify-between rounded-xl bg-sunken/60 px-3 py-2 text-xs text-muted hover:text-ink">
            + {rest.length} autre{rest.length > 1 ? 's' : ''} tâche{rest.length > 1 ? 's' : ''} aujourd’hui <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </Card>
  );
}

function WeekWidget({ agenda }: { agenda: CalItem[] }) {
  const mon = startOfWeek(today());
  const days = eachDay(mon, addDays(mon, 6));
  const nav = useNavigate();
  const legend = CATEGORIES.filter((c) => agenda.some((i) => i.category === c.value));
  return (
    <Card>
      <CardHeader icon={CalendarDays} eyebrow={`Semaine du ${formatFr(mon)}`} title="My Week" action={<Link to="/calendar" className="text-xs font-medium text-wine hover:underline">Calendrier →</Link>} />
      <div className="grid grid-cols-7 gap-1.5 overflow-x-auto p-4 sm:gap-2 sm:p-5">
        {days.map((d) => {
          const items = agenda.filter((i) => i.start.slice(0, 10) === d || (i.allDay && i.end && i.start.slice(0, 10) < d && i.end.slice(0, 10) > d));
          const isToday = d === today();
          return (
            <button key={d} onClick={() => nav(`/calendar?date=${d}&view=timeGridDay`)} className={cn('flex min-h-[132px] min-w-0 flex-col rounded-2xl border p-1.5 text-left transition hover:border-wine/30 sm:p-2', isToday ? 'border-wine/30 bg-petal/60' : 'border-line/70 bg-surface')}>
              <div className="mb-1.5 flex items-baseline justify-between px-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{FR_DAYS[new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)).getDay()].slice(0, 3)}</span>
                <span className={cn('num font-display text-lg leading-none', isToday && 'text-wine')}>{+d.slice(8)}</span>
              </div>
              <div className="space-y-1">
                {items.slice(0, 4).map((i) => (
                  <div key={i.id} className="truncate rounded-md px-1 py-0.5 text-[10px] font-medium leading-tight sm:px-1.5" style={{ background: `${categoryColor(i.category)}22`, borderLeft: `2px solid ${categoryColor(i.category)}` }} title={i.title}>
                    {!i.allDay && <span className="text-muted">{i.start.slice(11, 16)} </span>}
                    {i.title}
                  </div>
                ))}
                {items.length > 4 && <div className="px-1 text-[10px] text-muted">+{items.length - 4}</div>}
              </div>
            </button>
          );
        })}
      </div>
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-3 px-5 pb-4 text-[11px] text-muted">
          {legend.map((c) => (
            <span key={c.value} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function OverviewCard({ to, icon: Icon, label, value, sub, progress, color }: { to: string; icon: any; label: string; value: React.ReactNode; sub: React.ReactNode; progress?: number; color?: string }) {
  return (
    <Link to={to}>
      <Card hover className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{label}</span>
          <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: `${color}1F`, color }}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        </div>
        <div className="num mt-3 font-display text-[28px] leading-none">{value}</div>
        <div className="mt-1.5 text-xs text-muted">{sub}</div>
        {progress !== undefined && <Progress value={progress} className="mt-auto pt-0" color={color} />}
      </Card>
    </Link>
  );
}

function OverviewWidget({ s }: { s: any }) {
  if (!s) return null;
  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="h-display text-[26px]">
          Life <em className="text-wine">Overview</em>
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <OverviewCard to="/fitness" icon={Dumbbell} label="Fitness" color="#D4876C" value={`${s.fitness.weekDone}/${s.fitness.weekGoal}`} sub="séances cette semaine" progress={pct(s.fitness.weekDone, s.fitness.weekGoal)} />
        <OverviewCard to="/studies" icon={GraduationCap} label="Studies" color="#8E7DBE" value={s.studies.homeworkOpen} sub={s.studies.exams[0] ? `devoirs · examen ${relativeDay(s.studies.exams[0].date)}` : `devoir${s.studies.homeworkOpen > 1 ? 's' : ''} à rendre`} />
        <OverviewCard to="/banks" icon={Wallet} label="Money" color="#713F4B" value={s.money.hasAccounts ? eur(s.money.available) : '—'} sub={s.money.hasAccounts ? `${eur(s.money.income)} in · ${eur(s.money.expense)} out · épargne ${eur(s.money.savingsBalance)}` : 'Ajoute tes comptes'} />
        <OverviewCard to="/lash" icon={Gem} label="Lash Business" color="#C98B9B" value={eur(s.lash.month)} sub={`${s.lash.monthCount} RDV ce mois · ${s.lash.upcomingCount} à venir`} />
        <OverviewCard to="/goals" icon={Target} label="Goals" color="#C9A35F" value={`${s.goals.avg} %`} sub={`${s.goals.active} objectifs actifs`} progress={s.goals.avg} />
        <OverviewCard to="/habits" icon={Flame} label="Habits" color="#5E8C8A" value={`${s.habits.done}/${s.habits.total}`} sub="habitudes aujourd’hui" progress={pct(s.habits.done, s.habits.total)} />
      </div>
    </div>
  );
}

function QuickActions() {
  const open = useRecordDialog();
  const actions = [
    { label: 'Add Task', icon: ListChecks, on: () => open({ resource: 'task', defaults: { date: today() } }) },
    { label: 'Add Appointment', icon: CalendarPlus, on: () => open({ resource: 'event', defaults: { start: `${today()}T10:00` } }) },
    { label: 'Add Expense', icon: Receipt, on: () => open({ resource: 'transaction', defaults: { type: 'expense', date: today() } }) },
    { label: 'Add Workout', icon: Dumbbell, on: () => open({ resource: 'workoutSession', defaults: { date: today(), status: 'planned', name: 'Séance' } }) },
    { label: 'Add Wishlist Item', icon: Heart, on: () => open({ resource: 'wishlistItem' }) },
    { label: 'Ask Jadou AI', icon: Sparkles, on: askJadou, accent: true },
  ];
  return (
    <Card className="p-4 sm:p-5">
      <div className="eyebrow mb-3">Quick Actions</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {actions.map((a) => (
          <button key={a.label} onClick={a.on} className={cn('flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center text-[11px] font-medium transition hover:-translate-y-0.5', a.accent ? 'bg-wine text-onwine shadow-lift' : 'bg-sunken/70 text-ink hover:bg-petal')}>
            <a.icon className="h-5 w-5" strokeWidth={1.6} />
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function ProgressWidget() {
  const [tab, setTab] = React.useState<'money' | 'sport' | 'toeic' | 'income'>('money');
  const { data: series = [] } = useApi<any[]>('/stats/money-series?months=6');
  const from = addDays(startOfWeek(today()), -7 * 7);
  const { data: sessions = [] } = useList('workoutSession', { where: { status: 'done', date: { gte: from } } });
  const { data: attempts = [] } = useList('toeicAttempt', { where: { date: { gte: from } } });
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(from, i * 7));
  const sport = weeks.map((w) => ({ week: w, séances: sessions.filter((s) => s.date >= w && s.date < addDays(w, 7)).length }));
  const toeic = weeks.map((w) => {
    const a = attempts.filter((x) => x.date >= w && x.date < addDays(w, 7));
    const tot = a.reduce((s, x) => s + x.total, 0);
    return { week: w, réussite: tot ? Math.round((a.reduce((s, x) => s + x.score, 0) / tot) * 100) : null };
  });
  const monthLabel = (m: string) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
  const weekLabel = (w: string) => formatFr(w).replace(/ \w+$/, (m) => m.slice(0, 4));
  const empty = (tab === 'money' || tab === 'income') && series.every((s) => !s.income && !s.expense && !s.balance);
  return (
    <Card>
      <CardHeader icon={LineChart} eyebrow="Données réelles" title="Monthly Progress" action={<Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'money', label: 'Épargne' }, { value: 'income', label: 'Revenus' }, { value: 'sport', label: 'Sport' }, { value: 'toeic', label: 'TOEIC' }]} />} />
      <div className="p-4 sm:p-5">
        {empty ? (
          <Empty icon={Wallet} title="Pas encore de données" text="Ajoute tes comptes et transactions dans My Banks pour voir ton évolution." className="py-8" />
        ) : tab === 'money' ? (
          <TrendChart data={series} x="month" labelFmt={monthLabel} fmt="eur" series={[{ key: 'balance', name: 'Solde total des comptes' }]} />
        ) : tab === 'income' ? (
          <BarsChart data={series} x="month" labelFmt={monthLabel} fmt="eur" series={[{ key: 'income', name: 'Revenus' }, { key: 'expense', name: 'Dépenses' }]} />
        ) : tab === 'sport' ? (
          sessions.length ? <BarsChart data={sport} x="week" labelFmt={weekLabel} series={[{ key: 'séances', name: 'Séances réalisées' }]} /> : <Empty icon={Dumbbell} title="Aucune séance réalisée" text="Lance ta première séance dans Fitness." className="py-8" />
        ) : attempts.length ? (
          <TrendChart type="line" data={toeic} x="week" labelFmt={weekLabel} fmt="pct" series={[{ key: 'réussite', name: 'Taux de réussite' }]} />
        ) : (
          <Empty icon={GraduationCap} title="Aucun entraînement TOEIC" text="Fais un premier exercice dans TOEIC Academy." className="py-8" />
        )}
      </div>
    </Card>
  );
}

function HabitsWidget() {
  const { data: habits = [] } = useList('habit', { where: { active: true } });
  const { data: logs = [] } = useList('habitLog', { where: { date: today() } });
  const days = useHabitDays(today(), today());
  const invalidate = useInvalidate();
  return (
    <Card className="h-full">
      <CardHeader icon={Flame} eyebrow="Aujourd’hui" title="Habitudes" action={<Link to="/habits" className="text-xs font-medium text-wine hover:underline">Tracker →</Link>} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:p-5">
        {habits.length === 0 && <Empty title="Aucune habitude" className="col-span-2 py-4" />}
        {habits.map((h) => {
          const st = days(h);
          const done = st.has(today());
          return (
            <button
              key={h.id}
              disabled={st.isAuto(today())}
              onClick={async () => {
                await toggleHabit(h.id, today(), logs);
                invalidate();
              }}
              className={cn('flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs font-medium transition', done ? 'border-transparent text-onwine' : 'border-line hover:border-wine/30')}
              style={done ? { background: h.color } : undefined}
              title={st.isAuto(today()) ? 'Validée automatiquement' : undefined}
            >
              <span className="text-base">{h.emoji}</span>
              <span className="truncate">{h.name}</span>
              {done && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function UpcomingWidget({ agenda }: { agenda: CalItem[] }) {
  const items = agenda.filter((i) => i.start.slice(0, 10) >= today()).slice(0, 7);
  return (
    <Card className="h-full">
      <CardHeader icon={CalendarClock} eyebrow="7 prochains jours" title="À venir" />
      <div className="space-y-1 p-3">
        {items.length === 0 && <Empty title="Rien de prévu" text="Ta semaine est libre." className="py-6" />}
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
            <div className="w-12 shrink-0 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted">{relativeDay(i.start.slice(0, 10)).replace('aujourd’hui', 'auj.')}</div>
              <div className="num text-xs font-semibold">{i.allDay ? '—' : i.start.slice(11, 16)}</div>
            </div>
            <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: categoryColor(i.category) }} />
            <div className="min-w-0 truncate text-sm">{i.title}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WaterWidget() {
  return (
    <Card className="h-full">
      <CardHeader icon={Droplets} eyebrow="Water Tracker" title="Hydratation" action={<Link to="/water" className="text-xs font-medium text-wine hover:underline">Historique →</Link>} />
      <div className="p-5">
        <WaterQuick />
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ layout
function SortableItem({ id, editing, hidden, onToggle, children }: { id: string; editing: boolean; hidden: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editing });
  if (!editing && hidden) return null;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('relative', isDragging && 'z-10 opacity-80')}>
      {editing ? (
        <div className={cn('flex items-center gap-3 rounded-2xl border border-dashed border-wine/30 bg-surface px-4 py-3', hidden && 'opacity-50')}>
          <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted" aria-label="Déplacer">
            <GripVertical className="h-5 w-5" />
          </button>
          <span className="font-medium">{WIDGETS[id]}</span>
          <button onClick={onToggle} className="chip ml-auto">
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {hidden ? 'Masqué' : 'Visible'}
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function Dashboard() {
  const { data: stats } = useApi<any>('/stats/dashboard');
  const mon = startOfWeek(today());
  const { data: agenda = [] } = useApi<CalItem[]>(`/calendar?from=${mon}&to=${addDays(today(), 7) > addDays(mon, 6) ? addDays(today(), 7) : addDays(mon, 6)}`);
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const [editing, setEditing] = React.useState(false);
  const cfg = settings?.dashboard ?? { widgets: Object.keys(WIDGETS), hidden: [] };
  const order: string[] = [...cfg.widgets.filter((w: string) => WIDGETS[w]), ...Object.keys(WIDGETS).filter((w) => !cfg.widgets.includes(w))];
  const hidden: string[] = cfg.hidden ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)));
    save.mutate({ key: 'dashboard', value: { ...cfg, widgets: next } });
  };
  const toggle = (id: string) => save.mutate({ key: 'dashboard', value: { ...cfg, hidden: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id] } });

  // pair small widgets side by side
  const render = (id: string): React.ReactNode => {
    switch (id) {
      case 'focus':
        return <FocusWidget />;
      case 'week':
        return <WeekWidget agenda={agenda} />;
      case 'overview':
        return <OverviewWidget s={stats} />;
      case 'water':
        return <WaterWidget />;
      case 'quickActions':
        return <QuickActions />;
      case 'progress':
        return <ProgressWidget />;
      case 'habits':
        return <HabitsWidget />;
      case 'upcoming':
        return <UpcomingWidget agenda={agenda} />;
    }
  };
  const visible = order.filter((w) => !hidden.includes(w));
  const pairable = new Set(['focus', 'water', 'habits', 'upcoming']);
  const rows: string[][] = [];
  for (const w of visible) {
    const last = rows[rows.length - 1];
    if (last && last.length === 1 && pairable.has(last[0]) && pairable.has(w)) last.push(w);
    else rows.push([w]);
  }

  return (
    <Page>
      <Hero stats={stats} agenda={agenda} />
      <div className="no-print mb-4 flex justify-end">
        <Button size="sm" variant={editing ? 'primary' : 'ghost'} icon={Settings2} onClick={() => setEditing(!editing)}>
          {editing ? 'Terminer' : 'Personnaliser'}
        </Button>
      </div>
      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="mx-auto max-w-xl space-y-2">
              <p className="mb-3 text-center text-sm text-muted">Glisse pour réorganiser, masque les cartes inutiles.</p>
              {order.map((id) => (
                <SortableItem key={id} id={id} editing hidden={hidden.includes(id)} onToggle={() => toggle(id)}>
                  {null}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-5">
          {rows.map((r) => (
            <motion.div key={r.join('-')} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45 }} className={cn(r.length === 2 && 'grid gap-5 lg:grid-cols-2')}>
              {r.map((w) => (
                <React.Fragment key={w}>{render(w)}</React.Fragment>
              ))}
            </motion.div>
          ))}
        </div>
      )}
      {stats && !stats.money.hasAccounts && (
        <Card className="mt-5 flex flex-col items-start gap-3 bg-petal/50 p-5 sm:flex-row sm:items-center">
          <Badge color="#713F4B">Premiers pas</Badge>
          <p className="flex-1 text-sm text-ink/80">Pour des statistiques complètes : ajoute tes comptes bancaires, tes prestations cils (prix), tes matières et ta date de TOEIC.</p>
          <Link to="/banks">
            <Button size="sm" variant="outline">
              Commencer <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      )}
      <p className="mt-6 text-center text-[11px] text-muted">{nf(0) === '0' ? '' : ''}Toutes les statistiques sont calculées à partir de tes données réelles.</p>
    </Page>
  );
}
