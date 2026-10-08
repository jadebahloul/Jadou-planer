import * as React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import type { EventDropArg, DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search, AlertTriangle } from 'lucide-react';
import { CATEGORIES, categoryColor, type ResourceName } from '@shared/registry';
import { toISODate, toISODateTime, today, formatFr } from '@shared/dates';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Segmented, IconButton } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CalItem {
  id: string;
  source: string;
  sourceId: number;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  category: string;
  editable: boolean;
  status?: string | null;
  meta?: Record<string, any>;
}

type View = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth' | 'listMonth';

export function findConflicts(items: CalItem[]) {
  const timed = items.filter((i) => !i.allDay && i.start.length > 10 && i.status !== 'cancelled').map((i) => ({ i, s: i.start, e: i.end && i.end.length > 10 ? i.end : i.start.slice(0, 11) + String(Math.min(23, +i.start.slice(11, 13) + 1)).padStart(2, '0') + i.start.slice(13) }));
  const out: [CalItem, CalItem][] = [];
  for (let a = 0; a < timed.length; a++) for (let b = a + 1; b < timed.length; b++) if (timed[a].s < timed[b].e && timed[b].s < timed[a].e) out.push([timed[a].i, timed[b].i]);
  return out;
}

export function CalendarPage() {
  const [params] = useSearchParams();
  const ref = React.useRef<any>(null);
  const [view, setView] = React.useState<View>((params.get('view') as View) || (window.innerWidth < 768 ? 'listMonth' : 'timeGridWeek'));
  const [range, setRange] = React.useState<{ from: string; to: string; title: string } | null>(null);
  const [items, setItems] = React.useState<CalItem[]>([]);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [q, setQ] = React.useState('');
  const open = useRecordDialog();
  const invalidate = useInvalidate();

  const load = React.useCallback(async () => {
    if (!range) return;
    setItems(await api<CalItem[]>(`/calendar?from=${range.from}&to=${range.to}`));
  }, [range]);
  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const d = params.get('date');
    if (d) ref.current?.getApi().gotoDate(d);
  }, [params]);

  const visible = items.filter((i) => !hidden.includes(i.category) && (!q || i.title.toLowerCase().includes(q.toLowerCase())));
  const conflicts = findConflicts(visible);
  const conflictIds = new Set(conflicts.flat().map((c) => c.id));

  const events = visible.map((i) => ({
    id: i.id,
    title: i.title,
    start: i.start,
    end: i.end ?? undefined,
    allDay: i.allDay,
    editable: i.editable,
    durationEditable: i.editable && ['event', 'task'].includes(i.source),
    backgroundColor: `${categoryColor(i.category)}26`,
    textColor: 'rgb(var(--ink))',
    borderColor: categoryColor(i.category),
    classNames: [i.status === 'done' ? 'opacity-60' : '', conflictIds.has(i.id) ? 'ring-1 ring-bad/60' : ''],
    extendedProps: i,
  }));

  const onDates = (arg: DatesSetArg) => {
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    setRange({ from: toISODate(arg.start), to: toISODate(end), title: arg.view.title });
  };

  const move = async (arg: EventDropArg | EventResizeDoneArg) => {
    const i = arg.event.extendedProps as CalItem;
    const s = arg.event.start!;
    const e = arg.event.end;
    try {
      await api('/calendar/move', { body: { source: i.source, sourceId: i.sourceId, start: arg.event.allDay ? toISODate(s) : toISODateTime(s), end: e ? (arg.event.allDay ? toISODate(e) : toISODateTime(e)) : null, allDay: arg.event.allDay } });
      toast.success('Déplacé ♡');
      invalidate();
      load();
    } catch (err) {
      arg.revert();
      toast.error((err as Error).message);
    }
  };

  const click = (arg: EventClickArg) => {
    const i = arg.event.extendedProps as CalItem;
    if (i.source === 'workoutTemplate') {
      open({ resource: 'workoutSession', defaults: { name: i.title.replace(' (prévu)', ''), templateId: i.sourceId, date: i.meta?.date, status: 'planned' }, title: 'Planifier cette séance', onSaved: load });
      return;
    }
    open({ resource: i.source as ResourceName, id: i.sourceId, onSaved: load });
  };

  const select = (arg: DateSelectArg) => {
    open({ resource: 'event', defaults: arg.allDay ? { start: `${toISODate(arg.start)}T09:00`, allDay: true } : { start: toISODateTime(arg.start), end: toISODateTime(arg.end) }, onSaved: load });
    ref.current?.getApi().unselect();
  };

  const api_ = () => ref.current?.getApi();

  return (
    <Page>
      <PageHeader eyebrow="Home" title="My" accent="Calendar" subtitle="Cours, alternance, cils, sport, TOEIC, Airbnb, rendez-vous et échéances — tout au même endroit." coverKey="calendar" variant={1} compact actions={<Button icon={Plus} onClick={() => open({ resource: 'event', defaults: { start: `${today()}T10:00` }, onSaved: load })}>Événement</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
        <Card className="p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center">
              <IconButton icon={ChevronLeft} label="Précédent" onClick={() => api_()?.prev()} />
              <IconButton icon={ChevronRight} label="Suivant" onClick={() => api_()?.next()} />
            </div>
            <Button size="sm" variant="outline" onClick={() => api_()?.today()}>
              Aujourd’hui
            </Button>
            <h2 className="h-display ml-1 mr-auto text-xl capitalize sm:text-2xl">{range?.title}</h2>
            <Segmented
              size="sm"
              value={view}
              onChange={(v) => (setView(v), api_()?.changeView(v))}
              options={[
                { value: 'timeGridDay', label: 'Jour' },
                { value: 'timeGridWeek', label: 'Semaine' },
                { value: 'dayGridMonth', label: 'Mois' },
                { value: 'listMonth', label: 'Agenda' },
              ]}
            />
          </div>
          <FullCalendar
            ref={ref}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={view}
            locale={frLocale}
            firstDay={1}
            headerToolbar={false}
            height="auto"
            contentHeight={view.startsWith('timeGrid') ? 680 : 'auto'}
            slotMinTime="07:00:00"
            slotMaxTime="23:00:00"
            scrollTime="08:00:00"
            nowIndicator
            selectable
            selectMirror
            editable
            dayMaxEvents={3}
            events={events}
            datesSet={onDates}
            eventDrop={move}
            eventResize={move}
            eventClick={click}
            select={select}
            eventContent={(arg) => (
              <div className="overflow-hidden text-[11px] leading-tight">
                {!arg.event.allDay && arg.timeText && <span className="mr-1 font-semibold opacity-70">{arg.timeText}</span>}
                <span className="font-medium">{arg.event.title}</span>
              </div>
            )}
            noEventsContent="Rien de prévu sur cette période ♡"
          />
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="rounded-full pl-8 text-xs" />
            </div>
            <div className="eyebrow mb-2">Catégories</div>
            <div className="space-y-0.5">
              {CATEGORIES.map((c) => {
                const n = items.filter((i) => i.category === c.value).length;
                const off = hidden.includes(c.value);
                return (
                  <button key={c.value} onClick={() => setHidden(off ? hidden.filter((h) => h !== c.value) : [...hidden, c.value])} className={cn('flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition hover:bg-sunken', off && 'opacity-40')}>
                    <span className={cn('h-3 w-3 rounded-[4px] border-2')} style={{ borderColor: c.color, background: off ? 'transparent' : c.color }} />
                    {c.label}
                    <span className="num ml-auto text-xs text-muted">{n || ''}</span>
                  </button>
                );
              })}
            </div>
          </Card>
          {conflicts.length > 0 && (
            <Card className="border-bad/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-bad">
                <AlertTriangle className="h-4 w-4" /> {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} détecté{conflicts.length > 1 ? 's' : ''}
              </div>
              <div className="space-y-2 text-xs text-muted">
                {conflicts.slice(0, 6).map(([a, b], k) => (
                  <div key={k} className="rounded-xl bg-bad/5 p-2">
                    <div className="font-medium text-ink">{formatFr(a.start, { weekday: true })}</div>
                    {a.start.slice(11, 16)} {a.title}
                    <br />↔ {b.start.slice(11, 16)} {b.title}
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-4 text-xs text-muted">
            <div className="eyebrow mb-2">Astuces</div>
            Sélectionne un créneau pour créer un événement. Glisse-dépose pour déplacer : le changement est appliqué dans le module d’origine (devoir, RDV cils, séance, réservation…).
          </Card>
        </div>
      </div>
    </Page>
  );
}
