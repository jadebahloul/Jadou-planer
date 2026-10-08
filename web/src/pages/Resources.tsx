import * as React from 'react';
import { Plus, FolderOpen, Star, Search, FileText, Link2, Image as ImageIcon, Video, Download, ExternalLink, ListChecks, Target } from 'lucide-react';
import { REGISTRY, optionLabel } from '@shared/registry';
import { eur } from '@shared/finance';
import { useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Segmented, Input, Modal, Badge, Progress } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, pct } from '@/lib/utils';

const FOLDERS = REGISTRY.resource.fields.folder.options;
const TYPES = REGISTRY.resource.fields.type.options;
const ICON: Record<string, any> = { link: Link2, image: ImageIcon, video: Video };
const isImg = (u?: string) => !!u && /\.(png|jpe?g|webp|gif|avif)$/i.test(u);

function Preview({ r, onClose }: { r: Row | null; onClose: () => void }) {
  const open = useRecordDialog();
  if (!r) return null;
  const file = r.file as string | undefined;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={r.title} description={`${optionLabel(TYPES, r.type)} · ${optionLabel(FOLDERS, r.folder)}`} size="xl" footer={<><Button variant="ghost" onClick={() => (onClose(), open({ resource: 'resource', id: r.id }))}>Modifier</Button>{file && <a href={`${file}?download=1`}><Button variant="outline" icon={Download}>Télécharger</Button></a>}{r.url && <a href={r.url} target="_blank" rel="noreferrer"><Button icon={ExternalLink}>Ouvrir le lien</Button></a>}</>}>
      {file && isImg(file) && <img src={file} alt="" className="mx-auto max-h-[60vh] rounded-2xl" />}
      {file && /\.pdf$/i.test(file) && <iframe src={file} title={r.title} className="h-[65vh] w-full rounded-2xl border border-line" />}
      {file && /\.(mp3|m4a|wav|ogg)$/i.test(file) && <audio controls src={file} className="w-full" />}
      {file && /\.(mp4|webm|mov)$/i.test(file) && <video controls src={file} className="w-full rounded-2xl" />}
      {r.notes && <p className="mt-4 whitespace-pre-wrap text-sm">{r.notes}</p>}
      {(r.tags ?? []).length > 0 && <div className="mt-3 text-xs text-wine">{(r.tags as string[]).map((t) => `#${t}`).join(' ')}</div>}
    </Modal>
  );
}

function Plans() {
  const { data: plans = [] } = useList('resourcePlan');
  const { data: goals = [] } = useList('goal');
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const presets = ['Préparation TOEIC', 'Développement activité cils', 'Investissement immobilier', 'Lancement d’entreprise', 'Projet scolaire'];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button icon={Plus} onClick={() => open({ resource: 'resourcePlan', defaults: { steps: [] } })}>Plan</Button>
        {presets.filter((p) => !plans.some((x) => x.title === p)).map((p) => <button key={p} className="chip" onClick={() => open({ resource: 'resourcePlan', defaults: { title: p, steps: [] } })}>+ {p}</button>)}
      </div>
      {plans.length === 0 ? <Card><Empty icon={ListChecks} title="Aucun plan de ressources" text="Objectif, budget, temps, ressources, étapes et progression pour chaque grand projet." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => {
            const steps = (p.steps ?? []) as { id: string; title: string; done?: boolean }[];
            const pr = pct(steps.filter((s) => s.done).length, steps.length);
            const goal = goals.find((g) => g.id === p.goalId);
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start gap-2"><div className="flex-1 cursor-pointer" onClick={() => open({ resource: 'resourcePlan', id: p.id })}><div className="font-display text-2xl">{p.title}</div>{p.objective && <p className="text-sm text-muted">{p.objective}</p>}</div><span className="num font-display text-2xl text-wine">{pr}%</span></div>
                <Progress value={pr} className="my-3" />
                <div className="mb-3 flex flex-wrap gap-1.5">{p.budget != null && <Badge>Budget {eur(p.budget)}</Badge>}{p.timeEstimate && <Badge>{p.timeEstimate}</Badge>}{goal && <Badge color="#C9A35F"><Target className="h-3 w-3" />{goal.title}</Badge>}</div>
                <div className="space-y-1">
                  {steps.map((s) => (
                    <button key={s.id} onClick={async () => { await api(`/r/resourcePlan/${p.id}`, { method: 'PATCH', body: { steps: steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) } }); invalidate(); }} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-sunken">
                      <span className={cn('h-4 w-4 rounded-[5px] border', s.done ? 'border-wine bg-wine' : 'border-line')} /><span className={cn(s.done && 'text-muted line-through')}>{s.title}</span>
                    </button>
                  ))}
                </div>
                {p.resources && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-sunken/60 p-3 text-xs">{p.resources}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ResourcesPage() {
  const [tab, setTab] = React.useState<'library' | 'plans'>('library');
  const { data: res = [] } = useList('resource');
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const [folder, setFolder] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [fav, setFav] = React.useState(false);
  const [sort, setSort] = React.useState<'recent' | 'az'>('recent');
  const [preview, setPreview] = React.useState<Row | null>(null);
  const list = res
    .filter((r) => (!folder || r.folder === folder) && (!fav || r.favorite) && (!q || `${r.title} ${r.notes ?? ''} ${(r.tags ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (sort === 'az' ? a.title.localeCompare(b.title) : b.id - a.id));
  return (
    <Page>
      <PageHeader eyebrow="Organization" title="Resource" accent="Hub" subtitle="PDF, documents, images, liens, vidéos, notes, fiches, tableaux, modèles." coverKey="resources" variant={1} actions={<Button icon={Plus} onClick={() => open({ resource: 'resource', defaults: { folder: folder ?? 'general' } })}>Ressource</Button>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'library', label: 'Bibliothèque' }, { value: 'plans', label: 'Resource Planning' }]} />
      {tab === 'plans' ? <Plans /> : (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <Card className="h-fit p-2">
            <button onClick={() => setFolder(null)} className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm', !folder ? 'bg-petal font-semibold text-wine' : 'hover:bg-sunken')}><FolderOpen className="h-4 w-4" />Tous<span className="ml-auto text-xs text-muted">{res.length}</span></button>
            {FOLDERS.map((f) => (
              <button key={f.value} onClick={() => setFolder(f.value)} className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm', folder === f.value ? 'bg-petal font-semibold text-wine' : 'hover:bg-sunken')}><FolderOpen className="h-4 w-4" />{f.label}<span className="ml-auto text-xs text-muted">{res.filter((r) => r.folder === f.value).length || ''}</span></button>
            ))}
          </Card>
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher titre, tags, notes…" className="rounded-full pl-8" /></div>
              <button className={cn('chip', fav && 'chip-active')} onClick={() => setFav(!fav)}><Star className="h-3.5 w-3.5" />Favoris</button>
              <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'recent', label: 'Récents' }, { value: 'az', label: 'A–Z' }]} />
            </div>
            {list.length === 0 ? <Card><Empty icon={FolderOpen} title="Aucune ressource" text="Dépose un fichier, colle un lien ou écris une fiche." /></Card> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((r) => {
                  const Icon = ICON[r.type] ?? FileText;
                  return (
                    <Card key={r.id} hover className="cursor-pointer overflow-hidden" onClick={() => (r.file || r.notes ? setPreview(r) : r.url ? window.open(r.url, '_blank', 'noopener') : open({ resource: 'resource', id: r.id }))}>
                      {isImg(r.file) && <img src={r.file} alt="" className="h-32 w-full object-cover" />}
                      <div className="flex items-start gap-3 p-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-petal text-wine"><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-muted">{optionLabel(TYPES, r.type)} · {optionLabel(FOLDERS, r.folder)}</div>{(r.tags ?? []).length > 0 && <div className="truncate text-[11px] text-wine">{(r.tags as string[]).map((t) => `#${t}`).join(' ')}</div>}</div>
                        <button onClick={async (e) => { e.stopPropagation(); await api(`/r/resource/${r.id}`, { method: 'PATCH', body: { favorite: !r.favorite } }); invalidate(); }} aria-label="Favori"><Star className={cn('h-4 w-4', r.favorite ? 'fill-wine text-wine' : 'text-line')} /></button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <Preview r={preview} onClose={() => setPreview(null)} />
    </Page>
  );
}
