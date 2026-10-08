import * as React from 'react';
import { Plus, Sparkles, Sun, Moon, Check, Scissors, CalendarHeart, RotateCcw } from 'lucide-react';
import { today, formatFr, addDays, startOfMonth } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel, optionColor } from '@shared/registry';
import { useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge, Progress, Rating } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TrendChart } from '@/components/charts';
import { cn, pct } from '@/lib/utils';

const PF = REGISTRY.beautyProduct.fields;

export function RoutineCard({ routine, icon: Icon }: { routine: Row; icon: any }) {
  const { data: logs = [] } = useList('routineLog', { where: { routineId: routine.id, date: today() } });
  const invalidate = useInvalidate();
  const open = useRecordDialog();
  const log = logs[0];
  const done: string[] = log?.done ?? [];
  const steps = (routine.steps ?? []) as { id: string; title: string }[];
  const toggle = async (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    if (log) await api(`/r/routineLog/${log.id}`, { method: 'PATCH', body: { done: next } });
    else await api('/r/routineLog', { body: { routineId: routine.id, date: today(), done: next } });
    invalidate();
  };
  const p = pct(done.length, steps.length);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line/70 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-petal text-wine"><Icon className="h-5 w-5" strokeWidth={1.6} /></span>
        <div className="flex-1"><div className="font-semibold">{routine.name}</div><div className="text-xs text-muted">{done.length}/{steps.length} étapes {p === 100 && '· complète ✨'}</div></div>
        <button onClick={() => open({ resource: 'routine', id: routine.id })} className="text-xs text-muted hover:text-wine">Modifier</button>
      </div>
      <div className="space-y-1 p-3">
        {steps.length === 0 && <div className="p-2 text-xs text-muted">Ajoute des étapes dans « Modifier ».</div>}
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => toggle(s.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-sunken/70">
            <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold transition', done.includes(s.id) ? 'border-wine bg-wine text-onwine' : 'border-line text-muted')}>{done.includes(s.id) ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className={cn(done.includes(s.id) && 'text-muted line-through')}>{s.title}</span>
          </button>
        ))}
      </div>
      <Progress value={p} height={3} className="rounded-none" />
    </Card>
  );
}

export function BeautyPage() {
  const [tab, setTab] = React.useState<'routines' | 'products' | 'hair' | 'appointments' | 'spending'>('routines');
  const { data: routines = [] } = useList('routine');
  const { data: products = [] } = useList('beautyProduct');
  const { data: hair = [] } = useList('hairLog', { orderBy: 'date', dir: 'asc' });
  const { data: appts = [] } = useList('event', { where: { category: 'beaute' } });
  const { data: spend = [] } = useList('transaction', { where: { category: 'beaute', type: 'expense', date: { gte: startOfMonth(addDays(today(), -330)) } } });
  const open = useRecordDialog();
  const [cat, setCat] = React.useState<string | null>(null);
  const t0 = today();
  const am = routines.filter((r) => r.type === 'skincare_am' || r.type === 'morning');
  const pm = routines.filter((r) => r.type === 'skincare_pm' || r.type === 'evening');
  const other = routines.filter((r) => !am.includes(r) && !pm.includes(r));
  const toRebuy = products.filter((p) => p.status === 'to_rebuy');
  const monthSpend = spend.filter((s) => s.date.slice(0, 7) === t0.slice(0, 7)).reduce((x, s) => x + s.amount, 0);
  const lastHair = [...hair].reverse()[0];

  return (
    <Page>
      <PageHeader eyebrow="Wellness" title="Beauty" accent="& Self-Care" subtitle="Haircare, skincare, bodycare, nails, lashes — routines, produits et rendez-vous." coverKey="beauty" variant={0} actions={<><Button icon={Plus} onClick={() => open({ resource: 'beautyProduct' })}>Produit</Button><Button variant="outline" icon={CalendarHeart} onClick={() => open({ resource: 'event', defaults: { category: 'beaute', start: `${t0}T10:00` }, title: 'Rendez-vous beauté' })}>Rendez-vous</Button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Produits en cours" value={products.filter((p) => p.status === 'in_use').length} icon={Sparkles} />
        <Stat label="À racheter" value={toRebuy.length} sub={toRebuy.slice(0, 2).map((p) => p.name).join(', ')} />
        <Stat label="Dépenses beauté (mois)" value={eur(monthSpend)} />
        <Stat label="Dernier soin cheveux" value={lastHair ? formatFr(lastHair.date) : '—'} icon={Scissors} sub={lastHair?.treatment} />
      </div>
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'routines', label: 'Routines' }, { value: 'products', label: 'Produits' }, { value: 'hair', label: 'Haircare Tracker' }, { value: 'appointments', label: 'Rendez-vous' }, { value: 'spending', label: 'Dépenses' }]} />
      {tab === 'routines' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {am.map((r) => <RoutineCard key={r.id} routine={r} icon={Sun} />)}
            {pm.map((r) => <RoutineCard key={r.id} routine={r} icon={Moon} />)}
            {other.map((r) => <RoutineCard key={r.id} routine={r} icon={Sparkles} />)}
          </div>
          <Button variant="soft" icon={Plus} onClick={() => open({ resource: 'routine', defaults: { type: 'beauty', steps: [] } })}>Nouvelle routine</Button>
          <p className="text-xs text-muted"><RotateCcw className="mr-1 inline h-3 w-3" />Les cases se réinitialisent chaque jour ; l’historique est conservé (et valide l’habitude « Self-care » quand une routine skincare est complète).</p>
        </div>
      )}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto">
            <button className={cn('chip', !cat && 'chip-active')} onClick={() => setCat(null)}>Tout</button>
            {PF.category.options.map((c) => <button key={c.value} className={cn('chip shrink-0', cat === c.value && 'chip-active')} onClick={() => setCat(c.value)}>{c.label}</button>)}
          </div>
          {products.filter((p) => !cat || p.category === cat).length === 0 ? <Card><Empty icon={Sparkles} title="Aucun produit" /></Card> : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {products.filter((p) => !cat || p.category === cat).map((p) => (
                <Card key={p.id} hover className="cursor-pointer overflow-hidden" onClick={() => open({ resource: 'beautyProduct', id: p.id })}>
                  {p.image ? <img src={p.image} alt="" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-gradient-to-br from-petal to-sand font-display text-4xl italic text-wine/30">{p.name.slice(0, 1)}</div>}
                  <div className="p-3">
                    {p.brand && <div className="eyebrow text-[10px]">{p.brand}</div>}
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="mt-1 flex items-center justify-between"><Badge color={optionColor(PF.status.options, p.status)}>{optionLabel(PF.status.options, p.status)}</Badge>{p.rating ? <Rating value={p.rating} size={11} /> : null}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'hair' && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader title="Longueur" eyebrow="Objectif : longueur, qualité, brillance, régularité" /><div className="p-5">{hair.filter((h) => h.lengthCm).length >= 2 ? <TrendChart type="line" data={hair.filter((h) => h.lengthCm)} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'lengthCm', name: 'Longueur (cm)' }]} fmt={(v) => `${v} cm`} /> : <Empty title="Mesure ta longueur à chaque soin" className="py-6" />}</div></Card>
            <Card><CardHeader title="Qualité & brillance" /><div className="p-5">{hair.filter((h) => h.quality || h.shine).length >= 2 ? <TrendChart type="line" data={hair} x="date" labelFmt={(d) => formatFr(d)} series={[{ key: 'quality', name: 'Qualité' }, { key: 'shine', name: 'Brillance' }]} fmt={(v) => `${v}/5`} /> : <Empty title="Note tes soins pour voir l’évolution" className="py-6" />}</div></Card>
          </div>
          {hair.some((h) => h.photo) && <Card><CardHeader title="Photos de progression" /><div className="grid grid-cols-3 gap-3 p-5 md:grid-cols-6">{hair.filter((h) => h.photo).map((h) => <div key={h.id}><img src={h.photo} alt="" className="aspect-[3/4] w-full rounded-2xl object-cover" /><div className="mt-1 text-center text-xs text-muted">{formatFr(h.date)}</div></div>)}</div></Card>}
          <ResourceTable resource="hairLog" title="Soins capillaires" defaults={{ date: t0 }} />
        </div>
      )}
      {tab === 'appointments' && <ResourceTable resource="event" title="Rendez-vous beauté (coiffeur, ongles, esthéticienne…)" params={{ where: { category: 'beaute' } }} defaults={{ category: 'beaute', start: `${t0}T10:00` }} columns={['title', 'start', 'location']} emptyText={appts.length ? undefined : 'Ils apparaissent aussi dans My Calendar.'} />}
      {tab === 'spending' && <ResourceTable resource="transaction" title="Dépenses beauté" params={{ where: { category: 'beaute' } }} defaults={{ category: 'beaute', type: 'expense', date: t0 }} />}
    </Page>
  );
}
