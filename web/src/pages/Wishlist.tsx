import * as React from 'react';
import { Plus, Heart, ExternalLink, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import { eur } from '@shared/finance';
import { WISHLIST_CATEGORIES, WISHLIST_STATUS, optionLabel, optionColor } from '@shared/registry';
import { today } from '@shared/dates';
import { useApi, useList, useInvalidate } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Stat, Badge, Menu } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { askJadou } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function WishlistPage() {
  const { data: items = [] } = useList('wishlistItem');
  const { data: m } = useApi<any>('/stats/money');
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const [cat, setCat] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const activeItems = items.filter((i) => !['purchased', 'archived'].includes(i.status));
  const list = items.filter((i) => (!cat || i.category === cat) && (status ? i.status === status : i.status !== 'archived'));
  const room = m ? Math.max(0, m.income - m.expense - (m.budget?.plannedSavings ?? 0)) : 0;

  const setSt = async (id: number, s: string) => {
    await api(`/r/wishlistItem/${id}`, { method: 'PATCH', body: { status: s } });
    invalidate();
    if (s === 'purchased') toast.success('Acheté ♡ — ajoute un compte de paiement dans la fiche pour enregistrer la dépense automatiquement.');
  };

  return (
    <Page>
      <PageHeader eyebrow="Lifestyle" title="My" accent="Wishlist" subtitle="Mes envies, mes priorités, mon budget." coverKey="wishlist" variant={0} actions={<><Button icon={Plus} onClick={() => open({ resource: 'wishlistItem', defaults: { category: cat ?? 'other' } })}>Produit</Button><Button variant="outline" icon={Sparkles} onClick={askJadou}>Demander à Jadou</Button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Produits" value={activeItems.length} icon={Heart} />
        <Stat label="Budget total" value={eur(activeItems.reduce((s, i) => s + (i.price ?? 0), 0))} accent />
        <Stat label="Prioritaires" value={activeItems.filter((i) => i.priority === 'high').length} />
        <Stat label="Achetés" value={items.filter((i) => i.status === 'purchased').length} icon={ShoppingBag} />
        <Stat label="En attente" value={items.filter((i) => ['saving', 'waiting_sale'].includes(i.status)).length} sub={m?.hasAccounts ? `marge du mois : ${eur(room)}` : undefined} />
      </div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <button className={cn('chip shrink-0', !cat && 'chip-active')} onClick={() => setCat(null)}>Toutes</button>
        {WISHLIST_CATEGORIES.map((c) => <button key={c.value} className={cn('chip shrink-0', cat === c.value && 'chip-active')} onClick={() => setCat(cat === c.value ? null : c.value)}>{c.label}</button>)}
      </div>
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <button className={cn('chip shrink-0', !status && 'chip-active')} onClick={() => setStatus(null)}>Purchase Planner : tout</button>
        {WISHLIST_STATUS.map((s) => <button key={s.value} className={cn('chip shrink-0', status === s.value && 'chip-active')} onClick={() => setStatus(status === s.value ? null : s.value)}><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.label}</button>)}
      </div>
      {list.length === 0 ? <Card><Empty icon={Heart} title="Rien ici pour l’instant" text="Ajoute un produit avec sa photo, son prix et son lien. Tu peux le relier à un objectif d’épargne." /></Card> : (
        <div className="columns-2 gap-4 md:columns-3 xl:columns-4 [&>*]:mb-4">
          {list.map((i) => (
            <div key={i.id} className="card card-hover group relative break-inside-avoid overflow-hidden">
              <button onClick={() => open({ resource: 'wishlistItem', id: i.id })} className="block w-full text-left">
                {i.image ? <img src={i.image} alt={i.name} className="w-full object-cover" loading="lazy" /> : (
                  <div className="grid aspect-[4/5] place-items-center bg-gradient-to-br from-petal via-surface to-sand"><span className="font-display text-5xl italic text-wine/30">{i.name.slice(0, 1)}</span></div>
                )}
                <div className="p-3.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {i.brand && <div className="eyebrow text-[10px]">{i.brand}</div>}
                      <div className="font-medium leading-snug">{i.name}</div>
                    </div>
                    {i.priority === 'high' && <Heart className="h-4 w-4 shrink-0 fill-wine text-wine" />}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="num font-display text-xl">{i.price != null ? eur(i.price, 2) : '—'}</span>
                    <Badge color={optionColor(WISHLIST_STATUS, i.status)}>{optionLabel(WISHLIST_STATUS, i.status)}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{optionLabel(WISHLIST_CATEGORIES, i.category)}</span>
                    {i.size && <span>Taille {i.size}</span>}{i.color && <span>{i.color}</span>}
                  </div>
                </div>
              </button>
              <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full bg-surface/90 shadow" aria-label="Voir le produit"><ExternalLink className="h-3.5 w-3.5" /></a>}
                <div className="rounded-full bg-surface/90 shadow"><Menu items={WISHLIST_STATUS.filter((s) => s.value !== i.status).map((s) => ({ label: `→ ${s.label}`, onSelect: () => setSt(i.id, s.value) }))} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Shopping Budget : la marge affichée = revenus du mois − dépenses − épargne prévue au budget. À l’achat, si un compte de paiement est renseigné, la dépense est ajoutée à My Banks automatiquement.</p>
    </Page>
  );
}
