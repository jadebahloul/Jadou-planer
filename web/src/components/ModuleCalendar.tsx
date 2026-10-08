import * as React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { categoryColor, type ResourceName } from '@shared/registry';
import { toISODate, toISODateTime } from '@shared/dates';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/hooks';
import { Button, Card, IconButton, Segmented } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { toast } from 'sonner';

/** A calendar restricted to some sources of the unified feed (e.g. lash appointments, Airbnb bookings). */
export function ModuleCalendar({ sources, onCreate, defaultView = 'timeGridWeek', views = ['timeGridDay', 'timeGridWeek', 'dayGridMonth'] }: { sources: string[]; onCreate?: (start: string, allDay: boolean) => void; defaultView?: string; views?: string[] }) {
  const ref = React.useRef<any>(null);
  const [view, setView] = React.useState(defaultView);
  const [title, setTitle] = React.useState('');
  const [range, setRange] = React.useState<{ from: string; to: string } | null>(null);
  const [items, setItems] = React.useState<any[]>([]);
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const load = React.useCallback(async () => {
    if (range) setItems((await api<any[]>(`/calendar?from=${range.from}&to=${range.to}`)).filter((i) => sources.includes(i.source)));
  }, [range, sources.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    load();
  }, [load]);
  const labels: Record<string, string> = { timeGridDay: 'Jour', timeGridWeek: 'Semaine', dayGridMonth: 'Mois' };
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <IconButton icon={ChevronLeft} label="Précédent" onClick={() => ref.current?.getApi().prev()} />
        <IconButton icon={ChevronRight} label="Suivant" onClick={() => ref.current?.getApi().next()} />
        <Button size="sm" variant="outline" onClick={() => ref.current?.getApi().today()}>Aujourd’hui</Button>
        <h3 className="h-display mr-auto text-xl capitalize">{title}</h3>
        <Segmented size="sm" value={view} onChange={(v) => (setView(v), ref.current?.getApi().changeView(v))} options={views.map((v) => ({ value: v, label: labels[v] }))} />
      </div>
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={defaultView}
        locale={frLocale}
        firstDay={1}
        headerToolbar={false}
        height="auto"
        contentHeight={view.startsWith('timeGrid') ? 600 : 'auto'}
        slotMinTime="08:00:00"
        slotMaxTime="22:00:00"
        nowIndicator
        selectable={!!onCreate}
        editable
        events={items.map((i) => ({ id: i.id, title: i.title, start: i.start, end: i.end ?? undefined, allDay: i.allDay, editable: i.editable, backgroundColor: `${categoryColor(i.category)}30`, borderColor: categoryColor(i.category), textColor: 'rgb(var(--ink))', extendedProps: i }))}
        datesSet={(arg) => {
          const end = new Date(arg.end);
          end.setDate(end.getDate() - 1);
          setTitle(arg.view.title);
          setRange({ from: toISODate(arg.start), to: toISODate(end) });
        }}
        select={(arg) => {
          onCreate?.(arg.allDay ? toISODate(arg.start) : toISODateTime(arg.start), arg.allDay);
          ref.current?.getApi().unselect();
        }}
        eventClick={(arg) => {
          const i = arg.event.extendedProps;
          open({ resource: i.source as ResourceName, id: i.sourceId, onSaved: load });
        }}
        eventDrop={async (arg) => {
          const i = arg.event.extendedProps;
          try {
            await api('/calendar/move', { body: { source: i.source, sourceId: i.sourceId, start: arg.event.allDay ? toISODate(arg.event.start!) : toISODateTime(arg.event.start!), end: null, allDay: arg.event.allDay } });
            invalidate();
            load();
            toast.success('Déplacé ♡');
          } catch (e) {
            arg.revert();
            toast.error((e as Error).message);
          }
        }}
      />
    </Card>
  );
}
