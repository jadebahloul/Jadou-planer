import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Gem, Users, Wallet, Package, Target, MessageSquare, Phone, Minus, AlertTriangle, Copy, CalendarDays, TrendingUp } from 'lucide-react';
import { today, addDays, formatFr, relativeDay, addMonths, startOfMonth, endOfMonth, monthKey } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel, optionColor } from '@shared/registry';
import { useApi, useList, useInvalidate, type Row } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge, Modal, Input } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { ModuleCalendar } from '@/components/ModuleCalendar';
import { BarsChart, DonutChart } from '@/components/charts';
import { GoalCard } from './Goals';
import { cn, nf } from '@/lib/utils';
import { toast } from 'sonner';

const AF = REGISTRY.lashAppointment.fields;

export function fillTemplate(body: string, vars: Record<string, string | undefined>) {
  return body.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function ClientModal({ client, onClose }: { client: Row | null; onClose: () => void }) {
  const { data: appts = [] } = useList('lashAppointment', { where: { clientId: client?.id ?? -1 }, orderBy: 'start', dir: 'desc' }, { enabled: !!client });
  const { data: services = [] } = useList('lashService');
  const open = useRecordDialog();
  if (!client) return null;
  const done = appts.filter((a) => a.status === 'done');
  const spent = done.reduce((s, a) => s + (a.price ?? 0), 0);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={client.name} description={[client.phone, client.instagram && `@${client.instagram.replace('@', '')}`].filter(Boolean).join(' · ')} size="lg" footer={<><Button variant="ghost" onClick={() => open({ resource: 'client', id: client.id })}>Modifier la fiche</Button><Button icon={Plus} onClick={() => open({ resource: 'lashAppointment', defaults: { clientId: client.id, start: `${today()}T10:00` } })}>Rendez-vous</Button></>}>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Dépenses cumulées" value={eur(spent)} />
        <Stat label="Prestations" value={done.length} />
        <Stat label="Dernier RDV" value={done[0] ? formatFr(done[0].start.slice(0, 10)) : '—'} />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm"><div className="eyebrow mb-1">Préférences</div>{client.preferences || <span className="text-muted">—</span>}</Card>
        <Card className="p-4 text-sm"><div className="eyebrow mb-1">Comment m’avez-vous connue ?</div>{optionLabel(REGISTRY.client.fields.source.options, client.source) || <span className="text-muted">—</span>}{client.allergies && <div className="mt-2 text-bad">⚠ {client.allergies}</div>}</Card>
        {client.notes && <Card className="p-4 text-sm sm:col-span-2"><div className="eyebrow mb-1">Notes</div><p className="whitespace-pre-wrap">{client.notes}</p></Card>}
      </div>
      <div className="eyebrow mb-2">Historique</div>
      {appts.length === 0 ? <Empty title="Aucun rendez-vous" className="py-4" /> : appts.map((a) => (
        <button key={a.id} onClick={() => open({ resource: 'lashAppointment', id: a.id })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-sunken">
          <span className="w-36 text-muted">{formatFr(a.start, { time: true, year: true })}</span>
          <span className="flex-1">{services.find((s) => s.id === a.serviceId)?.name ?? '—'}</span>
          <Badge color={optionColor(AF.status.options, a.status)}>{optionLabel(AF.status.options, a.status)}</Badge>
          <span className="num w-16 text-right font-medium">{eur(a.price)}</span>
        </button>
      ))}
    </Modal>
  );
}

export function LashPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = React.useState<string>(params.get('tab') ?? 'dashboard');
  const t0 = today();
  const { data: s } = useApi<any>('/stats/lash');
  const { data: appts = [] } = useList('lashAppointment');
  const { data: clients = [] } = useList('client');
  const { data: services = [] } = useList('lashService');
  const { data: stock = [] } = useList('stockItem');
  const { data: goals = [] } = useList('goal', { where: { category: 'lash' } });
  const { data: templates = [] } = useList('messageTemplate', { where: { context: 'lash' } });
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const [client, setClient] = React.useState<Row | null>(null);
  const [q, setQ] = React.useState('');
  const clientName = (id: number) => clients.find((c) => c.id === id)?.name ?? 'Cliente';
  const svcName = (id: number) => services.find((x) => x.id === id)?.name;
  const upcoming = appts.filter((a) => a.start >= `${t0}T00:00` && !['cancelled', 'done', 'no_show'].includes(a.status)).sort((a, b) => a.start.localeCompare(b.start));
  const toBill = appts.filter((a) => a.start < `${t0}T23:59` && (a.status === 'booked' || a.status === 'confirmed'));
  const months = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(t0), i - 5));
  const revenueSeries = months.map((m) => ({ month: monthKey(m), CA: appts.filter((a) => a.status === 'done' && a.start.slice(0, 7) === monthKey(m)).reduce((x, a) => x + (a.price ?? 0), 0) }));
  const sources = REGISTRY.client.fields.source.options.map((o) => ({ name: o.label, value: clients.filter((c) => c.source === o.value).length }));
  const missingPrices = services.filter((x) => x.active && x.price == null).length;

  const markDone = async (a: Row, paid: boolean) => {
    await api(`/r/lashAppointment/${a.id}`, { method: 'PATCH', body: { status: 'done', ...(paid ? { paymentStatus: 'paid' } : {}) } });
    invalidate();
    toast.success(paid && !a.accountId ? 'Réalisé & encaissé — choisis un compte d’encaissement pour l’ajouter à tes revenus.' : 'Rendez-vous mis à jour ♡');
  };

  const clientStats = (c: Row) => {
    const done = appts.filter((a) => a.clientId === c.id && a.status === 'done');
    return { count: done.length, spent: done.reduce((x, a) => x + (a.price ?? 0), 0), last: done.map((a) => a.start).sort().pop() };
  };

  return (
    <Page>
      <PageHeader eyebrow="Business" title="Lash" accent="Studio" subtitle="Rendez-vous, clientes, prestations, chiffre d’affaires et stock." coverKey="lash" variant={0} actions={<><Button icon={Plus} onClick={() => open({ resource: 'lashAppointment', defaults: { start: `${t0}T10:00` } })}>Rendez-vous</Button><Button variant="outline" icon={Users} onClick={() => open({ resource: 'client' })}>Cliente</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'dashboard', label: 'Revenue Dashboard' }, { value: 'agenda', label: 'Agenda' }, { value: 'appointments', label: 'Rendez-vous' }, { value: 'clients', label: 'Clientes' }, { value: 'services', label: 'Prestations' }, { value: 'stock', label: 'Stock' }, { value: 'goals', label: 'Objectifs' }, { value: 'messages', label: 'Messages' }]} />

      {tab === 'dashboard' && s && (
        <div className="space-y-5">
          {missingPrices > 0 && <Card className="flex items-center gap-3 border-warn/30 bg-warn/5 p-4 text-sm"><AlertTriangle className="h-4 w-4 text-warn" />{missingPrices} prestation(s) sans prix : renseigne tes tarifs pour que les rendez-vous soient pré-remplis.<Button size="sm" variant="outline" className="ml-auto" onClick={() => setTab('services')}>Prestations</Button></Card>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="CA aujourd’hui" value={eur(s.today)} icon={Gem} accent />
            <Stat label="CA semaine" value={eur(s.week)} />
            <Stat label="CA du mois" value={eur(s.month)} sub={`${s.monthCount} prestation${s.monthCount > 1 ? 's' : ''}`} />
            <Stat label="Panier moyen" value={eur(s.avgBasket)} />
            <Stat label="Clientes" value={s.clientsCount} sub={`${s.clientsThisMonth} ce mois`} icon={Users} />
            <Stat label="Dépenses du mois" value={eur(s.consumables + s.expenses)} sub={`consommables ${eur(s.consumables)} · matériel ${eur(s.expenses)}`} icon={Wallet} />
            <Stat label="Résultat estimé" value={eur(s.estimatedResult)} icon={TrendingUp} />
            <Stat label="Encaissé ce mois" value={eur(s.cashedThisMonth)} sub={s.unpaid ? `${s.unpaid} réalisé(s) non encaissé(s)` : 'tout est encaissé'} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card><CardHeader title="Chiffre d’affaires" eyebrow="6 derniers mois · prestations réalisées" /><div className="p-5"><BarsChart data={revenueSeries} x="month" labelFmt={(m) => new Date(+m.slice(0, 4), +m.slice(5) - 1).toLocaleDateString('fr-FR', { month: 'short' })} series={[{ key: 'CA', name: 'CA', color: '#E07A9A' }]} fmt="eur" /></div></Card>
            <Card><CardHeader title="Comment m’ont-elles connue ?" /><div className="p-5">{clients.length ? <DonutChart data={sources} fmt="num" height={160} /> : <Empty title="Aucune cliente" className="py-6" />}</div></Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader icon={CalendarDays} title="Prochains rendez-vous" />
              <div className="p-3">
                {upcoming.length === 0 && <Empty title="Aucun rendez-vous à venir" className="py-4" />}
                {upcoming.slice(0, 8).map((a) => (
                  <button key={a.id} onClick={() => open({ resource: 'lashAppointment', id: a.id })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sunken">
                    <div className="w-24 text-xs"><div className="capitalize text-muted">{relativeDay(a.start.slice(0, 10))}</div><div className="num font-semibold">{a.start.slice(11)}</div></div>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{clientName(a.clientId)}</div><div className="text-xs text-muted">{svcName(a.serviceId) ?? '—'}</div></div>
                    <Badge color={optionColor(AF.status.options, a.status)}>{optionLabel(AF.status.options, a.status)}</Badge>
                    <span className="num w-14 text-right text-sm">{eur(a.price)}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="À facturer / encaisser" eyebrow="RDV passés non clôturés" />
              <div className="p-3">
                {toBill.length === 0 && <Empty title="Tout est à jour ✨" className="py-4" />}
                {toBill.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2">
                    <span className="flex-1 text-sm"><b>{clientName(a.clientId)}</b> · {formatFr(a.start, { time: true })}</span>
                    <Button size="sm" variant="ghost" onClick={() => markDone(a, false)}>Réalisé</Button>
                    <Button size="sm" onClick={() => markDone(a, true)}>Réalisé & encaissé</Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {s.lowStock.length > 0 && <Card className="flex items-center gap-3 border-bad/20 p-4 text-sm"><Package className="h-4 w-4 text-bad" />Stock bas : {s.lowStock.join(', ')}<Button size="sm" variant="outline" className="ml-auto" onClick={() => setTab('stock')}>Voir le stock</Button></Card>}
        </div>
      )}

      {tab === 'agenda' && <ModuleCalendar sources={['lashAppointment']} onCreate={(start, allDay) => open({ resource: 'lashAppointment', defaults: { start: allDay ? `${start}T10:00` : start } })} />}
      {tab === 'appointments' && <ResourceTable resource="lashAppointment" title="Tous les rendez-vous" defaults={{ start: `${t0}T10:00` }} filterField="status" exportable />}

      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une cliente…" className="max-w-xs rounded-full" /><Button icon={Plus} onClick={() => open({ resource: 'client' })}>Cliente</Button></div>
          {clients.length === 0 ? <Card><Empty icon={Users} title="Client Database vide" text="Ajoute tes clientes : historique, préférences, dépenses cumulées et dernier rendez-vous seront calculés automatiquement." /></Card> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {clients.filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase())).map((c) => {
                const st = clientStats(c);
                return (
                  <Card key={c.id} hover className="cursor-pointer p-4" onClick={() => setClient(c)}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-petal font-display text-lg text-wine">{c.name.slice(0, 1)}</div>
                      <div className="min-w-0 flex-1"><div className="truncate font-semibold">{c.name}</div><div className="flex items-center gap-1 text-xs text-muted">{c.phone && <><Phone className="h-3 w-3" />{c.phone}</>}</div></div>
                      {c.source && <Badge>{optionLabel(REGISTRY.client.fields.source.options, c.source)}</Badge>}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{st.count}</div><div className="text-muted">RDV</div></div>
                      <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{eur(st.spent)}</div><div className="text-muted">cumulé</div></div>
                      <div className="rounded-xl bg-sunken/70 py-2"><div className="font-semibold">{st.last ? formatFr(st.last.slice(0, 10)) : '—'}</div><div className="text-muted">dernier</div></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <ClientModal client={client} onClose={() => setClient(null)} />
        </div>
      )}

      {tab === 'services' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {services.map((x) => (
              <Card key={x.id} hover className="cursor-pointer p-4" onClick={() => open({ resource: 'lashService', id: x.id })}>
                <div className="font-display text-xl">{x.name}</div>
                <div className="num mt-2 font-display text-3xl text-wine">{x.price != null ? eur(x.price) : '—'}</div>
                <div className="mt-1 text-xs text-muted">{x.durationMin ? `${x.durationMin} min` : 'Durée à définir'} · consommables {x.consumableCost != null ? eur(x.consumableCost, 2) : '—'}</div>
                {x.price != null && x.consumableCost != null && <div className="mt-1 text-xs text-good">Marge {eur(x.price - x.consumableCost)}{x.durationMin ? ` · ${eur(((x.price - x.consumableCost) / x.durationMin) * 60)}/h` : ''}</div>}
              </Card>
            ))}
            <button onClick={() => open({ resource: 'lashService' })} className="grid min-h-[120px] place-items-center rounded-2xl border border-dashed border-line text-sm text-muted hover:border-wine/40 hover:text-wine"><span className="flex items-center gap-1"><Plus className="h-4 w-4" />Prestation</span></button>
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div className="space-y-4">
          <Button icon={Plus} onClick={() => open({ resource: 'stockItem' })}>Produit</Button>
          {stock.length === 0 ? <Card><Empty icon={Package} title="Stock vide" text="Colle, cils, patchs, pinces, primer… avec seuils d’alerte." /></Card> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stock.map((x) => {
                const low = (x.quantity ?? 0) <= (x.alertThreshold ?? 0);
                return (
                  <Card key={x.id} className={cn('p-4', low && 'border-bad/30')}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => open({ resource: 'stockItem', id: x.id })}><div className="font-semibold">{x.name}</div><div className="text-xs text-muted">{x.category ?? '—'} · {x.supplier ?? 'fournisseur ?'}{x.unitPrice ? ` · ${eur(x.unitPrice, 2)}/u` : ''}</div></div>
                      {low && <Badge color="#B4413C">Alerte</Badge>}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button onClick={async () => { await api(`/r/stockItem/${x.id}`, { method: 'PATCH', body: { quantity: Math.max(0, (x.quantity ?? 0) - 1) } }); invalidate(); }} className="grid h-9 w-9 place-items-center rounded-full bg-sunken" aria-label="Retirer"><Minus className="h-4 w-4" /></button>
                      <div className="num flex-1 text-center font-display text-3xl">{nf(x.quantity, 1)} <span className="text-sm text-muted">{x.unit}</span></div>
                      <button onClick={async () => { await api(`/r/stockItem/${x.id}`, { method: 'PATCH', body: { quantity: (x.quantity ?? 0) + 1 } }); invalidate(); }} className="grid h-9 w-9 place-items-center rounded-full bg-petal text-wine" aria-label="Ajouter"><Plus className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-2 text-center text-[11px] text-muted">Seuil d’alerte : {x.alertThreshold ?? 0}</div>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted">Astuce : enregistre tes achats de matériel en dépense (catégorie « Matériel cils ») dans My Banks pour qu’ils comptent dans le résultat du studio.</p>
        </div>
      )}

      {tab === 'goals' && (
        <div className="space-y-4">
          <Button icon={Plus} onClick={() => open({ resource: 'goal', defaults: { category: 'lash', horizon: 'monthly' } })}>Objectif business</Button>
          {goals.length === 0 ? <Card><Empty icon={Target} title="Aucun objectif" text="Revenus, nombre de clientes, fidélisation, communication, développement…" /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{goals.map((g) => <GoalCard key={g.id} g={g} />)}</div>}
        </div>
      )}

      {tab === 'messages' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((m) => (
            <Card key={m.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-wine" /><span className="font-semibold">{m.name}</span><button onClick={() => open({ resource: 'messageTemplate', id: m.id })} className="ml-auto text-xs text-muted hover:text-wine">Modifier</button></div>
              <p className="flex-1 whitespace-pre-wrap text-sm text-ink/80">{m.body}</p>
              <Button size="sm" variant="soft" icon={Copy} className="mt-3 self-start" onClick={() => { navigator.clipboard?.writeText(m.body); toast('Copié — remplace les {champs} ♡'); }}>Copier</Button>
            </Card>
          ))}
          <button onClick={() => open({ resource: 'messageTemplate', defaults: { context: 'lash' } })} className="grid min-h-[140px] place-items-center rounded-2xl border border-dashed border-line text-sm text-muted hover:text-wine"><span className="flex items-center gap-1"><Plus className="h-4 w-4" />Modèle</span></button>
        </div>
      )}
    </Page>
  );
}

export { endOfMonth, addDays };
