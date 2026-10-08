import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Sun, Wallet, GraduationCap, Briefcase, Dumbbell, User, StickyNote, Pin, Lightbulb } from 'lucide-react';
import { today, addDays, formatFr, relativeDay, diffDays } from '@shared/dates';
import { eur } from '@shared/finance';
import { categoryColor } from '@shared/registry';
import { useApi, useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, Empty, Badge, Button } from '@/components/ui';
import { TaskCheck } from '@/components/widgets';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn } from '@/lib/utils';

function Line({ title, sub, color, onClick, to }: { title: string; sub?: string; color?: string; onClick?: () => void; to?: string }) {
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-sunken/70">
      <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: color ?? 'rgb(var(--blush))' }} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return (
    <button className="w-full text-left" onClick={onClick}>
      {inner}
    </button>
  );
}

function Block({ title, icon, children, empty, count, className }: { title: string; icon: any; children: React.ReactNode; empty?: boolean; count?: number; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader icon={icon} title={title} action={count ? <Badge>{count}</Badge> : undefined} />
      <div className="flex-1 p-2 pb-3">{empty ? <div className="px-4 py-5 text-sm text-muted">Rien qui demande ton attention ♡</div> : children}</div>
    </Card>
  );
}

export function CommandCenter() {
  const t0 = today();
  const { data: s } = useApi<any>('/stats/dashboard');
  const { data: notices = [] } = useApi<any[]>('/notifications');
  const { data: tasks = [] } = useList('task', { where: { status: { not: 'done' }, date: { lte: addDays(t0, 7) } } });
  const { data: agenda = [] } = useApi<any[]>(`/calendar?from=${t0}&to=${addDays(t0, 7)}`);
  const { data: notes = [] } = useList('note');
  const { data: posts = [] } = useList('contentPost', { where: { date: { gte: t0, lte: addDays(t0, 7) }, status: { not: 'published' } } });
  const open = useRecordDialog();
  const invalidate = useInvalidate();

  const urgent = tasks.filter((t) => (t.date && t.date < t0) || t.priority === 'urgent');
  const todayT = tasks.filter((t) => t.date === t0 && !urgent.includes(t));
  const byCat = (cats: string[]) => tasks.filter((t) => cats.includes(t.category) && !urgent.includes(t) && t.date !== t0);
  const ag = (cats: string[]) => agenda.filter((i) => cats.includes(i.category) && i.source !== 'task');

  const money = s?.money;
  const pinned = notes.filter((n) => n.pinned);
  const ideas = notes.filter((n) => !n.pinned).slice(0, 8);

  return (
    <Page>
      <PageHeader eyebrow="Home" title="Command" accent="Center" subtitle="Tout ce qui demande ton attention, au même endroit." coverKey="command" variant={2} compact />
      <div className="grid gap-5 lg:grid-cols-3">
        <Block title="Urgent" icon={AlertTriangle} count={urgent.length + notices.filter((n) => n.level === 'urgent').length} empty={!urgent.length && !notices.some((n) => n.level !== 'info')} className="border-bad/20 lg:col-span-1">
          {notices
            .filter((n) => n.level !== 'info')
            .map((n) => (
              <Line key={n.id} title={n.title} sub={n.body} color={n.level === 'urgent' ? 'rgb(var(--bad))' : 'rgb(var(--warn))'} to={n.link} />
            ))}
          {urgent.map((t) => (
            <TaskCheck key={t.id} task={t} showDate />
          ))}
        </Block>
        <Block title="Today" icon={Sun} count={todayT.length} empty={!todayT.length && !agenda.some((i) => i.start.slice(0, 10) === t0)}>
          {agenda
            .filter((i) => i.start.slice(0, 10) === t0 && i.source !== 'task')
            .map((i) => (
              <Line key={i.id} title={i.title} sub={i.allDay ? 'Toute la journée' : i.start.slice(11, 16)} color={categoryColor(i.category)} to="/calendar" />
            ))}
          {todayT.map((t) => (
            <TaskCheck key={t.id} task={t} />
          ))}
        </Block>
        <Block title="Money" icon={Wallet} empty={!money?.hasAccounts}>
          {money && (
            <div className="space-y-2 px-3 py-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Disponible</span>
                <span className="num font-semibold">{eur(money.available, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Ce mois · revenus / dépenses</span>
                <span className="num">
                  {eur(money.income)} / {eur(money.expense)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Solde prévisionnel</span>
                <span className="num font-semibold">{eur(money.forecast)}</span>
              </div>
              {money.budget.hasBudget && money.expense > money.budget.plannedOut && <div className="rounded-xl bg-bad/5 px-3 py-2 text-xs text-bad">Dépenses au-dessus du budget prévu ({eur(money.budget.plannedOut)})</div>}
              {ag(['finance']).map((i) => (
                <Line key={i.id} title={i.title} sub={relativeDay(i.start.slice(0, 10))} color={categoryColor('finance')} to="/calendar" />
              ))}
            </div>
          )}
        </Block>
        <Block title="Studies" icon={GraduationCap} empty={!s?.studies.nextHomework.length && !s?.studies.exams.length && !byCat(['devoirs', 'cours', 'toeic']).length}>
          {s?.studies.nextHomework.map((h: Row) => (
            <Line key={h.id} title={h.title} sub={`À rendre ${relativeDay(h.dueDate)}${diffDays(h.dueDate, t0) < 0 ? ' · en retard' : ''}`} color={categoryColor('devoirs')} onClick={() => open({ resource: 'homework', id: h.id })} />
          ))}
          {s?.studies.exams.map((e: Row) => (
            <Line key={e.id} title={`Examen · ${e.title}`} sub={formatFr(e.date, { weekday: true })} color={categoryColor('cours')} onClick={() => open({ resource: 'exam', id: e.id })} />
          ))}
          {byCat(['toeic']).map((t) => (
            <TaskCheck key={t.id} task={t} showDate />
          ))}
        </Block>
        <Block title="Business" icon={Briefcase} empty={!ag(['cils', 'airbnb', 'alternance', 'business']).length && !posts.length && !s?.lash.lowStock.length}>
          {ag(['cils', 'airbnb', 'alternance', 'business']).slice(0, 8).map((i) => (
            <Line key={i.id} title={i.title} sub={`${relativeDay(i.start.slice(0, 10))}${i.allDay ? '' : ' · ' + i.start.slice(11, 16)}`} color={categoryColor(i.category)} to="/calendar" />
          ))}
          {s?.lash.unpaid > 0 && <Line title={`${s.lash.unpaid} RDV cils réalisé(s) non encaissé(s)`} color="rgb(var(--warn))" to="/lash" />}
          {s?.lash.lowStock.length > 0 && <Line title="Stock bas" sub={s.lash.lowStock.join(', ')} color="rgb(var(--warn))" to="/lash" />}
        </Block>
        <Block title="Fitness" icon={Dumbbell} empty={false}>
          {s && (
            <div className="px-3 py-1 text-sm">
              <div className="mb-2 text-muted">
                {s.fitness.weekDone}/{s.fitness.weekGoal} séances cette semaine · eau {s.water.ml} / {s.water.goal} ml
              </div>
              {ag(['sport']).slice(0, 5).map((i) => (
                <Line key={i.id} title={i.title} sub={relativeDay(i.start.slice(0, 10))} color={categoryColor('sport')} to="/fitness" />
              ))}
            </div>
          )}
        </Block>
        <Block title="Personal" icon={User} empty={!byCat(['perso', 'beaute', 'sante', 'voyage']).length && !ag(['perso', 'beaute', 'sante', 'voyage']).length} className="lg:col-span-1">
          {ag(['perso', 'beaute', 'sante', 'voyage']).map((i) => (
            <Line key={i.id} title={i.title} sub={relativeDay(i.start.slice(0, 10))} color={categoryColor(i.category)} to="/calendar" />
          ))}
          {byCat(['perso', 'beaute', 'sante', 'voyage']).map((t) => (
            <TaskCheck key={t.id} task={t} showDate />
          ))}
        </Block>
        <Card className="lg:col-span-2">
          <CardHeader icon={StickyNote} title="Notes & idées rapides" action={<Button size="sm" variant="soft" onClick={() => open({ resource: 'note' })}>+ Note</Button>} />
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {[...pinned, ...ideas].length === 0 && <Empty title="Aucune note" text="Capture une idée avec Quick Add (⌘J)." className="col-span-2 py-4" />}
            {[...pinned, ...ideas].map((n) => (
              <div key={n.id} onClick={() => open({ resource: 'note', id: n.id })} className={cn('group relative cursor-pointer rounded-2xl border p-3 text-sm transition hover:shadow-card', n.pinned ? 'border-blush bg-petal/60' : 'border-line')}>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
                  {n.kind === 'idea' ? <Lightbulb className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />}
                  {formatFr(n.createdAt.slice(0, 10))}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await api(`/r/note/${n.id}`, { method: 'PATCH', body: { pinned: !n.pinned } });
                      invalidate();
                    }}
                    className={cn('ml-auto', n.pinned ? 'text-wine' : 'opacity-0 group-hover:opacity-100')}
                    aria-label="Épingler"
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap">{n.content}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
