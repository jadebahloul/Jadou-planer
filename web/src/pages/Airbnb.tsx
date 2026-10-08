import * as React from 'react';
import { Plus, BedDouble, Copy, MessageSquare, Sparkles, FolderOpen } from 'lucide-react';
import { today, formatFr, diffDays } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel, optionColor } from '@shared/registry';
import { useApi, useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge, Select, Label } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { ModuleCalendar } from '@/components/ModuleCalendar';
import { TaskCheck } from '@/components/widgets';
import { fillTemplate } from './Lash';
import { toast } from 'sonner';

export function AirbnbPage() {
  const [tab, setTab] = React.useState<'reservations' | 'finance' | 'cleaning' | 'messages' | 'documents'>('reservations');
  const { data: s } = useApi<any>('/stats/airbnb');
  const { data: listings = [] } = useList('airbnbListing');
  const { data: bookings = [] } = useList('airbnbBooking');
  const { data: cleaning = [] } = useList('task', { where: { category: 'airbnb' } });
  const { data: templates = [] } = useList('messageTemplate', { where: { context: 'airbnb' } });
  const open = useRecordDialog();
  const [bk, setBk] = React.useState<string>('');
  const t0 = today();
  const booking = bookings.find((b) => String(b.id) === bk);
  const listingName = (id: number) => listings.find((l) => l.id === id)?.name ?? '';
  const vars = booking ? { voyageur: booking.guest, logement: listingName(booking.listingId), arrivee: formatFr(booking.checkIn, { weekday: true }), depart: formatFr(booking.checkOut, { weekday: true }) } : {};

  return (
    <Page>
      <PageHeader eyebrow="Money" title="Airbnb" accent="Management" subtitle="Réservations, finances, ménage, messages voyageurs et documents." coverKey="airbnb" variant={1} actions={<><Button icon={Plus} onClick={() => open({ resource: 'airbnbBooking', defaults: { checkIn: t0, checkOut: t0, listingId: listings[0]?.id } })} disabled={!listings.length}>Réservation</Button><Button variant="outline" icon={BedDouble} onClick={() => open({ resource: 'airbnbListing' })}>Logement</Button></>} />
      {listings.length === 0 && <Card className="mb-5"><Empty icon={BedDouble} title="Ajoute ton premier logement" text="Puis tes réservations : elles alimentent le calendrier global, créent la tâche de ménage au départ, et une fois payées, tes revenus (compte de versement)." action={<Button variant="soft" onClick={() => open({ resource: 'airbnbListing' })}>Ajouter un logement</Button>} /></Card>}
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'reservations', label: 'Reservations' }, { value: 'finance', label: 'Financial Dashboard' }, { value: 'cleaning', label: 'Cleaning Planner' }, { value: 'messages', label: 'Guest Messages' }, { value: 'documents', label: 'Documents' }]} />
      {tab === 'reservations' && (
        <div className="space-y-5">
          <ModuleCalendar sources={['airbnbBooking']} defaultView="dayGridMonth" views={['dayGridMonth']} onCreate={(d) => listings.length && open({ resource: 'airbnbBooking', defaults: { checkIn: d.slice(0, 10), checkOut: d.slice(0, 10), listingId: listings[0].id } })} />
          <ResourceTable resource="airbnbBooking" title="Séjours" defaults={{ checkIn: t0, checkOut: t0, listingId: listings[0]?.id }} filterField="status" columns={['guest', 'listingId', 'checkIn', 'checkOut', 'amount', 'status']} exportable />
        </div>
      )}
      {tab === 'finance' && s && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Revenus du mois" value={eur(s.revenue)} accent />
            <Stat label="Frais" value={eur(s.fees)} />
            <Stat label="Charges" value={eur(s.costs)} />
            <Stat label="Résultat estimé" value={eur(s.result)} />
            <Stat label="Taux d’occupation" value={`${s.occupancy} %`} sub={`${s.nights} nuits`} />
            <Stat label="Prix moyen / nuit" value={eur(s.avgNight)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((l) => (
              <Card key={l.id} hover className="cursor-pointer overflow-hidden" onClick={() => open({ resource: 'airbnbListing', id: l.id })}>
                {l.photo ? <img src={l.photo} alt="" className="h-40 w-full object-cover" /> : <div className="grid h-24 place-items-center bg-gradient-to-br from-sand to-petal"><BedDouble className="h-8 w-8 text-wine/40" strokeWidth={1.3} /></div>}
                <div className="p-4"><div className="font-display text-xl">{l.name}</div><div className="text-xs text-muted">{l.address}{l.nightlyPrice ? ` · ${eur(l.nightlyPrice)}/nuit` : ''}</div><div className="mt-2 text-xs">{bookings.filter((b) => b.listingId === l.id && b.checkIn >= t0 && b.status !== 'cancelled').length} réservation(s) à venir</div></div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted">Revenus répartis au prorata des nuits du mois. Les réservations « Payées » avec un compte de versement créent automatiquement le revenu net (montant − frais) dans My Banks.</p>
        </div>
      )}
      {tab === 'cleaning' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader icon={Sparkles} title="Ménage & préparation" eyebrow="Créés automatiquement au départ de chaque voyageur" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'task', defaults: { category: 'airbnb', date: t0 } })}>Tâche</Button>} />
            <div className="p-2">
              {cleaning.filter((c) => c.status !== 'done').length === 0 ? <Empty title="Rien à préparer" className="py-4" /> : cleaning.filter((c) => c.status !== 'done').sort((a, b) => String(a.date).localeCompare(String(b.date))).map((t) => <TaskCheck key={t.id} task={t} showDate />)}
            </div>
          </Card>
          <Card>
            <CardHeader title="Checklist type" eyebrow="Ménage · linge · préparation · maintenance · vérifications" />
            <ul className="space-y-1.5 p-5 text-sm">
              {['Aérer, dépoussiérer, aspirateur & sols', 'Salle de bain & WC désinfectés', 'Cuisine : vaisselle, frigo vidé, plans de travail', 'Changer draps & serviettes, lancer le linge', 'Réassort : café, thé, savon, papier toilette', 'Vérifier ampoules, télécommandes, Wi-Fi', 'Photos de l’état du logement', 'Signaler toute réparation (maintenance)'].map((x) => <li key={x} className="flex gap-2"><span className="text-wine">•</span>{x}</li>)}
            </ul>
          </Card>
        </div>
      )}
      {tab === 'messages' && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[240px] flex-1"><Label>Remplir avec la réservation</Label><Select value={bk} onChange={(e) => setBk(e.target.value)}><option value="">— garder les {'{champs}'} —</option>{bookings.map((b) => <option key={b.id} value={b.id}>{b.guest} · {formatFr(b.checkIn)} ({listingName(b.listingId)})</option>)}</Select></div>
            <Button variant="soft" icon={Plus} onClick={() => open({ resource: 'messageTemplate', defaults: { context: 'airbnb' } })}>Modèle</Button>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((m) => {
              const text = fillTemplate(m.body, vars);
              return (
                <Card key={m.id} className="flex flex-col p-4">
                  <div className="mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-wine" /><span className="font-semibold">{m.name}</span><button onClick={() => open({ resource: 'messageTemplate', id: m.id })} className="ml-auto text-xs text-muted hover:text-wine">Modifier</button></div>
                  <p className="flex-1 whitespace-pre-wrap text-sm text-ink/80">{text}</p>
                  <Button size="sm" variant="soft" icon={Copy} className="mt-3 self-start" onClick={() => { navigator.clipboard?.writeText(text); toast('Message copié ♡'); }}>Copier</Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'documents' && (
        <div className="space-y-3">
          <Card className="flex items-center gap-2 p-4 text-sm text-muted"><FolderOpen className="h-4 w-4 text-wine" />Guides, photos, factures, informations pratiques. Pour des codes d’accès ou documents sensibles, utilise le Document Vault chiffré (Settings › Data & Privacy).</Card>
          <ResourceTable resource="resource" title="Documents Airbnb" params={{ where: { folder: 'airbnb' } }} defaults={{ folder: 'airbnb', type: 'document' }} />
        </div>
      )}
    </Page>
  );
}
