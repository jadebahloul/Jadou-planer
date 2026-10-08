import * as React from 'react';
import { Play, Volume2, Timer, Target, BookMarked, Brain, CalendarRange, Plus, Check, X, RotateCcw, Headphones, BookOpen, Sparkles, Trophy } from 'lucide-react';
import { today, addDays, formatFr, diffDays, weekdayOf, FR_DAYS, startOfWeek } from '@shared/dates';
import { useApi, useList, useInvalidate, useSettings, useSaveSetting, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge, Ring, Modal, Input, Progress, useConfirm } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TrendChart } from '@/components/charts';
import { PARTS, TOEIC_SETS, questionById, speak, type ToeicSet } from '@/content/toeic';
import { cn, nf, pct } from '@/lib/utils';
import { fmtTimer } from '@/components/layout/Focus';
import { toast } from 'sonner';

// ------------------------------------------------------------------ exercise engine
interface Session {
  part: number; // 0 = mini-test, -1 = targeted review
  sets: ToeicSet[];
  timed: boolean;
}

function shuffle<T>(a: T[]) {
  return [...a].sort(() => Math.random() - 0.5);
}

function Exercise({ session, onClose }: { session: Session; onClose: () => void }) {
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [speaking, setSpeaking] = React.useState<string | null>(null);
  const invalidate = useInvalidate();
  const confirm = useConfirm();
  const questions = session.sets.flatMap((s) => s.questions.map((q) => ({ set: s, q })));
  const limit = session.timed ? questions.length * (session.part >= 5 || session.part === 0 ? 45 : 35) : null;

  React.useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);
  React.useEffect(() => {
    if (limit && elapsed >= limit && !submitted) {
      toast('Temps écoulé ⏱');
      submit();
    }
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const play = async (s: ToeicSet) => {
    setSpeaking(s.id);
    await speak(s.audio!);
    setSpeaking(null);
  };

  const submit = async () => {
    setSubmitted(true);
    window.speechSynthesis?.cancel();
    const score = questions.filter(({ q }) => answers[q.id] === q.answer).length;
    const details = questions.map(({ q }) => ({ id: q.id, given: answers[q.id] ?? null, correct: q.answer }));
    const parts = Array.from(new Set(session.sets.map((s) => s.part)));
    // one attempt per part (so stats per part stay meaningful)
    for (const p of parts) {
      const qs = questions.filter(({ set }) => set.part === p);
      await api('/r/toeicAttempt', { body: { part: p, mode: session.part === 0 ? 'mini_test' : session.part === -1 ? 'review' : session.timed ? 'timed' : 'practice', score: qs.filter(({ q }) => answers[q.id] === q.answer).length, total: qs.length, durationSec: Math.round((elapsed * qs.length) / questions.length), date: today(), details: details.filter((d) => qs.some(({ q }) => q.id === d.id)) } });
    }
    for (const { set, q } of questions) {
      if (answers[q.id] === q.answer) {
        // a correct answer in review closes the related mistakes
        if (session.part === -1) {
          const ms = await api<Row[]>(`/r/toeicMistake?where=${encodeURIComponent(JSON.stringify({ questionId: q.id, reviewed: false }))}`);
          for (const m of ms) await api(`/r/toeicMistake/${m.id}`, { method: 'PATCH', body: { reviewed: true } });
        }
        continue;
      }
      await api('/r/toeicMistake', { body: { part: set.part, questionId: q.id, notion: q.notion, question: q.prompt ?? (set.scene ? set.scene.caption : 'Question'), yourAnswer: answers[q.id] != null ? q.options[answers[q.id]] : '(sans réponse)', correctAnswer: q.options[q.answer], explanation: q.explanation, reviewed: false, date: today() } });
    }
    invalidate();
    toast.success(`Score : ${score}/${questions.length}`);
  };

  const score = questions.filter(({ q }) => answers[q.id] === q.answer).length;
  const title = session.part === 0 ? 'Mini-test' : session.part === -1 ? 'Révision ciblée' : `Part ${session.part} · ${PARTS[session.part - 1].name}`;

  return (
    <Modal
      open
      onOpenChange={async (o) => !o && (submitted || (await confirm({ title: 'Quitter l’exercice ?', text: 'Tes réponses ne seront pas enregistrées.', confirm: 'Quitter' }))) && onClose()}
      title={title}
      description={submitted ? `Résultat : ${score}/${questions.length} (${pct(score, questions.length)} %)` : `${questions.length} question${questions.length > 1 ? 's' : ''}${limit ? ' · chronométré' : ''}`}
      size="lg"
      footer={submitted ? <Button onClick={onClose}>Terminer</Button> : <><span className="num mr-auto flex items-center gap-1.5 text-sm text-muted"><Timer className="h-4 w-4" />{limit ? fmtTimer(Math.max(0, limit - elapsed)) : fmtTimer(elapsed)}</span><Button onClick={submit} disabled={!Object.keys(answers).length}>Valider mes réponses</Button></>}
    >
      <div className="space-y-6">
        {session.sets.map((s) => (
          <div key={s.id} className="space-y-3">
            {(session.part <= 0) && <Badge>Part {s.part}</Badge>}
            {s.scene && (
              <div className="grid place-items-center rounded-3xl bg-gradient-to-br from-petal to-sand py-8">
                <div className="text-6xl tracking-[0.3em]">{s.scene.emoji}</div>
                <div className="mt-2 text-[11px] text-muted">Scène illustrée{submitted ? ` — ${s.scene.caption}` : ''}</div>
              </div>
            )}
            {s.audio && (
              <div className="flex items-center gap-3 rounded-2xl bg-sunken/70 p-3">
                <Button size="sm" variant={speaking === s.id ? 'soft' : 'primary'} icon={Volume2} onClick={() => play(s)}>{speaking === s.id ? 'Écoute…' : 'Écouter'}</Button>
                <span className="text-xs text-muted">Audio lu par la synthèse vocale de ton navigateur{s.part === 1 || s.part === 2 ? ' — les réponses sont lues, pas écrites (comme à l’examen)' : ''}.</span>
              </div>
            )}
            {s.passage && <pre className="whitespace-pre-wrap rounded-2xl border border-line bg-sunken/40 p-4 font-sans text-sm leading-relaxed">{s.passage}</pre>}
            {submitted && s.audio && (s.part === 3 || s.part === 4) && <details className="rounded-xl bg-sunken/50 p-3 text-xs"><summary className="cursor-pointer font-medium">Transcription</summary><p className="mt-2 whitespace-pre-wrap">{s.audio}</p></details>}
            {s.questions.map((q) => (
              <div key={q.id} className="rounded-2xl border border-line p-4">
                {q.prompt && <div className="mb-3 font-medium">{q.prompt}</div>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, i) => {
                    const chosen = answers[q.id] === i;
                    const hideText = !submitted && (s.part === 1 || s.part === 2);
                    return (
                      <button
                        key={i}
                        disabled={submitted}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition',
                          !submitted && (chosen ? 'border-wine bg-petal' : 'border-line hover:border-wine/30'),
                          submitted && i === q.answer && 'border-good bg-good/10',
                          submitted && chosen && i !== q.answer && 'border-bad bg-bad/10',
                          submitted && !chosen && i !== q.answer && 'border-line opacity-60',
                        )}
                      >
                        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold', chosen ? 'bg-wine text-onwine' : 'bg-sunken')}>{'ABCD'[i]}</span>
                        {hideText ? <span className="text-muted">Réponse {'ABCD'[i]}</span> : o}
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <div className={cn('mt-3 flex gap-2 rounded-xl p-3 text-xs', answers[q.id] === q.answer ? 'bg-good/10' : 'bg-bad/5')}>
                    {answers[q.id] === q.answer ? <Check className="h-4 w-4 shrink-0 text-good" /> : <X className="h-4 w-4 shrink-0 text-bad" />}
                    <div><span className="font-semibold">{q.notion}</span> — {q.explanation}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ flashcards
function Flashcards() {
  const t0 = today();
  const { data: cards = [] } = useList('flashcard');
  const invalidate = useInvalidate();
  const open = useRecordDialog();
  const due = cards.filter((c) => !c.nextReview || c.nextReview <= t0);
  const [i, setI] = React.useState(0);
  const [flip, setFlip] = React.useState(false);
  const [mode, setMode] = React.useState<'review' | 'list'>('review');
  const card = due[i % Math.max(1, due.length)];

  const grade = async (g: 0 | 1 | 2) => {
    if (!card) return;
    // simple SM-2 style scheduling
    let { interval = 0, ease = 2.5, reps = 0 } = card;
    if (g === 0) {
      interval = 0;
      reps = 0;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      reps += 1;
      interval = reps === 1 ? (g === 2 ? 3 : 1) : reps === 2 ? (g === 2 ? 7 : 3) : Math.round(interval * (g === 2 ? ease + 0.15 : ease));
      ease = Math.min(3, ease + (g === 2 ? 0.1 : -0.05));
    }
    const level = interval >= 21 ? 'known' : reps > 0 ? 'learning' : 'new';
    await api(`/r/flashcard/${card.id}`, { method: 'PATCH', body: { interval, ease, reps, level, nextReview: addDays(t0, interval) } });
    setFlip(false);
    invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'review', label: `À réviser (${due.length})` }, { value: 'list', label: `Tout le vocabulaire (${cards.length})` }]} />
        <Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'flashcard' })}>Mot</Button>
        <div className="ml-auto flex gap-3 text-xs text-muted">
          <span>Nouveaux {cards.filter((c) => c.level === 'new').length}</span>
          <span>En cours {cards.filter((c) => c.level === 'learning').length}</span>
          <span>Maîtrisés {cards.filter((c) => c.level === 'known').length}</span>
        </div>
      </div>
      {mode === 'list' ? (
        <ResourceTable resource="flashcard" title="Vocabulary Book" filterField="level" />
      ) : !card ? (
        <Card><Empty icon={Sparkles} title="Révisions terminées pour aujourd’hui ♡" text="Reviens demain : les cartes reviennent selon un intervalle espacé." /></Card>
      ) : (
        <div className="mx-auto max-w-xl">
          <button onClick={() => setFlip(!flip)} className="relative block h-72 w-full [perspective:1200px]" aria-label="Retourner la carte">
            <div className={cn('absolute inset-0 rounded-[32px] transition-transform duration-500 [transform-style:preserve-3d]', flip && '[transform:rotateY(180deg)]')}>
              <div className="card absolute inset-0 grid place-items-center p-8 [backface-visibility:hidden]">
                <div className="text-center">
                  <div className="eyebrow mb-3">{card.theme ?? 'Vocabulary'}</div>
                  <div className="h-display text-5xl">{card.word}</div>
                  <div className="mt-4 text-xs text-muted">Touche pour voir la traduction</div>
                </div>
              </div>
              <div className="absolute inset-0 grid place-items-center rounded-[32px] bg-wine p-8 text-onwine [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="text-center">
                  <div className="font-display text-4xl">{card.translation}</div>
                  {card.example && <p className="mt-4 font-display text-lg italic text-onwine/80">“{card.example}”</p>}
                </div>
              </div>
            </div>
          </button>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="outline" icon={Volume2} size="sm" onClick={() => speak(card.word + (card.example ? '. ' + card.example : ''))}>Prononcer</Button>
          </div>
          {flip && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button variant="danger" onClick={() => grade(0)}>À revoir</Button>
              <Button variant="soft" onClick={() => grade(1)}>Difficile</Button>
              <Button onClick={() => grade(2)}>Facile</Button>
            </div>
          )}
          <div className="mt-3 text-center text-xs text-muted">{due.length} carte{due.length > 1 ? 's' : ''} à réviser</div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ planning
function Planning() {
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const invalidate = useInvalidate();
  const plan: Record<string, { focus: string; minutes: number }> = settings?.toeicPlan ?? {};
  const order = ['1', '2', '3', '4', '5', '6', '0'];
  const upd = (d: string, patch: Partial<{ focus: string; minutes: number }>) => save.mutate({ key: 'toeicPlan', value: { ...plan, [d]: { ...(plan[d] ?? { focus: '', minutes: 30 }), ...patch } } });
  const schedule = async () => {
    const wk = startOfWeek(today());
    let n = 0;
    const existing = await api<Row[]>(`/r/task?where=${encodeURIComponent(JSON.stringify({ category: 'toeic', date: { gte: today(), lte: addDays(wk, 13) } }))}`);
    for (let i = 0; i < 14; i++) {
      const d = addDays(wk, i);
      if (d < today()) continue;
      const p = plan[String(weekdayOf(d))];
      if (!p?.focus || existing.some((t) => t.date === d)) continue;
      await api('/r/task', { body: { title: `TOEIC · ${p.focus}`, category: 'toeic', date: d, durationMin: p.minutes, priority: 'high', status: 'todo' } });
      n++;
    }
    invalidate();
    toast.success(n ? `${n} séances TOEIC ajoutées à My Tasks et My Calendar ♡` : 'Les deux prochaines semaines sont déjà planifiées.');
  };
  return (
    <Card>
      <CardHeader icon={CalendarRange} title="Programme de révision" eyebrow="Personnalisable" action={<Button size="sm" onClick={schedule}>Planifier les 2 prochaines semaines</Button>} />
      <div className="grid gap-2 p-5 md:grid-cols-7">
        {order.map((d) => (
          <div key={d} className={cn('rounded-2xl border p-3', String(new Date().getDay()) === d ? 'border-wine/30 bg-petal/60' : 'border-line')}>
            <div className="mb-2 text-sm font-semibold capitalize">{FR_DAYS[Number(d)]}</div>
            <Input defaultValue={plan[d]?.focus ?? ''} placeholder="Repos" onBlur={(e) => upd(d, { focus: e.target.value })} className="mb-2 py-1.5 text-xs" />
            <div className="flex items-center gap-1"><Input type="number" defaultValue={plan[d]?.minutes ?? 30} onBlur={(e) => upd(d, { minutes: Number(e.target.value) || 30 })} className="py-1 text-xs" /><span className="text-[10px] text-muted">min</span></div>
          </div>
        ))}
      </div>
      <p className="px-5 pb-5 text-xs text-muted">Les séances planifiées apparaissent dans My Tasks et My Calendar. Jadou AI peut aussi le faire : « Programme mes révisions TOEIC ».</p>
    </Card>
  );
}

// ------------------------------------------------------------------ page
export function ToeicPage() {
  const [tab, setTab] = React.useState<'dashboard' | 'exercises' | 'vocab' | 'mistakes' | 'plan' | 'scores' | 'resources'>('dashboard');
  const { data: t } = useApi<any>('/stats/toeic');
  const { data: attempts = [] } = useList('toeicAttempt', { orderBy: 'date', dir: 'asc' });
  const { data: mistakes = [] } = useList('toeicMistake', { where: { reviewed: false } });
  const open = useRecordDialog();
  const [session, setSession] = React.useState<Session | null>(null);
  const [timed, setTimed] = React.useState(false);

  const startPart = (part: number) => setSession({ part, sets: shuffle(TOEIC_SETS.filter((s) => s.part === part)).slice(0, part >= 5 ? (part === 5 ? 10 : 2) : part <= 2 ? 6 : 1), timed });
  const startMini = () => setSession({ part: 0, timed: true, sets: [1, 2, 3, 4, 5, 6, 7].flatMap((p) => shuffle(TOEIC_SETS.filter((s) => s.part === p)).slice(0, p === 5 ? 4 : p <= 2 ? 2 : 1)) });
  const startReview = () => {
    const ids = Array.from(new Set(mistakes.map((m) => m.questionId)));
    const sets = Array.from(new Map(ids.map((id) => questionById(id)).filter(Boolean).map((x) => [x!.set.id, x!.set])).values());
    if (!sets.length) return toast('Aucune erreur à retravailler ✨');
    setSession({ part: -1, sets: sets.slice(0, 8), timed: false });
  };

  const current = t?.current ?? null;
  const target = t?.target ?? 600;
  const byWeek = (() => {
    const out: Record<string, { s: number; n: number }> = {};
    for (const a of attempts) {
      const w = startOfWeek(a.date);
      out[w] ??= { s: 0, n: 0 };
      out[w].s += a.score;
      out[w].n += a.total;
    }
    return Object.entries(out).map(([week, v]) => ({ week, rate: Math.round((v.s / v.n) * 100) }));
  })();

  return (
    <Page>
      <PageHeader eyebrow="Studies & Career" title="TOEIC" accent="Academy" subtitle={`Objectif ${target}+ · Listening & Reading`} coverKey="toeic" variant={1} actions={<><Button icon={Play} onClick={startMini}>Mini-test</Button><Button variant="outline" icon={Brain} onClick={startReview}>Révision ciblée</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'exercises', label: 'Exercices' }, { value: 'vocab', label: 'Vocabulary Book' }, { value: 'mistakes', label: `Mistake Tracker ${mistakes.length || ''}` }, { value: 'plan', label: 'Planning' }, { value: 'scores', label: 'Scores' }, { value: 'resources', label: 'Resources' }]} />

      {tab === 'dashboard' && t && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Card className="flex flex-col items-center p-6">
              <Ring value={current ? pct(current, target) : 0} size={180} stroke={12}>
                <div className="text-center">
                  <div className="num font-display text-5xl">{current ?? '—'}</div>
                  <div className="text-xs text-muted">objectif {target}</div>
                </div>
              </Ring>
              <div className="mt-4 text-center text-sm">
                {current ? (current >= target ? <span className="font-semibold text-good">Objectif atteint 🎉</span> : <span>Encore <b>{target - current}</b> points</span>) : <span className="text-muted">Ajoute un score (test blanc ou officiel) pour suivre ta progression.</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="soft" onClick={() => open({ resource: 'toeicExam', defaults: { date: today(), type: 'mock' } })}>+ Score</Button>
                <Button size="sm" variant="outline" onClick={() => open({ resource: 'toeicExam', defaults: { type: 'planned', date: addDays(today(), 60) }, title: 'Date de l’examen' })}>Date d’examen</Button>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Date de l’examen" value={t.examDate ? `J-${diffDays(t.examDate, today())}` : '—'} sub={t.examDate ? formatFr(t.examDate, { weekday: true, year: true }) : 'Non renseignée'} icon={Target} />
              <Stat label="Temps de révision" value={`${nf(t.minutes / 60, 1)} h`} sub={`${t.weekMinutes} min cette semaine`} icon={Timer} />
              <Stat label="Exercices réalisés" value={t.exercises} sub={`${t.questions} questions · ${t.accuracy ?? '—'} % de réussite`} icon={BookOpen} />
              <Stat label="Flashcards à revoir" value={t.flashcardsDue} icon={BookMarked} />
              <Stat label="Erreurs à retravailler" value={mistakes.length} icon={Brain} />
              <Stat label="Meilleur score" value={t.best ?? '—'} icon={Trophy} />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Points faibles" eyebrow="Calculés sur tes exercices" />
              <div className="space-y-3 p-5">
                {!t.weakParts.length && !t.weakNotions.length && <Empty title="Pas encore assez de données" text="Fais quelques exercices dans chaque partie." className="py-4" />}
                {t.weakParts.map((w: any) => (
                  <div key={w.part}>
                    <div className="mb-1 flex justify-between text-sm"><span>Part {w.part} · {PARTS[w.part - 1].name}</span><span className="num font-semibold">{w.rate} %</span></div>
                    <Progress value={w.rate} color={w.rate < 60 ? 'rgb(var(--bad))' : w.rate < 80 ? 'rgb(var(--warn))' : 'rgb(var(--good))'} />
                  </div>
                ))}
                {t.weakNotions.length > 0 && <div className="pt-2"><div className="eyebrow mb-2">Notions à retravailler</div><div className="flex flex-wrap gap-1.5">{t.weakNotions.map((n: any) => <Badge key={n.notion} color="#B4413C">{n.notion} · {n.count}</Badge>)}</div></div>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Progression" eyebrow="Taux de réussite par semaine" />
              <div className="p-5">{byWeek.length >= 2 ? <TrendChart type="line" data={byWeek} x="week" labelFmt={(d) => formatFr(d)} series={[{ key: 'rate', name: 'Réussite' }]} fmt="pct" /> : <Empty title="Courbe disponible après 2 semaines d’entraînement" className="py-8" />}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'exercises' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3"><span className="text-sm text-muted">Mode :</span><Segmented size="sm" value={timed ? 't' : 'p'} onChange={(v) => setTimed(v === 't')} options={[{ value: 'p', label: 'Entraînement libre' }, { value: 't', label: 'Chronométré' }]} /></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PARTS.map((p) => {
              const a = attempts.filter((x) => x.part === p.part);
              const rate = a.length ? pct(a.reduce((s, x) => s + x.score, 0), a.reduce((s, x) => s + x.total, 0)) : null;
              return (
                <Card key={p.part} hover className="flex flex-col p-5">
                  <div className="mb-2 flex items-center gap-2">{p.skill === 'Listening' ? <Headphones className="h-4 w-4 text-wine" /> : <BookOpen className="h-4 w-4 text-wine" />}<span className="eyebrow">{p.skill} · Part {p.part}</span></div>
                  <div className="font-display text-2xl">{p.name}</div>
                  <p className="mt-1 flex-1 text-xs text-muted">{p.desc}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>{TOEIC_SETS.filter((s) => s.part === p.part).reduce((s, x) => s + x.questions.length, 0)} questions</span><span>{rate != null ? `${rate} % réussite` : 'Jamais fait'}</span></div>
                  <Button size="sm" className="mt-3" icon={Play} onClick={() => startPart(p.part)}>Commencer</Button>
                </Card>
              );
            })}
            <Card className="flex flex-col justify-between bg-wine p-5 text-onwine">
              <div><div className="eyebrow text-onwine/70">Toutes parties</div><div className="font-display text-2xl">Mini-test</div><p className="mt-1 text-xs text-onwine/70">Un échantillon chronométré des 7 parties.</p></div>
              <Button variant="soft" className="mt-3" icon={Play} onClick={startMini}>Lancer</Button>
            </Card>
          </div>
          <p className="text-xs text-muted">Contenu original rédigé pour Jadou Planner (questions au format TOEIC, non issues des examens officiels). Ajoute tes propres ressources autorisées dans l’onglet Resources.</p>
          <ResourceTable resource="toeicAttempt" title="Historique" columns={['date', 'part', 'mode', 'score', 'total', 'durationSec']} />
        </div>
      )}

      {tab === 'vocab' && <Flashcards />}
      {tab === 'mistakes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={RotateCcw} onClick={startReview} disabled={!mistakes.length}>Refaire mes erreurs</Button>
            <span className="text-sm text-muted">Une bonne réponse en révision marque l’erreur comme retravaillée.</span>
          </div>
          <ResourceTable resource="toeicMistake" title="Mistake Tracker" columns={['date', 'part', 'notion', 'yourAnswer', 'correctAnswer', 'reviewed']} filterField={undefined} />
        </div>
      )}
      {tab === 'plan' && <Planning />}
      {tab === 'scores' && <ResourceTable resource="toeicExam" title="Scores & examens" defaults={{ date: today(), type: 'mock' }} />}
      {tab === 'resources' && <ResourceTable resource="resource" title="Bibliothèque TOEIC" params={{ where: { folder: 'toeic' } }} defaults={{ folder: 'toeic' }} />}

      {session && <Exercise session={session} onClose={() => setSession(null)} />}
    </Page>
  );
}
