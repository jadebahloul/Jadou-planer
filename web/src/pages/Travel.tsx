import * as React from 'react';
import { Plus, Plane, ArrowLeft, Hotel, Ticket, FileText, MapPin, Wallet, Images, ListChecks } from 'lucide-react';
import { today, formatFr, diffDays } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel } from '@shared/registry';
import { useList, useInvalidate, type Row } from '@/lib/hooks';
import { api, uploadFiles } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Badge, Progress, Stat } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { ChecklistEditor } from '@/components/resource/fields';
import { DonutChart } from '@/components/charts';
import { pct } from '@/lib/utils';
import { toast } from 'sonner';

function TripDetail({ trip, onBack }: { trip: Row; onBack: () => void }) {
  const { data: expenses = [] } = useList('tripExpense', { where: { tripId: trip.id } });
  const { data: photos = [] } = useList('tripPhoto', { where: { tripId: trip.id } });
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const checklist = (trip.checklist ?? []) as any[];
  const saveChecklist = async (v: any[]) => {
    await api(`/r/trip/${trip.id}`, { method: 'PATCH', body: { checklist: v } });
    invalidate();
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const ups = await uploadFiles(files);
    for (const u of ups) await api('/r/tripPhoto', { body: { tripId: trip.id, image: u.url } });
    invalidate();
    toast.success(`${ups.length} photo(s) ajoutée(s) ♡`);
  };
  const days = trip.start ? diffDays(trip.start, today()) : null;
  const section = (icon: any, title: string, text?: string) => text ? <Card className="p-4"><div className="eyebrow mb-1 flex items-center gap-1.5">{React.createElement(icon, { className: 'h-3 w-3' })}{title}</div><p className="whitespace-pre-wrap text-sm">{text}</p></Card> : null;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="chip"><ArrowLeft className="h-3.5 w-3.5" />Tous les voyages</button>
      <div className="relative overflow-hidden rounded-3xl">
        {trip.cover ? <img src={trip.cover} alt="" className="h-64 w-full object-cover" /> : <div className="h-48 bg-gradient-to-br from-[#7FA7A0]/50 via-petal to-sand" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
        <div className="absolute bottom-0 p-6 text-white">
          <div className="eyebrow text-white/80">{trip.start ? `${formatFr(trip.start, { year: true })}${trip.end ? ` → ${formatFr(trip.end, { year: true })}` : ''}` : 'Dates à définir'}</div>
          <div className="font-display text-5xl">{trip.destination}</div>
          {days != null && days > 0 && <div className="mt-1 text-sm">Départ dans {days} jour{days > 1 ? 's' : ''} ✈︎</div>}
        </div>
        <Button size="sm" variant="soft" className="absolute right-4 top-4" onClick={() => open({ resource: 'trip', id: trip.id })}>Modifier</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Budget" value={eur(trip.budget)} icon={Wallet} />
        <Stat label="Dépensé" value={eur(spent)} sub={trip.budget ? <Progress value={pct(spent, trip.budget)} className="mt-2" color={spent > trip.budget ? 'rgb(var(--bad))' : undefined} /> : undefined} />
        <Stat label="Checklist" value={`${checklist.filter((c) => c.done).length}/${checklist.length}`} icon={ListChecks} />
        <Stat label="Photos" value={photos.length} icon={Images} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {section(Plane, 'Vols', trip.flights)}
            {section(Hotel, 'Hébergement', trip.accommodation)}
            {section(MapPin, 'Activités', trip.activities)}
            {section(Ticket, 'Réservations', trip.reservations)}
            {section(FileText, 'Documents', trip.documents)}
            {section(FileText, 'Notes', trip.notes)}
          </div>
          <Card>
            <CardHeader title="Dépenses du voyage" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'tripExpense', defaults: { tripId: trip.id, date: today() } })}>Dépense</Button>} />
            <div className="p-5">{expenses.length ? <DonutChart data={REGISTRY.tripExpense.fields.category.options.map((o) => ({ name: o.label, value: expenses.filter((e) => e.category === o.value).reduce((s, e) => s + e.amount, 0) }))} /> : <Empty title="Aucune dépense" className="py-4" />}</div>
          </Card>
          <Card>
            <CardHeader icon={Images} title="Galerie" action={<label className="chip cursor-pointer"><Plus className="h-3.5 w-3.5" />Photos<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} /></label>} />
            <div className="columns-2 gap-2 p-4 sm:columns-3 [&>*]:mb-2">
              {photos.length === 0 && <Empty title="Ajoute tes souvenirs" className="py-4" />}
              {photos.map((p) => <img key={p.id} src={p.image} alt={p.caption ?? ''} onClick={() => open({ resource: 'tripPhoto', id: p.id })} className="w-full cursor-pointer rounded-xl object-cover" />)}
            </div>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader icon={ListChecks} title="Checklist" />
          <div className="p-4"><ChecklistEditor value={checklist} onChange={saveChecklist} placeholder="Passeport, chargeur, SPF…" /></div>
          <p className="px-4 pb-4 text-[11px] text-muted">Astuce : demande à Jadou AI « Crée une checklist pour mon voyage ».</p>
        </Card>
      </div>
      <ResourceTable resource="tripExpense" title="Détail des dépenses" params={{ where: { tripId: trip.id } }} defaults={{ tripId: trip.id, date: today() }} />
    </div>
  );
}

export function TravelPage() {
  const { data: trips = [] } = useList('trip');
  const open = useRecordDialog();
  const [sel, setSel] = React.useState<number | null>(null);
  const trip = trips.find((t) => t.id === sel);
  const upcoming = trips.filter((t) => t.status !== 'done');
  const past = trips.filter((t) => t.status === 'done');
  return (
    <Page>
      <PageHeader eyebrow="Lifestyle" title="Travel" accent="Planner" subtitle="Destinations, vols, hébergements, budget, checklist et souvenirs." coverKey="travel" variant={1} actions={<Button icon={Plus} onClick={() => open({ resource: 'trip', defaults: { status: 'idea' }, onSaved: (r) => setSel(r.id) })}>Voyage</Button>} />
      {trip ? <TripDetail trip={trip} onBack={() => setSel(null)} /> : trips.length === 0 ? <Card><Empty icon={Plane} title="Où partons-nous ?" text="Crée ton premier voyage : il apparaîtra aussi dans My Calendar." /></Card> : (
        <div className="space-y-6">
          {[['À venir & envies', upcoming], ['Souvenirs', past]].map(([title, list]: any) => list.length > 0 && (
            <div key={title}>
              <h2 className="h-display mb-3 text-2xl">{title}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((t: Row) => (
                  <Card key={t.id} hover className="cursor-pointer overflow-hidden" onClick={() => setSel(t.id)}>
                    <div className="relative h-44">
                      {t.cover ? <img src={t.cover} alt="" className="h-full w-full object-cover" /> : <div className="h-full bg-gradient-to-br from-[#7FA7A0]/40 via-petal to-sand" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                      <div className="absolute bottom-3 left-4 text-white"><div className="font-display text-3xl">{t.destination}</div><div className="text-xs text-white/80">{t.start ? formatFr(t.start, { year: true }) : 'Dates à définir'}</div></div>
                      <Badge className="absolute right-3 top-3 bg-surface/90">{optionLabel(REGISTRY.trip.fields.status.options, t.status)}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 text-sm"><span className="text-muted">Budget {eur(t.budget)}</span><span className="text-muted">{(t.checklist ?? []).filter((c: any) => c.done).length}/{(t.checklist ?? []).length} checklist</span></div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
