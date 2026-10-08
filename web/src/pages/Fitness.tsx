import * as React from 'react';
import { Play, Plus, Dumbbell, Trophy, Timer, Check, ChevronUp, ChevronDown, Trash2, Pencil, Home, Building, Flame, BookOpen, X } from 'lucide-react';
import { today, addDays, startOfWeek, formatFr, FR_DAYS, weekdayOf } from '@shared/dates';
import { optionLabel, REGISTRY } from '@shared/registry';
import { useList, useInvalidate, useSettings, useSaveSetting, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Modal, Segmented, Stat, Badge, Input, Select, Textarea, Progress, Rating, useConfirm } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TrendChart, BarsChart } from '@/components/charts';
import { GoalCard } from './Goals';
import { cn, nf, pct } from '@/lib/utils';
import { fmtTimer } from '@/components/layout/Focus';
import { toast } from 'sonner';

interface TplEx {
  exerciseId: number;
  sets: number;
  reps: string;
  weight: number | null;
  restSec: number;
}

// ------------------------------------------------------------------ template editor
function TemplateEditor({ tpl, onClose }: { tpl: Row | null; onClose: () => void }) {
  const { data: exercises = [] } = useList('exercise');
  const [items, setItems] = React.useState<TplEx[]>([]);
  const invalidate = useInvalidate();
  React.useEffect(() => setItems(tpl?.exercises ?? []), [tpl]);
  const upd = (i: number, patch: Partial<TplEx>) => setItems((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setItems((s) => {
    const c = [...s];
    const [x] = c.splice(i, 1);
    c.splice(Math.max(0, Math.min(c.length, i + d)), 0, x);
    return c;
  });
  const save = async () => {
    await api(`/r/workoutTemplate/${tpl!.id}`, { method: 'PATCH', body: { exercises: items } });
    invalidate();
    toast.success('Programme enregistré ♡');
    onClose();
  };
  return (
    <Modal open={!!tpl} onOpenChange={(o) => !o && onClose()} title={`Programme · ${tpl?.name ?? ''}`} size="lg" footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[auto_1.6fr_repeat(4,1fr)_auto]">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} className="text-muted hover:text-ink" aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} className="text-muted hover:text-ink" aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
            </div>
            <Select value={it.exerciseId} onChange={(e) => upd(i, { exerciseId: Number(e.target.value) })}>
              {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
            <label className="text-[10px] text-muted">Séries<Input type="number" value={it.sets} onChange={(e) => upd(i, { sets: Number(e.target.value) })} /></label>
            <label className="text-[10px] text-muted">Reps<Input value={it.reps} onChange={(e) => upd(i, { reps: e.target.value })} /></label>
            <label className="text-[10px] text-muted">Charge (kg)<Input type="number" step={0.5} value={it.weight ?? ''} onChange={(e) => upd(i, { weight: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label className="text-[10px] text-muted">Repos (s)<Input type="number" step={15} value={it.restSec} onChange={(e) => upd(i, { restSec: Number(e.target.value) })} /></label>
            <button onClick={() => setItems((s) => s.filter((_, j) => j !== i))} className="justify-self-end text-muted hover:text-bad" aria-label="Retirer"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button variant="soft" icon={Plus} onClick={() => exercises[0] && setItems((s) => [...s, { exerciseId: exercises[0].id, sets: 3, reps: '10-12', weight: null, restSec: 75 }])}>Ajouter un exercice</Button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ workout mode
function WorkoutMode({ session, onClose }: { session: Row | null; onClose: () => void }) {
  const { data: exercises = [] } = useList('exercise');
  const { data: templates = [] } = useList('workoutTemplate');
  const { data: sets = [] } = useList('setLog', { where: { sessionId: session?.id ?? -1 } }, { enabled: !!session });
  const { data: lastSets = [] } = useList('setLog', { orderBy: 'createdAt', dir: 'desc', take: 400 });
  const invalidate = useInvalidate();
  const [elapsed, setElapsed] = React.useState(0);
  const [rest, setRest] = React.useState<{ left: number; total: number } | null>(null);
  const [notes, setNotes] = React.useState('');
  const [energy, setEnergy] = React.useState(0);
  const [draft, setDraft] = React.useState<Record<string, { reps: string; weight: string }>>({});
  const confirm = useConfirm();

  React.useEffect(() => {
    if (!session) return;
    setNotes(session.notes ?? '');
    const start = Date.now() - elapsed * 1000;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) {
      if ('vibrate' in navigator) navigator.vibrate?.(300);
      toast('Repos terminé — série suivante 💪');
      setRest(null);
      return;
    }
    const t = setTimeout(() => setRest({ ...rest, left: rest.left - 1 }), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  if (!session) return null;
  const tpl = templates.find((t) => t.id === session.templateId);
  const plan: TplEx[] = tpl?.exercises ?? Array.from(new Set(sets.map((s) => s.exerciseId))).map((id) => ({ exerciseId: id, sets: 3, reps: '10', weight: null, restSec: 75 }));
  const exName = (id: number) => exercises.find((e) => e.id === id)?.name ?? 'Exercice';
  const lastFor = (exId: number) => lastSets.find((s) => s.exerciseId === exId && s.sessionId !== session.id && s.done);
  const doneCount = sets.filter((s) => s.done).length;
  const totalSets = plan.reduce((s, p) => s + p.sets, 0);

  const complete = async (ex: TplEx, idx: number) => {
    const key = `${ex.exerciseId}-${idx}`;
    const d = draft[key] ?? {};
    const prev = lastFor(ex.exerciseId);
    const reps = Number(d.reps ?? String(parseInt(ex.reps) || prev?.reps || 10));
    const weight = d.weight !== undefined && d.weight !== '' ? Number(d.weight) : ex.weight ?? prev?.weight ?? null;
    const existing = sets.find((s) => s.exerciseId === ex.exerciseId && s.setIndex === idx + 1);
    if (existing) await api(`/r/setLog/${existing.id}`, { method: 'PATCH', body: { done: !existing.done, reps, weight } });
    else await api('/r/setLog', { body: { sessionId: session.id, exerciseId: ex.exerciseId, setIndex: idx + 1, reps, weight, done: true } });
    invalidate();
    if (!existing?.done) setRest({ left: ex.restSec || 75, total: ex.restSec || 75 });
  };

  const finish = async () => {
    await api(`/r/workoutSession/${session.id}`, { method: 'PATCH', body: { status: 'done', durationMin: Math.max(1, Math.round(elapsed / 60)), notes, energy: energy || null } });
    invalidate();
    toast.success('Séance terminée — bravo Jadou ! 🍑');
    onClose();
  };

  return (
    <Modal open onOpenChange={async (o) => !o && (await confirm({ title: 'Quitter le Workout Mode ?', text: 'Les séries validées sont déjà enregistrées. Tu pourras reprendre la séance.', confirm: 'Quitter' })) && onClose()} title={session.name} description={`Workout Mode · ${doneCount}/${totalSets} séries`} size="lg" footer={<><Button variant="ghost" onClick={onClose}>Reprendre plus tard</Button><Button icon={Check} onClick={finish}>Terminer la séance</Button></>}>
      <div className="sticky -top-5 z-10 -mx-6 -mt-5 mb-4 grid grid-cols-2 gap-3 border-b border-line bg-surface/95 px-6 py-3 backdrop-blur">
        <div>
          <div className="eyebrow">Chrono</div>
          <div className="num font-display text-3xl">{fmtTimer(elapsed)}</div>
        </div>
        <div className={cn('rounded-2xl px-3 py-1.5 transition', rest ? 'bg-wine text-onwine' : 'bg-sunken')}>
          <div className={cn('eyebrow', rest && 'text-onwine/70')}>Repos</div>
          <div className="flex items-center gap-2">
            <span className="num font-display text-3xl">{rest ? fmtTimer(rest.left) : '—'}</span>
            {rest && <button onClick={() => setRest(null)} className="ml-auto text-xs underline">passer</button>}
          </div>
        </div>
        <Progress value={pct(doneCount, totalSets)} className="col-span-2" height={4} />
      </div>
      <div className="space-y-4">
        {plan.map((ex, ei) => {
          const prev = lastFor(ex.exerciseId);
          return (
            <div key={ei} className="rounded-2xl border border-line p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display text-xl">{exName(ex.exerciseId)}</div>
                <div className="text-xs text-muted">
                  {ex.sets} × {ex.reps} · repos {ex.restSec}s{prev ? ` · dernière fois ${prev.reps} × ${prev.weight ?? '—'} kg` : ''}
                </div>
              </div>
              <div className="space-y-1.5">
                {Array.from({ length: ex.sets }, (_, i) => {
                  const s = sets.find((x) => x.exerciseId === ex.exerciseId && x.setIndex === i + 1);
                  const key = `${ex.exerciseId}-${i}`;
                  return (
                    <div key={i} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', s?.done && 'bg-good/5')}>
                      <span className="w-14 text-xs text-muted">Série {i + 1}</span>
                      <Input inputMode="numeric" className="w-20 py-1.5 text-center" placeholder={String(parseInt(ex.reps) || prev?.reps || 10)} value={draft[key]?.reps ?? s?.reps ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [key]: { ...d[key], reps: e.target.value } }))} aria-label="Répétitions" />
                      <span className="text-xs text-muted">reps</span>
                      <Input inputMode="decimal" className="w-20 py-1.5 text-center" placeholder={String(ex.weight ?? prev?.weight ?? '')} value={draft[key]?.weight ?? s?.weight ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [key]: { ...d[key], weight: e.target.value } }))} aria-label="Charge" />
                      <span className="text-xs text-muted">kg</span>
                      <Button size="sm" variant={s?.done ? 'soft' : 'primary'} className="ml-auto" icon={s?.done ? Check : undefined} onClick={() => complete(ex, i)}>
                        {s?.done ? 'Faite' : 'Série terminée'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border border-line p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Énergie</span>
            <Rating value={energy} onChange={setEnergy} />
          </div>
          <Textarea placeholder="Commentaires (ressenti, technique, douleurs…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ page
export function FitnessPage() {
  const [tab, setTab] = React.useState<'overview' | 'program' | 'history' | 'progress' | 'library' | 'goals'>('overview');
  const { data: templates = [] } = useList('workoutTemplate');
  const { data: sessions = [] } = useList('workoutSession');
  const { data: allSets = [] } = useList('setLog');
  const { data: exercises = [] } = useList('exercise');
  const { data: goals = [] } = useList('goal', { where: { category: 'fitness' } });
  const { data: settings } = useSettings();
  const saveSetting = useSaveSetting();
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const [editTpl, setEditTpl] = React.useState<Row | null>(null);
  const [live, setLive] = React.useState<Row | null>(null);
  const [exSel, setExSel] = React.useState<number | null>(null);
  const [libCat, setLibCat] = React.useState<string>('all');
  const [detail, setDetail] = React.useState<Row | null>(null);

  const t0 = today();
  const wk = startOfWeek(t0);
  const done = sessions.filter((s) => s.status === 'done');
  const weekDone = done.filter((s) => s.date >= wk && s.date <= addDays(wk, 6)).length;
  const weekGoal = settings?.goals?.workoutsPerWeek ?? 3;
  const todayTpl = templates.find((t) => t.active && t.weekday === String(weekdayOf(t0)));
  const inProgress = sessions.find((s) => s.status === 'in_progress');
  const exName = (id: number) => exercises.find((e) => e.id === id)?.name ?? '';

  const start = async (tpl?: Row, existing?: Row) => {
    if (existing) {
      if (existing.status !== 'in_progress') await api(`/r/workoutSession/${existing.id}`, { method: 'PATCH', body: { status: 'in_progress' } });
      invalidate();
      return setLive({ ...existing, status: 'in_progress' });
    }
    const planned = sessions.find((s) => s.date === t0 && s.status === 'planned' && (!tpl || s.templateId === tpl.id));
    if (planned) return start(undefined, planned);
    const s = await api<Row>('/r/workoutSession', { body: { name: tpl?.name ?? 'Séance libre', templateId: tpl?.id ?? null, date: t0, time: new Date().toTimeString().slice(0, 5), status: 'in_progress' } });
    invalidate();
    setLive(s);
  };

  // progression data
  const doneSets = allSets.filter((s) => s.done);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const exIds = Array.from(new Set(doneSets.map((s) => s.exerciseId)));
  const selected = exSel ?? exIds[0] ?? null;
  const perSession = (exId: number) => {
    const by: Record<string, { date: string; max: number; volume: number; reps: number }> = {};
    for (const s of doneSets.filter((x) => x.exerciseId === exId)) {
      const ses = sessionById.get(s.sessionId);
      if (!ses) continue;
      by[ses.date] ??= { date: ses.date, max: 0, volume: 0, reps: 0 };
      by[ses.date].max = Math.max(by[ses.date].max, s.weight ?? 0);
      by[ses.date].volume += (s.weight ?? 0) * (s.reps ?? 0);
      by[ses.date].reps += s.reps ?? 0;
    }
    return Object.values(by).sort((a, b) => a.date.localeCompare(b.date));
  };
  const records = exIds.map((id) => {
    const xs = doneSets.filter((s) => s.exerciseId === id && s.weight);
    const best = xs.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
    return best ? { id, name: exName(id), weight: best.weight, reps: best.reps, date: sessionById.get(best.sessionId)?.date } : null;
  }).filter(Boolean) as { id: number; name: string; weight: number; reps: number; date?: string }[];
  const weeks = Array.from({ length: 10 }, (_, i) => addDays(wk, (i - 9) * 7));
  const regularity = weeks.map((w) => ({ week: w, séances: done.filter((s) => s.date >= w && s.date < addDays(w, 7)).length }));
  const volumeSeries = done.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-20).map((s) => ({ date: s.date, volume: doneSets.filter((x) => x.sessionId === s.id).reduce((t, x) => t + (x.weight ?? 0) * (x.reps ?? 0), 0) }));

  const cats = REGISTRY.exercise.fields.category.options;

  return (
    <Page>
      <PageHeader eyebrow="Wellness" title="My Body" accent="Goals" subtitle="Fessiers, galbe, charges, régularité — ton carnet de musculation." coverKey="fitness" variant={0} actions={<>{inProgress ? <Button icon={Play} onClick={() => start(undefined, inProgress)}>Reprendre la séance</Button> : <Button icon={Play} onClick={() => start(todayTpl)}>{todayTpl ? `Lancer ${todayTpl.name}` : 'Séance libre'}</Button>}<Button variant="outline" icon={Plus} onClick={() => open({ resource: 'workoutSession', defaults: { date: t0, status: 'planned', name: 'Séance' } })}>Planifier</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Vue d’ensemble' }, { value: 'program', label: 'Programme' }, { value: 'history', label: 'Séances' }, { value: 'progress', label: 'Progression' }, { value: 'library', label: 'Exercise Library' }, { value: 'goals', label: 'Objectifs' }]} />

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Cette semaine" value={`${weekDone}/${weekGoal}`} icon={Flame} sub={<Progress value={pct(weekDone, weekGoal)} className="mt-2" color="#D4876C" />} />
            <Stat label="Ce mois" value={done.filter((s) => s.date.slice(0, 7) === t0.slice(0, 7)).length} sub="séances réalisées" />
            <Stat label="Total" value={done.length} sub="séances depuis le début" />
            <Stat label="Records" value={records.length} icon={Trophy} sub="exercices suivis" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {templates.filter((t) => t.active).map((t) => (
              <Card key={t.id} hover className={cn('overflow-hidden', t.weekday === String(weekdayOf(t0)) && 'ring-2 ring-wine/30')}>
                <div className="relative h-24 bg-gradient-to-br from-petal via-blush/60 to-sand p-5">
                  <div className="eyebrow text-wine/80">{t.weekday === 'none' ? 'Libre' : FR_DAYS[Number(t.weekday)]}</div>
                  <div className="h-display text-2xl">{t.name}</div>
                  {t.location === 'home' ? <Home className="absolute right-5 top-5 h-5 w-5 text-wine/50" /> : <Building className="absolute right-5 top-5 h-5 w-5 text-wine/50" />}
                </div>
                <div className="p-4">
                  <ul className="mb-4 space-y-1 text-sm">
                    {(t.exercises as TplEx[]).map((e, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">{exName(e.exerciseId)}</span>
                        <span className="num shrink-0 text-muted">{e.sets}×{e.reps}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button size="sm" icon={Play} onClick={() => start(t)}>Lancer</Button>
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditTpl(t)}>Modifier</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader title="Prochaines séances planifiées" />
            <div className="p-3">
              {sessions.filter((s) => s.status === 'planned' && s.date >= t0).length === 0 ? <Empty title="Aucune séance planifiée" text="Les jours de programme apparaissent automatiquement dans ton calendrier. Demande aussi à Jadou AI de « trouver deux créneaux pour le sport »." className="py-4" /> :
                sessions.filter((s) => s.status === 'planned' && s.date >= t0).sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-sunken">
                    <span className="w-28 text-sm capitalize text-muted">{formatFr(s.date, { weekday: true })}</span>
                    <span className="flex-1 font-medium">{s.name} {s.time && <span className="text-muted">· {s.time}</span>}</span>
                    {s.date === t0 && <Button size="sm" icon={Play} onClick={() => start(undefined, s)}>Go</Button>}
                    <Button size="sm" variant="ghost" onClick={() => open({ resource: 'workoutSession', id: s.id })}>Modifier</Button>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'program' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={Plus} onClick={() => open({ resource: 'workoutTemplate', defaults: { exercises: [] } })}>Nouvelle séance type</Button>
            <span className="text-sm text-muted">Objectif hebdomadaire :</span>
            <Input type="number" min={1} max={7} className="w-20" defaultValue={weekGoal} onBlur={(e) => saveSetting.mutate({ key: 'goals', value: { ...settings?.goals, workoutsPerWeek: Number(e.target.value) || 3 } })} />
            <span className="text-sm text-muted">séances</span>
          </div>
          {templates.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="h-display text-2xl">{t.name}</div>
                <Badge>{optionLabel(REGISTRY.workoutTemplate.fields.weekday.options, t.weekday)}</Badge>
                <Badge>{t.location === 'home' ? 'Maison' : 'Salle'}</Badge>
                {!t.active && <Badge>Inactif</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="soft" icon={Dumbbell} onClick={() => setEditTpl(t)}>Exercices</Button>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open({ resource: 'workoutTemplate', id: t.id })}>Infos</Button>
                </div>
              </div>
              {t.notes && <p className="mb-3 text-sm text-muted">{t.notes}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left"><th className="eyebrow py-2">Exercice</th><th className="eyebrow">Séries</th><th className="eyebrow">Reps</th><th className="eyebrow">Charge</th><th className="eyebrow">Repos</th></tr></thead>
                  <tbody>
                    {(t.exercises as TplEx[]).map((e, i) => (
                      <tr key={i} className="border-t border-line/60"><td className="py-2 font-medium">{exName(e.exerciseId)}</td><td className="num">{e.sets}</td><td className="num">{e.reps}</td><td className="num">{e.weight ? `${e.weight} kg` : '—'}</td><td className="num">{e.restSec}s</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'history' && <ResourceTable resource="workoutSession" title="Toutes les séances" defaults={{ date: t0, status: 'planned' }} filterField="status" extraActions={(r) => (r.status !== 'done' ? [{ label: 'Lancer en Workout Mode', icon: Play, onSelect: () => start(undefined, r) }] : [])} />}

      {tab === 'progress' && (
        <div className="space-y-5">
          {doneSets.length === 0 ? (
            <Card><Empty icon={Dumbbell} title="Pas encore de données" text="Termine une séance en Workout Mode : charges, répétitions et volume seront suivis automatiquement." /></Card>
          ) : (
            <>
              <Card>
                <CardHeader title="Charges & répétitions" action={<Select className="w-56" value={selected ?? ''} onChange={(e) => setExSel(Number(e.target.value))}>{exIds.map((id) => <option key={id} value={id}>{exName(id)}</option>)}</Select>} />
                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  {selected && <TrendChart type="line" data={perSession(selected)} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'max', name: 'Charge max (kg)' }]} fmt={(v) => `${nf(v, 1)} kg`} />}
                  {selected && <BarsChart data={perSession(selected)} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'reps', name: 'Répétitions totales' }]} />}
                </div>
              </Card>
              <div className="grid gap-5 lg:grid-cols-2">
                <Card><CardHeader title="Volume par séance" eyebrow="kg × reps" /><div className="p-5"><BarsChart data={volumeSeries} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'volume', name: 'Volume (kg)' }]} /></div></Card>
                <Card><CardHeader title="Régularité" eyebrow="10 dernières semaines" /><div className="p-5"><BarsChart data={regularity} x="week" labelFmt={(d) => formatFr(d)} series={[{ key: 'séances', name: 'Séances', color: '#D4876C' }]} /></div></Card>
              </div>
              <Card>
                <CardHeader icon={Trophy} title="Records personnels" />
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-sunken/70 p-3">
                      <Trophy className="h-5 w-5 text-[#C9A35F]" />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{r.name}</div><div className="text-xs text-muted">{r.date && formatFr(r.date)}</div></div>
                      <div className="num font-display text-xl">{nf(r.weight, 1)} kg <span className="text-xs text-muted">× {r.reps}</span></div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'library' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button className={cn('chip', libCat === 'all' && 'chip-active')} onClick={() => setLibCat('all')}>Tous</button>
            {cats.map((c) => <button key={c.value} className={cn('chip', libCat === c.value && 'chip-active')} onClick={() => setLibCat(c.value)}>{c.label}</button>)}
            <Button size="sm" icon={Plus} className="ml-auto" onClick={() => open({ resource: 'exercise' })}>Exercice</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {exercises.filter((e) => libCat === 'all' || e.category === libCat).map((e) => (
              <Card key={e.id} hover className="cursor-pointer overflow-hidden" onClick={() => setDetail(e)}>
                {e.media ? <img src={e.media} alt="" className="h-40 w-full object-cover" /> : (
                  <div className="relative grid h-28 place-items-center bg-gradient-to-br from-petal to-sand">
                    <Dumbbell className="h-8 w-8 text-wine/40" strokeWidth={1.3} />
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2"><div className="font-display text-xl">{e.name}</div><Badge className="ml-auto">{optionLabel(cats, e.category)}</Badge></div>
                  <div className="text-xs text-muted">{e.muscles}</div>
                  <div className="mt-1 text-xs text-muted">Matériel : {e.equipment || '—'}</div>
                </div>
              </Card>
            ))}
          </div>
          <Modal open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail?.name ?? ''} description={detail?.muscles} size="lg" footer={<><Button variant="ghost" icon={Pencil} onClick={() => { const d = detail; setDetail(null); open({ resource: 'exercise', id: d!.id }); }}>Modifier</Button><Button onClick={() => setDetail(null)} icon={X}>Fermer</Button></>}>
            {detail && (
              <div className="space-y-4 text-sm">
                {detail.media && <img src={detail.media} alt="" className="max-h-72 w-full rounded-2xl object-cover" />}
                {detail.videoUrl && <a href={detail.videoUrl} target="_blank" rel="noreferrer" className="chip">Voir la vidéo ↗</a>}
                {[['Instructions', detail.instructions], ['Conseils techniques', detail.tips], ['Variantes', detail.variants], ['Matériel', detail.equipment]].map(([k, v]) => v ? <div key={k}><div className="eyebrow mb-1 flex items-center gap-1.5"><BookOpen className="h-3 w-3" />{k}</div><p className="leading-relaxed text-ink/85">{v}</p></div> : null)}
              </div>
            )}
          </Modal>
        </div>
      )}

      {tab === 'goals' && (
        <div className="space-y-4">
          <Button icon={Plus} onClick={() => open({ resource: 'goal', defaults: { category: 'fitness', horizon: 'monthly' } })}>Objectif fitness</Button>
          {goals.length === 0 ? <Card><Empty icon={Timer} title="Aucun objectif fitness" text="Ex. « Hip thrust 80 kg × 8 », « 12 séances ce mois-ci »." /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{goals.map((g) => <GoalCard key={g.id} g={g} />)}</div>}
        </div>
      )}

      <TemplateEditor tpl={editTpl} onClose={() => setEditTpl(null)} />
      <WorkoutMode session={live} onClose={() => setLive(null)} />
    </Page>
  );
}
