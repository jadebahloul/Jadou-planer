import * as React from 'react';
import { Plus, Lightbulb, Rocket, Clock, Check, FolderOpen } from 'lucide-react';
import { today, startOfMonth, endOfMonth } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel } from '@shared/registry';
import { useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge, Rating, Modal, Progress, Textarea } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, nf, pct } from '@/lib/utils';

const STAGES = REGISTRY.businessIdea.fields.stage.options;

function IdeaModal({ idea, onClose }: { idea: Row | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const open = useRecordDialog();
  const [roadmap, setRoadmap] = React.useState<Record<string, { done?: boolean; notes?: string }>>({});
  React.useEffect(() => setRoadmap(idea?.roadmap ?? {}), [idea]);
  if (!idea) return null;
  const save = async (next: typeof roadmap) => {
    setRoadmap(next);
    const lastDone = [...STAGES].reverse().find((s) => next[s.value]?.done);
    await api(`/r/businessIdea/${idea.id}`, { method: 'PATCH', body: { roadmap: next, stage: lastDone?.value ?? 'idea' } });
    invalidate();
  };
  const p = pct(STAGES.filter((s) => roadmap[s.value]?.done).length, STAGES.length);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={idea.name} description={idea.sector ?? undefined} size="lg" footer={<><Button variant="ghost" onClick={() => open({ resource: 'businessIdea', id: idea.id })}>Modifier la fiche</Button><Button onClick={onClose}>Fermer</Button></>}>
      <div className="mb-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-sunken/70 p-3"><div className="text-xs text-muted">Budget</div><div className="font-semibold">{idea.budget ? eur(idea.budget) : '—'}</div></div>
        <div className="rounded-xl bg-sunken/70 p-3"><div className="text-xs text-muted">Potentiel</div><Rating value={idea.potential} size={14} /></div>
        <div className="rounded-xl bg-sunken/70 p-3"><div className="text-xs text-muted">Difficulté</div><Rating value={idea.difficulty} size={14} /></div>
        <div className="rounded-xl bg-sunken/70 p-3"><div className="text-xs text-muted">Clientèle</div><div className="truncate font-semibold">{idea.audience ?? '—'}</div></div>
      </div>
      {idea.description && <p className="mb-4 whitespace-pre-wrap text-sm">{idea.description}</p>}
      <div className="eyebrow mb-2 flex items-center justify-between">Project Roadmap <span>{p} %</span></div>
      <Progress value={p} className="mb-4" />
      <div className="space-y-2">
        {STAGES.map((s, i) => (
          <div key={s.value} className={cn('rounded-2xl border p-3', roadmap[s.value]?.done ? 'border-good/30 bg-good/5' : 'border-line')}>
            <button onClick={() => save({ ...roadmap, [s.value]: { ...roadmap[s.value], done: !roadmap[s.value]?.done } })} className="flex w-full items-center gap-3 text-left">
              <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs font-semibold', roadmap[s.value]?.done ? 'bg-good text-white' : 'bg-sunken')}>{roadmap[s.value]?.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className="font-medium">{s.label}</span>
            </button>
            <Textarea defaultValue={roadmap[s.value]?.notes ?? ''} placeholder="Notes, liens, conclusions…" className="mt-2 min-h-[50px] text-xs" onBlur={(e) => e.target.value !== (roadmap[s.value]?.notes ?? '') && save({ ...roadmap, [s.value]: { ...roadmap[s.value], notes: e.target.value } })} />
          </div>
        ))}
      </div>
      {idea.risks && <div className="mt-4 rounded-2xl bg-bad/5 p-3 text-sm"><div className="eyebrow mb-1">Risques</div>{idea.risks}</div>}
    </Modal>
  );
}

export function IdeasPage() {
  const { data: ideas = [] } = useList('businessIdea');
  const { data: notes = [] } = useList('note', { where: { kind: 'idea' } });
  const open = useRecordDialog();
  const [sel, setSel] = React.useState<Row | null>(null);
  const [sort, setSort] = React.useState<'recent' | 'potential'>('recent');
  const list = [...ideas].sort((a, b) => (sort === 'potential' ? (b.potential ?? 0) - (b.difficulty ?? 0) / 2 - ((a.potential ?? 0) - (a.difficulty ?? 0) / 2) : 0));
  return (
    <Page>
      <PageHeader eyebrow="Business" title="Business" accent="Ideas" subtitle="Chaque idée mérite une fiche : secteur, clientèle, budget, potentiel, difficulté, risques." coverKey="ideas" variant={0} actions={<Button icon={Plus} onClick={() => open({ resource: 'businessIdea' })}>Idée</Button>} />
      <Segmented className="mb-5" size="sm" value={sort} onChange={setSort} options={[{ value: 'recent', label: 'Récentes' }, { value: 'potential', label: 'Meilleur potentiel' }]} />
      {list.length === 0 ? <Card><Empty icon={Lightbulb} title="Aucune idée enregistrée" text="Capture-les vite avec Quick Add : « Idée business : … »." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => (
            <Card key={i.id} hover className="cursor-pointer p-5" onClick={() => setSel(i)}>
              <div className="mb-2 flex items-center gap-2"><Badge color="#C9A35F">{optionLabel(STAGES, i.stage)}</Badge>{i.sector && <Badge>{i.sector}</Badge>}</div>
              <div className="font-display text-2xl leading-tight">{i.name}</div>
              {i.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{i.description}</p>}
              <div className="mt-4 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1">Potentiel <Rating value={i.potential} size={12} /></span>
                <span>{i.budget ? eur(i.budget) : ''}</span>
              </div>
              <Progress value={pct(STAGES.findIndex((s) => s.value === i.stage) + 1, STAGES.length)} className="mt-3" height={4} color="#C9A35F" />
            </Card>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <Card className="mt-5">
          <CardHeader icon={Lightbulb} title="Idées rapides (Quick Capture)" />
          <div className="flex flex-wrap gap-2 p-4">
            {notes.map((n) => <button key={n.id} onClick={() => open({ resource: 'businessIdea', defaults: { name: n.content.slice(0, 80) }, title: 'Transformer en fiche idée' })} className="chip">{n.content.slice(0, 60)} →</button>)}
          </div>
        </Card>
      )}
      <IdeaModal idea={sel} onClose={() => setSel(null)} />
    </Page>
  );
}

export function EntrepreneurshipPage() {
  const [tab, setTab] = React.useState<'hustles' | 'log' | 'resources'>('hustles');
  const { data: hustles = [] } = useList('sideHustle');
  const { data: logs = [] } = useList('sideHustleLog');
  const { data: ideas = [] } = useList('businessIdea');
  const open = useRecordDialog();
  const m0 = startOfMonth(today());
  const m1 = endOfMonth(today());
  const stats = (h: Row, monthOnly = false) => {
    const ls = logs.filter((l) => l.hustleId === h.id && (!monthOnly || (l.date >= m0 && l.date <= m1)));
    const rev = ls.reduce((s, l) => s + (l.revenue ?? 0), 0);
    const exp = ls.reduce((s, l) => s + (l.expense ?? 0), 0);
    const hours = ls.reduce((s, l) => s + (l.hours ?? 0), 0);
    return { rev, exp, hours, net: rev - exp, hourly: hours ? (rev - exp) / hours : null };
  };
  const totalMonth = hustles.reduce((s, h) => s + stats(h, true).net, 0);
  return (
    <Page>
      <PageHeader eyebrow="Business" title="Entre" accent="preneurship" subtitle="Construire plusieurs sources de revenus — et un vrai business physique." coverKey="entrepreneurship" variant={2} actions={<><Button icon={Plus} onClick={() => open({ resource: 'sideHustle' })}>Side hustle</Button><Button variant="outline" icon={Clock} onClick={() => open({ resource: 'sideHustleLog', defaults: { date: today(), hustleId: hustles[0]?.id } })} disabled={!hustles.length}>Saisir revenus / heures</Button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Résultat du mois" value={eur(totalMonth)} accent icon={Rocket} />
        <Stat label="Activités" value={hustles.filter((h) => h.active).length} />
        <Stat label="Idées en cours" value={ideas.length} icon={Lightbulb} />
        <Stat label="Heures ce mois" value={nf(hustles.reduce((s, h) => s + stats(h, true).hours, 0), 1)} />
      </div>
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'hustles', label: 'Side Hustles' }, { value: 'log', label: 'Journal' }, { value: 'resources', label: 'Business Resources' }]} />
      {tab === 'hustles' && (hustles.length === 0 ? <Card><Empty icon={Rocket} title="Aucune activité" text="Suis revenus, dépenses, temps consacré et rentabilité horaire de chaque activité." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hustles.map((h) => {
            const all = stats(h);
            const mo = stats(h, true);
            return (
              <Card key={h.id} hover className="cursor-pointer p-5" onClick={() => open({ resource: 'sideHustle', id: h.id })}>
                <div className="flex items-center gap-2"><div className="font-display text-2xl">{h.name}</div>{!h.active && <Badge>En pause</Badge>}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{eur(mo.net)}</div><div className="text-muted">ce mois</div></div>
                  <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{eur(all.net)}</div><div className="text-muted">total</div></div>
                  <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{mo.hourly != null ? `${eur(mo.hourly)}/h` : '—'}</div><div className="text-muted">rentabilité</div></div>
                </div>
                {h.monthlyGoal ? <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted"><span>Objectif mensuel</span><span>{eur(mo.net)} / {eur(h.monthlyGoal)}</span></div><Progress value={pct(mo.net, h.monthlyGoal)} /></div> : null}
              </Card>
            );
          })}
        </div>
      ))}
      {tab === 'log' && <ResourceTable resource="sideHustleLog" title="Revenus, dépenses & heures" defaults={{ date: today(), hustleId: hustles[0]?.id }} />}
      {tab === 'resources' && (
        <div className="space-y-3">
          <Card className="flex items-center gap-2 p-4 text-sm text-muted"><FolderOpen className="h-4 w-4 text-wine" />Documents, liens, notes, budgets : associe-les au dossier « Business ». Les tâches business apparaissent dans My Tasks (catégorie Business).</Card>
          <ResourceTable resource="resource" title="Ressources business" params={{ where: { folder: 'business' } }} defaults={{ folder: 'business' }} />
        </div>
      )}
    </Page>
  );
}
