/** Smart reminders computed from real data (no background service needed). */
import { Router } from 'express';
import { prisma } from './db';
import { addDays, today, toISODateTime, diffDays } from '../../shared/dates';
import { getSetting } from './settings';
import { waterToday, lashSummary } from './stats';

export interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  at: string;
  level: 'info' | 'warn' | 'urgent';
  link: string;
}

export async function computeNotifications(): Promise<Notice[]> {
  const prefs = await getSetting('notifications');
  if (!prefs.enabled) return [];
  const now = toISODateTime(new Date());
  const ref = today();
  const out: Notice[] = [];
  const soon = (start: string, minutes: number) => start >= now && start <= toISODateTime(new Date(Date.now() + minutes * 60000));

  for (const e of await prisma.event.findMany({ where: { start: { gte: now.slice(0, 10), lte: addDays(ref, 1) + 'T23:59' } } })) {
    const lead = e.reminderMin ?? (e.allDay ? 0 : 60);
    if (!e.allDay && soon(e.start!, Math.max(lead, 1))) out.push({ id: `event-${e.id}`, kind: 'event', title: e.title!, body: `À ${e.start!.slice(11)}${e.location ? ` · ${e.location}` : ''}`, at: e.start!, level: 'info', link: '/calendar' });
    if (e.category === 'finance' && e.start!.slice(0, 10) <= addDays(ref, 1)) out.push({ id: `bill-${e.id}`, kind: 'finance', title: `Échéance : ${e.title}`, body: e.start!.slice(0, 10) === ref ? 'Aujourd’hui' : 'Demain', at: e.start!, level: 'warn', link: '/calendar' });
  }
  for (const a of await prisma.lashAppointment.findMany({ where: { start: { gte: now, lte: addDays(ref, 1) + 'T23:59' }, status: { in: ['booked', 'confirmed'] } } })) {
    const client = await prisma.client.findUnique({ where: { id: a.clientId! } });
    const isSoon = soon(a.start!, prefs.appointmentMinutes ?? 60);
    out.push({ id: `lash-${a.id}`, kind: 'cils', title: `RDV cils · ${client?.name ?? ''}`, body: `${a.start!.slice(0, 10) === ref ? 'Aujourd’hui' : 'Demain'} à ${a.start!.slice(11)}${a.status === 'booked' ? ' · à confirmer' : ''}`, at: a.start!, level: isSoon ? 'urgent' : 'info', link: '/lash' });
  }
  for (const h of await prisma.homework.findMany({ where: { status: { not: 'done' }, dueDate: { lte: addDays(ref, prefs.homeworkDays ?? 2) } } })) {
    const d = diffDays(h.dueDate!, ref);
    out.push({ id: `hw-${h.id}`, kind: 'devoirs', title: `Devoir : ${h.title}`, body: d < 0 ? `En retard de ${-d} j` : d === 0 ? 'À rendre aujourd’hui' : `À rendre dans ${d} j`, at: h.dueDate!, level: d <= 0 ? 'urgent' : 'warn', link: '/studies' });
  }
  if (prefs.overdueTasks) {
    const overdue = await prisma.task.count({ where: { status: { not: 'done' }, date: { lt: ref } } });
    if (overdue) out.push({ id: `overdue-${ref}`, kind: 'tasks', title: `${overdue} tâche${overdue > 1 ? 's' : ''} en retard`, body: 'Replanifiez-les ou terminez-les.', at: ref, level: 'warn', link: '/tasks?view=overdue' });
  }
  for (const b of await prisma.airbnbBooking.findMany({ where: { status: { in: ['confirmed', 'paid'] }, OR: [{ checkIn: { gte: ref, lte: addDays(ref, 1) } }, { checkOut: { gte: ref, lte: addDays(ref, 1) } }] } })) {
    const arrival = b.checkIn! >= ref && b.checkIn! <= addDays(ref, 1);
    out.push({ id: `airbnb-${b.id}-${arrival ? 'in' : 'out'}`, kind: 'airbnb', title: `Airbnb · ${arrival ? 'arrivée' : 'départ'} de ${b.guest}`, body: (arrival ? b.checkIn : b.checkOut) === ref ? 'Aujourd’hui' : 'Demain', at: (arrival ? b.checkIn : b.checkOut)!, level: 'info', link: '/airbnb' });
  }
  for (const g of await prisma.goal.findMany({ where: { status: 'active', targetDate: { gte: ref, lte: addDays(ref, 7) } } })) {
    out.push({ id: `goal-${g.id}`, kind: 'goal', title: `Objectif bientôt : ${g.title}`, body: `Date cible ${g.targetDate}`, at: g.targetDate!, level: 'info', link: '/goals' });
  }
  const toeicPlan = await getSetting('toeicPlan');
  const wd = String(new Date().getDay());
  const attemptsToday = await prisma.toeicAttempt.count({ where: { date: ref } });
  if (toeicPlan?.[wd] && !attemptsToday && new Date().getHours() >= 17) {
    out.push({ id: `toeic-${ref}`, kind: 'toeic', title: `TOEIC : ${toeicPlan[wd].focus}`, body: `${toeicPlan[wd].minutes} min prévues aujourd’hui`, at: ref, level: 'info', link: '/toeic' });
  }
  const templates = await prisma.workoutTemplate.findMany({ where: { active: true, weekday: wd } });
  const sessionToday = await prisma.workoutSession.count({ where: { date: ref } });
  for (const t of templates) if (!sessionToday) out.push({ id: `sport-${t.id}-${ref}`, kind: 'sport', title: `Séance du jour : ${t.name}`, body: t.time ? `Prévue à ${t.time}` : 'Prévue aujourd’hui', at: ref, level: 'info', link: '/fitness' });
  if (prefs.waterReminder && new Date().getHours() >= 15) {
    const w = await waterToday(ref);
    if (w.pct < 50) out.push({ id: `water-${ref}`, kind: 'water', title: 'Pensez à boire 💧', body: `${w.ml} ml sur ${w.goal} ml aujourd’hui`, at: ref, level: 'info', link: '/water' });
  }
  const lash = await lashSummary(ref);
  if (lash.lowStock.length) out.push({ id: `stock-${ref}`, kind: 'stock', title: 'Stock cils bas', body: lash.lowStock.join(', '), at: ref, level: 'warn', link: '/lash?tab=stock' });
  const order = { urgent: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level] || a.at.localeCompare(b.at));
}

export const notificationsRouter = Router();
notificationsRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await computeNotifications());
  } catch (e) {
    next(e);
  }
});
