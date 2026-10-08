import * as React from 'react';
import { ChevronLeft, ChevronRight, Printer, Sparkles, Check, Save, Trophy } from 'lucide-react';
import { today, addDays, startOfWeek, startOfMonth, endOfMonth, addMonths, isoWeek, formatFr, FR_MONTHS } from '@shared/dates';
import { eur } from '@shared/finance';
import { optionLabel, CATEGORIES } from '@shared/registry';
import { useApi, useList, useInvalidate } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Segmented, Stat, Textarea, Input, Empty } from '@/components/ui';
import { toast } from 'sonner';

const MONTH_Q = [
  ['accomplished', 'Qu’ai-je accompli ?'],
  ['goals', 'Quels objectifs ai-je atteints ?'],
  ['earned', 'Combien ai-je gagné ?'],
  ['saved', 'Combien ai-je économisé ?'],
  ['projects', 'Quels projets ont avancé ?'],
  ['improve', 'Que dois-je améliorer ?'],
];
const WEEK_Q = [
  ['wins', 'Mes réussites de la semaine'],
  ['learned', 'Ce que j’ai appris'],
  ['improve', 'Ce que je veux améliorer'],
];

function useSuggestions(nextFrom: string, nextTo: string) {
  const { data: hw = [] } = useList('homework', { where: { status: { not: 'done' }, dueDate: { lte: nextTo } } });
  const { data: exams = [] } = useList('exam', { where: { date: { gte: nextFrom, lte: nextTo } } });
  const { data: overdue = [] } = useList('task', { where: { status: { not: 'done' }, date: { lt: today() } } });
  const { data: goals = [] } = useList('goal', { where: { status: 'active' } });
  const { data: t } = useApi<any>('/stats/toeic');
  const { data: f } = useApi<any>('/stats/fitness');
  const out: string[] = [];
  for (const e of exams) out.push(`Réviser pour l’examen « ${e.title} » (${formatFr(e.date, { weekday: true })})`);
  for (const h of hw.sort((a, b) => a.dueDate.localeCompare(b.dueDate))) out.push(`Rendre « ${h.title} » (${formatFr(h.dueDate)})`);
  if (overdue.length) out.push(`Solder les ${overdue.length} tâche(s) en retard`);
  if (t?.weakParts?.[0]) out.push(`TOEIC : travailler la Part ${t.weakParts[0].part} (${t.weakParts[0].rate} % de réussite)`);
  else if (t && t.exercises === 0) out.push('TOEIC : faire un premier test pour mesurer mon niveau');
  if (f && f.weekDone < f.weekGoal) out.push(`Sport : tenir ${f.weekGoal} séances`);
  const lagging = goals.filter((g) => g.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  if (lagging) out.push(`Avancer sur l’objectif « ${lagging.title} »`);
  return out.slice(0, 3);
}

export function ReviewPage() {
  const [type, setType] = React.useState<'weekly' | 'monthly'>('weekly');
  const [anchor, setAnchor] = React.useState(today());
  const from = type === 'weekly' ? startOfWeek(anchor) : startOfMonth(anchor);
  const to = type === 'weekly' ? addDays(from, 6) : endOfMonth(anchor);
  const period = type === 'weekly' ? isoWeek(from) : from.slice(0, 7);
  const { data: s } = useApi<any>(`/stats/period?from=${from}&to=${to}`);
  const { data: reviews = [] } = useList('review', { where: { type, period } });
  const existing = reviews[0];
  const nextFrom = type === 'weekly' ? addDays(from, 7) : addMonths(from, 1);
  const nextTo = type === 'weekly' ? addDays(nextFrom, 6) : endOfMonth(nextFrom);
  const suggestions = useSuggestions(nextFrom, nextTo);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [prios, setPrios] = React.useState<string[]>(['', '', '']);
  const invalidate = useInvalidate();
  React.useEffect(() => {
    setAnswers(existing?.answers ?? {});
    setPrios(existing?.priorities?.length ? existing.priorities : ['', '', '']);
  }, [existing?.id, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const body = { type, period, answers, priorities: prios };
    if (existing) await api(`/r/review/${existing.id}`, { method: 'PATCH', body });
    else await api('/r/review', { body });
    invalidate();
    toast.success('Bilan enregistré ♡');
  };
  const toTasks = async () => {
    const list = prios.filter(Boolean);
    for (const p of list) await api('/r/task', { body: { title: p, date: nextFrom, priority: 'high', focus: true, status: 'todo', category: 'perso' } });
    invalidate();
    toast.success(`${list.length} priorités ajoutées à My Tasks (Today’s Focus)`);
  };
  const title = type === 'weekly' ? `Semaine du ${formatFr(from)}` : `${FR_MONTHS[+from.slice(5, 7) - 1]} ${from.slice(0, 4)}`;

  return (
    <Page className="max-w-6xl">
      <PageHeader eyebrow="Organization" title={type === 'weekly' ? 'Weekly' : 'Monthly'} accent={type === 'weekly' ? 'Review' : 'Reset'} subtitle="Bilan automatique à partir de tes données, puis tes réflexions." coverKey="review" variant={0} actions={<><Button variant="outline" icon={Printer} onClick={() => window.print()}>Exporter en PDF</Button><Button icon={Save} onClick={save}>Enregistrer</Button></>} />
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={type} onChange={(v) => (setType(v), setAnchor(today()))} options={[{ value: 'weekly', label: 'Weekly Review' }, { value: 'monthly', label: 'Monthly Reset' }]} />
        <div className="flex items-center gap-1">
          <button className="chip" onClick={() => setAnchor(type === 'weekly' ? addDays(from, -7) : addMonths(from, -1))} aria-label="Précédent"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="h-display min-w-[200px] text-center text-xl capitalize">{title}</span>
          <button className="chip" onClick={() => setAnchor(type === 'weekly' ? addDays(from, 7) : addMonths(from, 1))} aria-label="Suivant"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="Tâches" value={s.tasksDone} />
          <Stat label="Sport" value={s.workouts} sub="séances" />
          <Stat label="TOEIC" value={`${s.toeicMinutes} min`} sub={s.toeicAccuracy != null ? `${s.toeicAccuracy} % réussite` : `${s.toeicAttempts} exercices`} />
          <Stat label="Focus" value={`${Math.round(s.focusMinutes / 6) / 10} h`} />
          <Stat label="Revenus" value={eur(s.income)} />
          <Stat label="Dépenses" value={eur(s.expense)} />
          <Stat label="Épargne" value={eur(s.saved)} />
          <Stat label="Cils" value={eur(s.lashRevenue)} sub={`${s.lashCount} prestations`} />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader icon={Trophy} title="Réussites & projets" />
          <div className="space-y-4 p-5 text-sm">
            {s && (
              <>
                <div className="flex flex-wrap gap-1.5">{Object.entries(s.tasksByCategory).map(([k, v]) => <span key={k} className="chip">{optionLabel(CATEGORIES, k)} · {v as number}</span>)}</div>
                {s.topTasks.length > 0 && <ul className="space-y-1">{s.topTasks.map((t: string) => <li key={t} className="flex gap-2"><Check className="h-4 w-4 text-good" />{t}</li>)}</ul>}
                {s.goalsDone.length > 0 && <div><div className="eyebrow mb-1">Objectifs atteints</div>{s.goalsDone.map((g: string) => <div key={g}>🏆 {g}</div>)}</div>}
                <div className="text-muted">{s.homeworkDone} devoir(s) rendu(s) · {s.projectsUpdated} projet(s)/idée(s) mis à jour · {s.journal} page(s) de journal · {s.habitLogs} habitudes cochées</div>
                {!s.tasksDone && !s.workouts && !s.income && <Empty title="Peu de données sur cette période" className="py-2" />}
              </>
            )}
            <div className="space-y-4 border-t border-line/70 pt-4">
              {(type === 'weekly' ? WEEK_Q : MONTH_Q).map(([k, q]) => (
                <div key={k}>
                  <label className="mb-1.5 block font-display text-lg">{q}</label>
                  <Textarea value={answers[k] ?? ''} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} placeholder={k === 'earned' && s ? `Données : ${eur(s.income)} de revenus` : k === 'saved' && s ? `Données : ${eur(s.saved)} versés en épargne · solde net ${eur(s.net)}` : ''} />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="self-start">
          <CardHeader icon={Sparkles} title={type === 'weekly' ? '3 priorités pour la semaine prochaine' : '3 priorités pour le mois prochain'} />
          <div className="space-y-3 p-5">
            {suggestions.length > 0 && (
              <div className="rounded-2xl bg-petal/60 p-3">
                <div className="eyebrow mb-2 text-wine/80">Suggestions (tes échéances & points faibles)</div>
                {suggestions.map((x) => <button key={x} onClick={() => { const i = prios.findIndex((p) => !p); if (i >= 0) setPrios(prios.map((p, j) => (j === i ? x : p))); }} className="mb-1 block w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-surface">+ {x}</button>)}
              </div>
            )}
            {prios.map((p, i) => (
              <div key={i} className="flex items-center gap-2"><span className="font-display text-2xl italic text-blush">{i + 1}</span><Input value={p} onChange={(e) => setPrios(prios.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Priorité…" /></div>
            ))}
            <Button variant="soft" className="no-print w-full" onClick={toTasks} disabled={!prios.some(Boolean)}>Ajouter à My Tasks ({formatFr(nextFrom)})</Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
