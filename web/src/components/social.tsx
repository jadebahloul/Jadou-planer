import * as React from 'react';
import { ChevronLeft, ChevronRight, Plus, Image as ImageIcon, FileText, Hash, Lightbulb, Video, Link2, Copy } from 'lucide-react';
import { REGISTRY, optionLabel, optionColor } from '@shared/registry';
import { startOfMonth, endOfMonth, addMonths, eachDay, startOfWeek, addDays, today, FR_MONTHS, formatFr } from '@shared/dates';
import { useList, type Row } from '@/lib/hooks';
import { Button, Card, CardHeader, Empty, IconButton, Badge, Segmented, Stat } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { TrendChart, BarsChart } from '@/components/charts';
import { cn, nf } from '@/lib/utils';
import { toast } from 'sonner';

const F = REGISTRY.contentPost.fields;

export function ContentPlanner({ account }: { account: 'pharmacy' | 'lash' }) {
  const [month, setMonth] = React.useState(startOfMonth(today()));
  const [view, setView] = React.useState<'month' | 'list'>('month');
  const gridStart = startOfWeek(month);
  const gridEnd = addDays(startOfWeek(endOfMonth(month)), 6);
  const days = eachDay(gridStart, gridEnd);
  const { data: posts = [] } = useList('contentPost', { where: { account, date: { gte: gridStart, lte: gridEnd } } });
  const open = useRecordDialog();
  const defaults = (d: string) => ({ account, date: d, status: 'idea', network: account === 'lash' ? 'instagram' : 'instagram' });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon={ChevronLeft} label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} />
        <div className="h-display min-w-[170px] text-center text-2xl capitalize">{FR_MONTHS[+month.slice(5, 7) - 1]} {month.slice(0, 4)}</div>
        <IconButton icon={ChevronRight} label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} />
        <Segmented size="sm" className="ml-2" value={view} onChange={setView} options={[{ value: 'month', label: 'Calendrier' }, { value: 'list', label: 'Liste' }]} />
        <Button size="sm" icon={Plus} className="ml-auto" onClick={() => open({ resource: 'contentPost', defaults: defaults(today()) })}>Publication</Button>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted">
        {F.status.options.map((o) => <span key={o.value} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: o.color }} />{o.label}</span>)}
        <span className="ml-auto">Aucune publication automatique : tout reste un plan éditorial.</span>
      </div>
      {view === 'list' ? (
        <ResourceTable resource="contentPost" params={{ where: { account } }} defaults={defaults(today())} filterField="status" />
      ) : (
        <Card className="overflow-x-auto p-3">
          <div className="grid min-w-[720px] grid-cols-7 gap-1.5">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="eyebrow px-2 pb-1">{d}</div>)}
            {days.map((d) => {
              const ps = posts.filter((p) => p.date === d);
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              return (
                <div key={d} className={cn('group min-h-[110px] rounded-2xl border p-1.5', d === today() ? 'border-wine/30 bg-petal/50' : 'border-line/70', !inMonth && 'opacity-40')}>
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span className="num text-xs font-semibold">{+d.slice(8)}</span>
                    <button onClick={() => open({ resource: 'contentPost', defaults: defaults(d) })} className="opacity-0 transition group-hover:opacity-100" aria-label="Ajouter"><Plus className="h-3.5 w-3.5 text-muted" /></button>
                  </div>
                  <div className="space-y-1">
                    {ps.map((p) => (
                      <button key={p.id} onClick={() => open({ resource: 'contentPost', id: p.id })} className="flex w-full items-center gap-1.5 overflow-hidden rounded-lg bg-surface p-1 text-left text-[10px] shadow-sm ring-1 ring-line/70">
                        {p.visual ? <img src={p.visual} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" /> : <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: optionColor(F.status.options, p.status) }} />}
                        <span className="min-w-0"><span className="block truncate font-semibold">{p.theme}</span><span className="block truncate text-muted">{optionLabel(F.network.options, p.network)} · {optionLabel(F.format.options, p.format)}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

const ASSET_ICON: Record<string, any> = { photo: ImageIcon, visual: ImageIcon, video: Video, text: FileText, hashtags: Hash, idea: Lightbulb, inspiration: Lightbulb, document: Link2 };

export function ContentLibrary({ account }: { account: 'pharmacy' | 'lash' }) {
  const { data: assets = [] } = useList('contentAsset', { where: { account } });
  const open = useRecordDialog();
  const [type, setType] = React.useState<string | null>(null);
  const types = REGISTRY.contentAsset.fields.type.options;
  const list = assets.filter((a) => !type || a.type === type);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button className={cn('chip', !type && 'chip-active')} onClick={() => setType(null)}>Tout</button>
        {types.map((t) => <button key={t.value} className={cn('chip', type === t.value && 'chip-active')} onClick={() => setType(t.value)}>{t.label}</button>)}
        <Button size="sm" icon={Plus} className="ml-auto" onClick={() => open({ resource: 'contentAsset', defaults: { account, type: type ?? 'idea' } })}>Ajouter</Button>
      </div>
      {list.length === 0 ? <Card><Empty icon={ImageIcon} title="Bibliothèque vide" text="Photos, vidéos, idées, textes, hashtags, inspirations, documents." /></Card> : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
          {list.map((a) => {
            const Icon = ASSET_ICON[a.type] ?? FileText;
            return (
              <div key={a.id} onClick={() => open({ resource: 'contentAsset', id: a.id })} className="card card-hover block cursor-pointer break-inside-avoid overflow-hidden">
                {a.image && /\.(png|jpe?g|webp|gif|avif)$/i.test(a.image) && <img src={a.image} alt="" className="w-full object-cover" />}
                <div className="p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted"><Icon className="h-3 w-3" />{optionLabel(types, a.type)}</div>
                  <div className="text-sm font-medium">{a.title}</div>
                  {a.content && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted">{a.content}</p>}
                  {a.content && (a.type === 'hashtags' || a.type === 'text') && (
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(a.content); toast('Copié ♡'); }} className="chip mt-2 py-0.5"><Copy className="h-3 w-3" />Copier</button>
                  )}
                  {(a.tags ?? []).length > 0 && <div className="mt-1 text-[11px] text-wine">{(a.tags as string[]).map((t) => `#${t}`).join(' ')}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Performance({ account }: { account: 'pharmacy' | 'lash' }) {
  const { data: metrics = [] } = useList('socialMetric', { where: { account }, orderBy: 'date', dir: 'asc' });
  const [net, setNet] = React.useState('instagram');
  const rows = metrics.filter((m) => m.network === net);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const delta = (k: string) => (last && prev && last[k] != null && prev[k] != null ? last[k] - prev[k] : null);
  return (
    <div className="space-y-5">
      <Segmented size="sm" value={net} onChange={setNet} options={REGISTRY.socialMetric.fields.network.options} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['followers', 'Abonnés'], ['views', 'Vues'], ['interactions', 'Interactions'], ['engagementRate', 'Engagement']].map(([k, l]) => (
          <Stat key={k} label={l} value={last?.[k] != null ? (k === 'engagementRate' ? `${nf(last[k], 1)} %` : nf(last[k])) : '—'} sub={delta(k) != null ? `${delta(k)! >= 0 ? '+' : ''}${nf(delta(k)!, 1)} depuis le ${formatFr(prev.date)}` : last ? `relevé du ${formatFr(last.date)}` : 'Aucun relevé'} />
        ))}
      </div>
      {rows.length >= 2 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHeader title="Abonnés" /><div className="p-5"><TrendChart data={rows} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'followers', name: 'Abonnés' }]} /></div></Card>
          <Card><CardHeader title="Vues & interactions" /><div className="p-5"><BarsChart data={rows} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'views', name: 'Vues' }, { key: 'interactions', name: 'Interactions' }]} /></div></Card>
        </div>
      ) : (
        <Card><Empty title="Ajoute au moins deux relevés" text="Saisis tes statistiques (depuis l’app Instagram/TikTok) chaque semaine ou chaque mois pour voir l’évolution." /></Card>
      )}
      <ResourceTable resource="socialMetric" title="Relevés" params={{ where: { account } }} defaults={{ account, date: today(), network: net, source: 'manual' }} />
    </div>
  );
}

export { Badge };
export type { Row };
