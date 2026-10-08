import * as React from 'react';
import { Plus, GraduationCap, BookOpen, Users, CalendarClock, Award, Check, Clock } from 'lucide-react';
import { today, addDays, formatFr, diffDays, relativeDay } from '@shared/dates';
import { categoryColor, PRIORITIES, optionColor, optionLabel, TASK_STATUS } from '@shared/registry';
import { useApi, useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge, Modal, Progress } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TaskCheck } from '@/components/widgets';
import { cn, nf, pct } from '@/lib/utils';

function Countdown({ date, time }: { date: string; time?: string | null }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), time ? +time.slice(0, 2) : 23, time ? +time.slice(3, 5) : 59).getTime();
  const ms = target - now;
  if (ms < 0) return <span className="font-semibold text-bad">En retard</span>;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return (
    <span className={cn('num font-semibold', d < 2 ? 'text-bad' : d < 5 ? 'text-warn' : 'text-ink')}>
      {d > 0 ? `${d} j ${h} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`}
    </span>
  );
}

export function courseAverages(courses: Row[], grades: Row[]) {
  const rows = courses.map((c) => {
    const gs = grades.filter((g) => g.courseId === c.id);
    const cw = gs.reduce((s, g) => s + (g.coefficient ?? 1), 0);
    const avg = gs.length ? gs.reduce((s, g) => s + (g.value / (g.outOf || 20)) * 20 * (g.coefficient ?? 1), 0) / cw : null;
    return { course: c, grades: gs, avg };
  });
  const scored = rows.filter((r) => r.avg != null);
  const den = scored.reduce((s, r) => s + (r.course.coefficient ?? 1), 0);
  const overall = den ? scored.reduce((s, r) => s + r.avg! * (r.course.coefficient ?? 1), 0) / den : null;
  return { rows, overall };
}

function ProjectModal({ project, onClose }: { project: Row | null; onClose: () => void }) {
  const { data: tasks = [] } = useList('task', { where: { projectId: project?.id ?? -1 } }, { enabled: !!project });
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  if (!project) return null;
  const p = pct(tasks.filter((t) => t.status === 'done').length, tasks.length);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={project.title} description={project.members ? `Membres : ${project.members}` : undefined} size="xl" footer={<><Button variant="ghost" onClick={() => open({ resource: 'groupProject', id: project.id })}>Modifier le projet</Button><Button onClick={onClose}>Fermer</Button></>}>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="min-w-[200px] flex-1"><div className="mb-1 flex justify-between text-xs text-muted"><span>Progression</span><span>{p} %</span></div><Progress value={p} /></div>
        {project.dueDate && <Badge color={categoryColor('devoirs')}>Rendu {formatFr(project.dueDate, { weekday: true })}</Badge>}
        <Button size="sm" icon={Plus} onClick={() => open({ resource: 'task', defaults: { projectId: project.id, category: 'devoirs', date: project.dueDate }, title: 'Nouvelle tâche du projet' })}>Tâche</Button>
      </div>
      {project.description && <p className="mb-4 whitespace-pre-wrap text-sm text-ink/80">{project.description}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {TASK_STATUS.map((s) => (
          <div key={s.value} className="rounded-3xl bg-sunken/60 p-3">
            <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}<span className="text-xs text-muted">{tasks.filter((t) => t.status === s.value).length}</span></div>
            <div className="space-y-2">
              {tasks.filter((t) => t.status === s.value).map((t) => (
                <div key={t.id} className="card p-3 text-sm">
                  <div className="cursor-pointer font-medium" onClick={() => open({ resource: 'task', id: t.id })}>{t.title}</div>
                  {t.notes && <div className="mt-1 line-clamp-2 text-xs text-muted">{t.notes}</div>}
                  <div className="mt-2 flex gap-1">
                    {TASK_STATUS.filter((x) => x.value !== s.value).map((x) => (
                      <button key={x.value} className="chip px-2 py-0.5 text-[10px]" onClick={async () => { await api(`/r/task/${t.id}`, { method: 'PATCH', body: { status: x.value } }); invalidate(); }}>→ {x.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {(project.documents || project.notes) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {project.documents && <Card className="p-4 text-sm"><div className="eyebrow mb-1">Documents</div><Links text={project.documents} /></Card>}
          {project.notes && <Card className="p-4 text-sm"><div className="eyebrow mb-1">Notes</div><p className="whitespace-pre-wrap">{project.notes}</p></Card>}
        </div>
      )}
    </Modal>
  );
}

export function Links({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split(/\n|\s(?=https?:)/).filter(Boolean).map((l, i) => {
        const url = l.match(/https?:\/\/\S+/)?.[0];
        return url ? <a key={i} href={url} target="_blank" rel="noreferrer" className="block truncate text-wine hover:underline">{l.replace(url, '').trim() || url}</a> : <div key={i}>{l}</div>;
      })}
    </div>
  );
}

export function StudiesPage() {
  const [tab, setTab] = React.useState<'dashboard' | 'homework' | 'exams' | 'projects' | 'grades' | 'schedule'>('dashboard');
  const t0 = today();
  const { data: homework = [] } = useList('homework');
  const { data: exams = [] } = useList('exam');
  const { data: courses = [] } = useList('course');
  const { data: grades = [] } = useList('grade');
  const { data: projects = [] } = useList('groupProject');
  const { data: projectTasks = [] } = useList('task', { where: { projectId: { not: null } } });
  const { data: agenda = [] } = useApi<any[]>(`/calendar?from=${t0}&to=${addDays(t0, 13)}`);
  const open = useRecordDialog();
  const [project, setProject] = React.useState<Row | null>(null);
  const courseName = (id: number) => courses.find((c) => c.id === id)?.name;
  const open_ = homework.filter((h) => h.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextExams = exams.filter((e) => e.date >= t0).sort((a, b) => a.date.localeCompare(b.date));
  const classes = agenda.filter((i) => i.category === 'cours' && i.source === 'event');
  const { rows: avgRows, overall } = courseAverages(courses, grades);

  return (
    <Page>
      <PageHeader eyebrow="Studies & Career" title="My" accent="Master" subtitle="Master Marketing · INSEEC Grande École" coverKey="studies" variant={1} actions={<><Button icon={Plus} onClick={() => open({ resource: 'homework', defaults: { dueDate: addDays(t0, 7) } })}>Devoir</Button><Button variant="outline" icon={Plus} onClick={() => open({ resource: 'event', defaults: { category: 'cours', start: `${t0}T09:00`, recurrence: 'weekly' }, title: 'Nouveau cours (emploi du temps)' })}>Cours</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'homework', label: `Devoirs ${open_.length || ''}` }, { value: 'exams', label: 'Examens' }, { value: 'projects', label: 'Projets de groupe' }, { value: 'grades', label: 'Notes' }, { value: 'schedule', label: 'Matières & EDT' }]} />

      {tab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Devoirs à rendre" value={open_.length} icon={BookOpen} sub={`${open_.filter((h) => h.dueDate < t0).length} en retard`} />
            <Stat label="Prochain examen" value={nextExams[0] ? relativeDay(nextExams[0].date) : '—'} icon={CalendarClock} sub={nextExams[0]?.title} />
            <Stat label="Moyenne générale" value={overall != null ? `${nf(overall, 2)}/20` : '—'} icon={Award} sub="pondérée par coefficients" />
            <Stat label="Projets de groupe" value={projects.length} icon={Users} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Clock} title="Devoirs — compte à rebours" />
              <div className="space-y-2 p-4">
                {open_.length === 0 && <Empty title="Tout est rendu ✨" className="py-4" />}
                {open_.slice(0, 6).map((h) => (
                  <button key={h.id} onClick={() => open({ resource: 'homework', id: h.id })} className="flex w-full items-center gap-3 rounded-2xl border border-line/70 p-3 text-left transition hover:border-wine/30">
                    <span className="h-10 w-1 rounded-full" style={{ background: optionColor(PRIORITIES, h.priority) }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{h.title}</div>
                      <div className="text-xs text-muted">{courseName(h.courseId) ?? 'Sans matière'} · {formatFr(h.dueDate, { weekday: true })}{h.dueTime ? ` ${h.dueTime}` : ''}</div>
                    </div>
                    <Countdown date={h.dueDate} time={h.dueTime} />
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={GraduationCap} title="Prochains cours (14 jours)" />
              <div className="p-3">
                {classes.length === 0 ? <Empty title="Emploi du temps vide" text="Ajoute tes cours (récurrents chaque semaine) : ils apparaîtront ici et dans My Calendar." action={<Button size="sm" variant="soft" onClick={() => open({ resource: 'event', defaults: { category: 'cours', start: `${t0}T09:00`, recurrence: 'weekly' } })}>Ajouter un cours</Button>} className="py-4" /> :
                  classes.slice(0, 8).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                      <span className="w-28 text-xs capitalize text-muted">{relativeDay(c.start.slice(0, 10))} · {c.start.slice(11, 16)}</span>
                      <span className="flex-1 truncate text-sm font-medium">{c.title}</span>
                      {c.meta?.location && <span className="text-xs text-muted">{c.meta.location}</span>}
                    </div>
                  ))}
              </div>
            </Card>
          </div>
          {nextExams.length > 0 && (
            <Card>
              <CardHeader title="Examens à venir" />
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {nextExams.slice(0, 4).map((e) => (
                  <button key={e.id} onClick={() => open({ resource: 'exam', id: e.id })} className="rounded-2xl bg-petal/60 p-4 text-left">
                    <div className="num font-display text-3xl text-wine">J-{diffDays(e.date, t0)}</div>
                    <div className="mt-1 font-medium">{e.title}</div>
                    <div className="text-xs text-muted">{courseName(e.courseId)} · {formatFr(e.date, { weekday: true })}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'homework' && <ResourceTable resource="homework" title="Homework Manager" defaults={{ dueDate: addDays(t0, 7) }} filterField="status" emptyText="Chaque devoir apparaît aussi dans My Tasks et My Calendar." />}
      {tab === 'exams' && <ResourceTable resource="exam" title="Examens" defaults={{ date: addDays(t0, 14) }} />}
      {tab === 'projects' && (
        <div className="space-y-4">
          <Button icon={Plus} onClick={() => open({ resource: 'groupProject' })}>Projet de groupe</Button>
          {projects.length === 0 ? <Card><Empty icon={Users} title="Aucun projet de groupe" text="Membres, répartition des tâches, documents, notes, progression et kanban." /></Card> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => {
                const ts = projectTasks.filter((t) => t.projectId === p.id);
                const pr = pct(ts.filter((t) => t.status === 'done').length, ts.length);
                return (
                  <Card key={p.id} hover className="cursor-pointer p-5" onClick={() => setProject(p)}>
                    <div className="mb-1 text-xs text-muted">{courseName(p.courseId) ?? 'Projet'}</div>
                    <div className="font-display text-2xl">{p.title}</div>
                    {p.members && <div className="mt-2 flex flex-wrap gap-1">{p.members.split(/[,;]/).map((m: string) => <Badge key={m}>{m.trim()}</Badge>)}</div>}
                    <div className="mt-4 flex justify-between text-xs text-muted"><span>{ts.length} tâches</span><span>{pr} %</span></div>
                    <Progress value={pr} className="mt-1" />
                    {p.dueDate && <div className="mt-3 text-xs text-muted">Rendu {formatFr(p.dueDate, { weekday: true })} · <Countdown date={p.dueDate} /></div>}
                  </Card>
                );
              })}
            </div>
          )}
          <ProjectModal project={project} onClose={() => setProject(null)} />
        </div>
      )}
      {tab === 'grades' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <Card className="flex flex-col items-center justify-center bg-wine p-6 text-onwine">
              <div className="eyebrow text-onwine/70">Moyenne générale</div>
              <div className="num mt-2 font-display text-6xl">{overall != null ? nf(overall, 2) : '—'}</div>
              <div className="text-sm text-onwine/70">/ 20</div>
            </Card>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left"><th className="eyebrow px-5 py-3">Matière</th><th className="eyebrow">Coef.</th><th className="eyebrow">Notes</th><th className="eyebrow pr-5 text-right">Moyenne</th></tr></thead>
                <tbody>
                  {avgRows.map((r) => (
                    <tr key={r.course.id} className="border-t border-line/60">
                      <td className="px-5 py-3 font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.course.color }} />{r.course.name}</td>
                      <td className="num">{r.course.coefficient}</td>
                      <td className="text-xs text-muted">{r.grades.map((g) => `${nf(g.value, 2)}/${g.outOf}${g.coefficient !== 1 ? ` (×${g.coefficient})` : ''}`).join(' · ') || '—'}</td>
                      <td className="num pr-5 text-right font-semibold">{r.avg != null ? nf(r.avg, 2) : '—'}</td>
                    </tr>
                  ))}
                  {!avgRows.length && <tr><td colSpan={4} className="p-6 text-center text-muted">Ajoute d’abord tes matières (onglet Matières & EDT).</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
          <ResourceTable resource="grade" title="Toutes les notes" defaults={{ date: t0, outOf: 20, coefficient: 1 }} />
        </div>
      )}
      {tab === 'schedule' && (
        <div className="space-y-5">
          <ResourceTable resource="course" title="Matières" />
          <ResourceTable resource="event" title="Cours (emploi du temps)" params={{ where: { category: 'cours' } }} defaults={{ category: 'cours', recurrence: 'weekly', start: `${t0}T09:00` }} columns={['title', 'start', 'recurrence', 'location']} />
        </div>
      )}
    </Page>
  );
}

export { TaskCheck, optionLabel, Check };
