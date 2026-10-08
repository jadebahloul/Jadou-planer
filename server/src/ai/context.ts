import { prisma } from '../db';
import { today, addDays } from '../../../shared/dates';
import { calendarFeed, type CalItem } from '../calendar';
import { moneySummary, lashSummary, fitnessSummary, studiesSummary, toeicSummary, tasksSummary, goalsSummary, waterToday, airbnbSummary } from '../stats';
import { getSetting } from '../settings';
import { timeToMinutes, minutesToTime } from '../../../shared/dates';

/** Compact, real-data snapshot handed to the local LLM. Health data only if explicitly allowed. */
export async function buildContext() {
  const ref = today();
  const ai = await getSetting('ai');
  const profile = await getSetting('profile');
  const [money, lash, fitness, studies, toeic, tasks, goals, airbnb] = await Promise.all([moneySummary(ref), lashSummary(ref), fitnessSummary(ref), studiesSummary(ref), toeicSummary(ref), tasksSummary(ref), goalsSummary(), airbnbSummary(ref)]);
  const openTasks = await prisma.task.findMany({ where: { status: { not: 'done' }, OR: [{ date: { lte: addDays(ref, 7) } }, { date: null }] }, orderBy: [{ date: 'asc' }], take: 40 });
  const agenda = (await calendarFeed(ref, addDays(ref, 7))).filter((i) => i.source !== 'task').slice(0, 60);
  const memory = await prisma.memory.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const wishlist = await prisma.wishlistItem.findMany({ where: { status: { notIn: ['purchased', 'archived'] } } });
  const ctx: Record<string, unknown> = {
    today: ref,
    weekday: new Date().toLocaleDateString('fr-FR', { weekday: 'long' }),
    now: new Date().toTimeString().slice(0, 5),
    profile,
    memory: memory.map((m) => `${m.category}: ${m.content}`),
    tasks: { ...tasks, list: openTasks.map((t) => ({ id: t.id, title: t.title, date: t.date, time: t.time, priority: t.priority, category: t.category, status: t.status, focus: t.focus })) },
    agenda7days: agenda.map((i) => ({ title: i.title, start: i.start, end: i.end, category: i.category })),
    studies: { ...studies, nextHomework: studies.nextHomework.map((h) => ({ title: h.title, dueDate: h.dueDate, status: h.status })), exams: studies.exams.map((e) => ({ title: e.title, date: e.date })) },
    toeic,
    fitness,
    money: { ...money, accounts: money.accounts.map((a) => ({ name: a.name, bank: a.bank, type: a.type, balance: a.balance })) },
    lash,
    airbnb: { ...airbnb, upcoming: airbnb.upcoming.map((b) => ({ guest: b.guest, checkIn: b.checkIn, checkOut: b.checkOut })) },
    goals,
    wishlist: { count: wishlist.length, total: wishlist.reduce((s, w) => s + (w.price ?? 0), 0), items: wishlist.slice(0, 30).map((w) => ({ name: w.name, brand: w.brand, price: w.price, category: w.category, status: w.status })) },
  };
  if (ai.shareHealthData) ctx.water = await waterToday(ref);
  return ctx;
}

/** Free time slots on a given day (between dayStart and dayEnd), from the unified calendar. */
export async function freeSlots(date: string, minDuration: number, dayStart = '08:00', dayEnd = '21:30', extraBusy: [number, number][] = []) {
  const items = await calendarFeed(date, date);
  const busy: [number, number][] = [...extraBusy];
  for (const i of items as CalItem[]) {
    if (i.allDay || i.start.length <= 10) continue;
    const s = timeToMinutes(i.start.slice(11, 16));
    const e = i.end && i.end.length > 10 && i.end.slice(0, 10) === date ? timeToMinutes(i.end.slice(11, 16)) : s + 60;
    busy.push([s, e]);
  }
  busy.sort((a, b) => a[0] - b[0]);
  const slots: { start: string; end: string; minutes: number }[] = [];
  let cur = timeToMinutes(dayStart);
  if (date === today()) {
    const now = new Date();
    cur = Math.max(cur, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
  }
  const end = timeToMinutes(dayEnd);
  for (const [s, e] of busy) {
    if (s - cur >= minDuration) slots.push({ start: minutesToTime(cur), end: minutesToTime(s), minutes: s - cur });
    cur = Math.max(cur, e);
  }
  if (end - cur >= minDuration) slots.push({ start: minutesToTime(cur), end: minutesToTime(end), minutes: end - cur });
  return slots;
}
