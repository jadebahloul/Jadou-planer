/**
 * Unified calendar: every dated item of every module, aggregated at read time,
 * so "un événement créé dans une catégorie apparaît automatiquement dans le calendrier global".
 */
import { Router } from 'express';
import { prisma } from './db';
import { addDays, addMinutes, expandRecurrence, eachDay, weekdayOf } from '../../shared/dates';
import { updateRecord } from './records';

export interface CalItem {
  id: string; // "<source>:<id>[:<date>]"
  source: string;
  sourceId: number;
  title: string;
  start: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  end?: string | null;
  allDay: boolean;
  category: string;
  editable: boolean;
  status?: string | null;
  meta?: Record<string, unknown>;
}

export async function calendarFeed(from: string, to: string): Promise<CalItem[]> {
  const items: CalItem[] = [];
  const toEnd = to + 'T23:59';

  // Events (with recurrence expansion)
  const events = await prisma.event.findMany({ where: { OR: [{ start: { gte: from, lte: toEnd } }, { recurrence: { not: 'none' }, start: { lte: toEnd } }] } });
  for (const e of events) {
    const startDate = e.start!.slice(0, 10);
    const days = expandRecurrence(startDate, e.recurrence, from, to, e.recurrenceUntil);
    for (const d of days) {
      const delta = Math.round((new Date(d).getTime() - new Date(startDate).getTime()) / 86400000);
      const s = e.allDay ? d : `${d}${e.start!.slice(10)}`;
      const end = e.end ? (e.allDay ? addDays(e.end.slice(0, 10), delta) : addMinutes(e.end, delta * 1440)) : null;
      items.push({ id: `event:${e.id}:${d}`, source: 'event', sourceId: e.id, title: e.title!, start: s, end, allDay: !!e.allDay, category: e.category ?? 'perso', editable: e.recurrence === 'none' || !e.recurrence, meta: { location: e.location, recurrence: e.recurrence, notes: e.notes } });
    }
  }

  // Tasks with dates (homework/airbnb tasks are tagged with their own category)
  const tasks = await prisma.task.findMany({ where: { date: { gte: from, lte: to } } });
  for (const t of tasks) {
    if (t.sourceType === 'homework') continue; // homework shown below as deadline
    const start = t.time ? `${t.date}T${t.time}` : t.date!;
    items.push({ id: `task:${t.id}`, source: 'task', sourceId: t.id, title: t.title!, start, end: t.time && t.durationMin ? addMinutes(start, t.durationMin) : null, allDay: !t.time, category: t.category ?? 'perso', editable: true, status: t.status, meta: { priority: t.priority } });
  }

  const courses = new Map((await prisma.course.findMany()).map((c) => [c.id, c.name]));
  for (const h of await prisma.homework.findMany({ where: { dueDate: { gte: from, lte: to } } })) {
    items.push({ id: `homework:${h.id}`, source: 'homework', sourceId: h.id, title: `À rendre · ${h.title}${h.courseId && courses.get(h.courseId) ? ` (${courses.get(h.courseId)})` : ''}`, start: h.dueTime ? `${h.dueDate}T${h.dueTime}` : h.dueDate!, allDay: !h.dueTime, category: 'devoirs', editable: true, status: h.status });
  }
  for (const x of await prisma.exam.findMany({ where: { date: { gte: from, lte: to } } })) {
    items.push({ id: `exam:${x.id}`, source: 'exam', sourceId: x.id, title: `Examen · ${x.title}`, start: x.time ? `${x.date}T${x.time}` : x.date!, end: x.time ? addMinutes(`${x.date}T${x.time}`, 120) : null, allDay: !x.time, category: 'cours', editable: true, meta: { location: x.location } });
  }

  // Lash appointments
  const clients = new Map((await prisma.client.findMany()).map((c) => [c.id, c.name]));
  const services = new Map((await prisma.lashService.findMany()).map((s) => [s.id, s.name]));
  for (const a of await prisma.lashAppointment.findMany({ where: { start: { gte: from, lte: toEnd } } })) {
    if (a.status === 'cancelled') continue;
    items.push({ id: `lashAppointment:${a.id}`, source: 'lashAppointment', sourceId: a.id, title: `Cils · ${clients.get(a.clientId!) ?? 'Cliente'}${a.serviceId ? ` · ${services.get(a.serviceId) ?? ''}` : ''}`, start: a.start!, end: addMinutes(a.start!, a.durationMin || 120), allDay: false, category: 'cils', editable: true, status: a.status, meta: { price: a.price, paymentStatus: a.paymentStatus } });
  }

  // Workouts: logged sessions + planned program days not yet logged
  const sessions = await prisma.workoutSession.findMany({ where: { date: { gte: from, lte: to } } });
  for (const s of sessions) {
    const start = s.time ? `${s.date}T${s.time}` : s.date!;
    items.push({ id: `workoutSession:${s.id}`, source: 'workoutSession', sourceId: s.id, title: `${s.status === 'done' ? '✓ ' : ''}${s.name}`, start, end: s.time ? addMinutes(start, s.durationMin || 60) : null, allDay: !s.time, category: 'sport', editable: true, status: s.status });
  }
  const templates = await prisma.workoutTemplate.findMany({ where: { active: true } });
  const sessionDays = new Set(sessions.map((s) => s.date));
  for (const d of eachDay(from, to)) {
    for (const t of templates) {
      if (t.weekday === String(weekdayOf(d)) && !sessionDays.has(d)) {
        const start = t.time ? `${d}T${t.time}` : d;
        items.push({ id: `workoutTemplate:${t.id}:${d}`, source: 'workoutTemplate', sourceId: t.id, title: `${t.name} (prévu)`, start, end: t.time ? addMinutes(start, 75) : null, allDay: !t.time, category: 'sport', editable: false, status: 'planned', meta: { date: d } });
      }
    }
  }

  // Airbnb bookings (multi-day)
  const listings = new Map((await prisma.airbnbListing.findMany()).map((l) => [l.id, l.name]));
  for (const b of await prisma.airbnbBooking.findMany({ where: { checkIn: { lte: to }, checkOut: { gte: from } } })) {
    if (b.status === 'cancelled') continue;
    items.push({ id: `airbnbBooking:${b.id}`, source: 'airbnbBooking', sourceId: b.id, title: `Airbnb · ${b.guest} · ${listings.get(b.listingId!) ?? ''}`, start: b.checkIn!, end: b.checkOut!, allDay: true, category: 'airbnb', editable: true, status: b.status });
  }

  // Trips
  for (const t of await prisma.trip.findMany({ where: { start: { lte: to }, OR: [{ end: { gte: from } }, { end: null, start: { gte: from } }] } })) {
    if (!t.start) continue;
    items.push({ id: `trip:${t.id}`, source: 'trip', sourceId: t.id, title: `✈︎ ${t.destination}`, start: t.start, end: t.end ? addDays(t.end, 1) : null, allDay: true, category: 'voyage', editable: true, status: t.status });
  }

  // Social content (pharmacy + lash)
  for (const p of await prisma.contentPost.findMany({ where: { date: { gte: from, lte: to } } })) {
    items.push({ id: `contentPost:${p.id}`, source: 'contentPost', sourceId: p.id, title: `${p.account === 'lash' ? 'IG cils' : 'Pharma'} · ${p.format} · ${p.theme}`, start: p.time ? `${p.date}T${p.time}` : p.date!, allDay: !p.time, category: p.account === 'lash' ? 'business' : 'alternance', editable: true, status: p.status });
  }
  for (const c of await prisma.campaign.findMany({ where: { start: { lte: to }, OR: [{ end: { gte: from } }, { end: null, start: { gte: from } }] } })) {
    if (!c.start) continue;
    items.push({ id: `campaign:${c.id}`, source: 'campaign', sourceId: c.id, title: `Campagne · ${c.name}`, start: c.start, end: c.end ? addDays(c.end, 1) : null, allDay: true, category: 'alternance', editable: true, status: c.status });
  }

  // TOEIC official exam dates
  for (const x of await prisma.toeicExam.findMany({ where: { date: { gte: from, lte: to }, type: { in: ['planned', 'official'] } } })) {
    items.push({ id: `toeicExam:${x.id}`, source: 'toeicExam', sourceId: x.id, title: x.type === 'planned' ? 'Examen TOEIC' : `TOEIC · ${x.total ?? ''}`, start: x.date!, allDay: true, category: 'toeic', editable: true });
  }

  // Savings / goal deadlines
  for (const g of await prisma.goal.findMany({ where: { targetDate: { gte: from, lte: to }, status: 'active' } })) {
    items.push({ id: `goal:${g.id}`, source: 'goal', sourceId: g.id, title: `◎ Objectif · ${g.title}`, start: g.targetDate!, allDay: true, category: 'perso', editable: true });
  }

  return items.sort((a, b) => a.start.localeCompare(b.start));
}

/** Move an item (drag & drop) — writes back to the owning module. */
async function moveItem(source: string, id: number, start: string, end: string | null, allDay: boolean) {
  const date = start.slice(0, 10);
  const time = !allDay && start.length > 10 ? start.slice(11, 16) : null;
  switch (source) {
    case 'event':
      return updateRecord('event', id, { start: start.length > 10 ? start : `${date}T00:00`, end: end && end.length > 10 ? end : end ? `${end.slice(0, 10)}T00:00` : null, allDay });
    case 'task':
      return updateRecord('task', id, { date, time });
    case 'homework':
      return updateRecord('homework', id, { dueDate: date, dueTime: time });
    case 'exam':
      return updateRecord('exam', id, { date, time });
    case 'lashAppointment':
      return updateRecord('lashAppointment', id, { start: start.length > 10 ? start : `${date}T10:00` });
    case 'workoutSession':
      return updateRecord('workoutSession', id, { date, time });
    case 'airbnbBooking': {
      const b = await prisma.airbnbBooking.findUnique({ where: { id } });
      if (!b) return;
      const nights = Math.round((new Date(b.checkOut!).getTime() - new Date(b.checkIn!).getTime()) / 86400000);
      return updateRecord('airbnbBooking', id, { checkIn: date, checkOut: addDays(date, nights) });
    }
    case 'trip': {
      const t = await prisma.trip.findUnique({ where: { id } });
      if (!t) return;
      const len = t.start && t.end ? Math.round((new Date(t.end).getTime() - new Date(t.start).getTime()) / 86400000) : 0;
      return updateRecord('trip', id, { start: date, end: t.end ? addDays(date, len) : null });
    }
    case 'contentPost':
      return updateRecord('contentPost', id, { date, time });
    case 'campaign': {
      const c = await prisma.campaign.findUnique({ where: { id } });
      if (!c) return;
      const len = c.start && c.end ? Math.round((new Date(c.end).getTime() - new Date(c.start).getTime()) / 86400000) : 0;
      return updateRecord('campaign', id, { start: date, end: c.end ? addDays(date, len) : null });
    }
    case 'toeicExam':
      return updateRecord('toeicExam', id, { date });
    case 'goal':
      return updateRecord('goal', id, { targetDate: date });
    default:
      throw Object.assign(new Error('Élément non déplaçable'), { status: 400 });
  }
}

export const calendarRouter = Router();
calendarRouter.get('/', async (req, res, next) => {
  try {
    const from = String(req.query.from ?? '').slice(0, 10);
    const to = String(req.query.to ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return res.status(400).json({ error: 'from/to requis' });
    res.json(await calendarFeed(from, to));
  } catch (e) {
    next(e);
  }
});
calendarRouter.post('/move', async (req, res, next) => {
  try {
    const { source, sourceId, start, end, allDay } = req.body ?? {};
    await moveItem(String(source), Number(sourceId), String(start), end ? String(end) : null, !!allDay);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
