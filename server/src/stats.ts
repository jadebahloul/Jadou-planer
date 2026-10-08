/** Real-data summaries shared by the dashboard, command center, analytics, reviews and Jadou AI. */
import { prisma } from './db';
import { accountBalance, flowTotals, round2, monthlyNeeded } from '../../shared/finance';
import { addDays, endOfMonth, startOfMonth, startOfWeek, today, monthKey, addMonths } from '../../shared/dates';
import { getSetting } from './settings';

export async function moneySummary(ref = today()) {
  const from = startOfMonth(ref);
  const to = endOfMonth(ref);
  const accounts = await prisma.bankAccount.findMany({ where: { archived: { not: true } } });
  const txs = await prisma.transaction.findMany();
  const txLike = txs.map((t) => ({ ...t, amount: t.amount ?? 0, accountId: t.accountId!, date: t.date! }));
  const balances = accounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank, type: a.type, color: a.color, balance: accountBalance({ id: a.id, initialBalance: a.initialBalance, initialDate: a.initialDate }, txLike) }));
  const sumType = (types: string[]) => round2(balances.filter((b) => types.includes(b.type ?? 'current')).reduce((s, b) => s + b.balance, 0));
  const monthTx = txLike.filter((t) => t.date >= from && t.date <= to);
  const flows = flowTotals(monthTx);
  const byCategory: Record<string, number> = {};
  const incomeBySource: Record<string, number> = {};
  for (const t of monthTx) {
    if (t.type === 'expense') byCategory[t.category ?? 'autre'] = round2((byCategory[t.category ?? 'autre'] ?? 0) + t.amount);
    if (t.type === 'income') incomeBySource[t.category ?? 'autre'] = round2((incomeBySource[t.category ?? 'autre'] ?? 0) + t.amount);
  }
  // investments current value
  const investments = await prisma.investment.findMany();
  const invested = round2(investments.reduce((s, i) => s + (i.amount ?? 0), 0));
  const investValue = round2(investments.reduce((s, i) => s + (i.units && i.currentPrice ? i.units * i.currentPrice : i.amount ?? 0), 0));
  // savings goals
  const goals = await prisma.savingsGoal.findMany();
  const contribs = await prisma.savingsContribution.findMany();
  const savingsGoals = goals.map((g) => {
    const saved = round2((g.initialAmount ?? 0) + contribs.filter((c) => c.goalId === g.id).reduce((s, c) => s + (c.amount ?? 0), 0));
    return { id: g.id, name: g.name, target: g.target ?? 0, saved, pct: g.target ? Math.min(100, Math.round((saved / g.target) * 100)) : 0, targetDate: g.targetDate, monthlyNeeded: monthlyNeeded(g.target ?? 0, saved, ref, g.targetDate), color: g.color };
  });
  const savedThisMonth = round2(contribs.filter((c) => c.date! >= from && c.date! <= to).reduce((s, c) => s + (c.amount ?? 0), 0));
  // transfers into savings accounts this month count as "épargne du mois"
  const savingsIds = new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  const transferredToSavings = round2(monthTx.filter((t) => t.type === 'transfer' && t.toAccountId && savingsIds.has(t.toAccountId) && !savingsIds.has(t.accountId)).reduce((s, t) => s + t.amount, 0));
  // budget & forecast
  const lines = await prisma.budgetLine.findMany({ where: { OR: [{ month: monthKey(ref) }, { month: null }, { month: '' }] } });
  const planned = (kind: string) => round2(lines.filter((l) => l.kind === kind).reduce((s, l) => s + (l.amount ?? 0), 0));
  const plannedIncome = planned('income');
  const plannedOut = planned('fixed') + planned('variable');
  const available = sumType(['current', 'cash', 'other']);
  const forecast = round2(available + Math.max(0, plannedIncome - flows.income) - Math.max(0, plannedOut - flows.expense));
  return {
    month: monthKey(ref),
    accounts: balances,
    available,
    savingsBalance: sumType(['savings']),
    investmentAccounts: sumType(['investment']),
    total: round2(balances.reduce((s, b) => s + b.balance, 0)),
    invested,
    investValue,
    netWorth: round2(balances.filter((b) => b.type !== 'investment').reduce((s, b) => s + b.balance, 0) + investValue),
    income: flows.income,
    expense: flows.expense,
    net: flows.net,
    byCategory,
    incomeBySource,
    savingsGoals,
    savedThisMonth: round2(savedThisMonth + transferredToSavings),
    budget: { plannedIncome, plannedOut: round2(plannedOut), plannedSavings: planned('savings'), plannedInvest: planned('investment'), hasBudget: lines.length > 0 },
    forecast,
    hasAccounts: accounts.length > 0,
  };
}

/** Month-by-month series for charts (last n months). */
export async function moneySeries(n = 6, ref = today()) {
  const txs = (await prisma.transaction.findMany()).map((t) => ({ ...t, amount: t.amount ?? 0, accountId: t.accountId!, date: t.date! }));
  const accounts = await prisma.bankAccount.findMany();
  const contribs = await prisma.savingsContribution.findMany();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(startOfMonth(ref), -i);
    const from = m;
    const to = endOfMonth(m);
    const f = flowTotals(txs.filter((t) => t.date >= from && t.date <= to));
    const balanceEnd = round2(accounts.reduce((s, a) => s + accountBalance({ id: a.id, initialBalance: a.initialBalance, initialDate: a.initialDate }, txs, to), 0));
    const saved = round2(contribs.filter((c) => c.date! >= from && c.date! <= to).reduce((s, c) => s + (c.amount ?? 0), 0));
    out.push({ month: monthKey(m), income: f.income, expense: f.expense, net: f.net, balance: balanceEnd, saved });
  }
  return out;
}

export async function lashSummary(ref = today()) {
  const appts = await prisma.lashAppointment.findMany();
  const services = await prisma.lashService.findMany();
  const svc = new Map(services.map((s) => [s.id, s]));
  const billed = appts.filter((a) => a.status === 'done');
  const inRange = (from: string, to: string) => billed.filter((a) => a.start!.slice(0, 10) >= from && a.start!.slice(0, 10) <= to);
  const sum = (arr: typeof appts) => round2(arr.reduce((s, a) => s + (a.price ?? 0), 0));
  const wk = startOfWeek(ref);
  const m0 = startOfMonth(ref);
  const m1 = endOfMonth(ref);
  const monthAppts = inRange(m0, m1);
  const consumables = round2(monthAppts.reduce((s, a) => s + (a.serviceId ? svc.get(a.serviceId)?.consumableCost ?? 0 : 0), 0));
  const expenses = round2((await prisma.transaction.findMany({ where: { type: 'expense', category: 'materiel_cils', date: { gte: m0, lte: m1 } } })).reduce((s, t) => s + (t.amount ?? 0), 0));
  const cashed = round2((await prisma.transaction.findMany({ where: { type: 'income', category: 'cils', date: { gte: m0, lte: m1 } } })).reduce((s, t) => s + (t.amount ?? 0), 0));
  const upcoming = appts.filter((a) => a.start! >= `${ref}T00:00` && !['cancelled', 'done', 'no_show'].includes(a.status ?? '')).sort((a, b) => a.start!.localeCompare(b.start!));
  const lowStock = await prisma.stockItem.findMany();
  const allTime = sum(billed);
  return {
    today: sum(inRange(ref, ref)),
    week: sum(inRange(wk, addDays(wk, 6))),
    month: sum(monthAppts),
    monthCount: monthAppts.length,
    allTime,
    clientsCount: await prisma.client.count(),
    clientsThisMonth: new Set(monthAppts.map((a) => a.clientId)).size,
    avgBasket: monthAppts.length ? round2(sum(monthAppts) / monthAppts.length) : 0,
    consumables,
    expenses,
    estimatedResult: round2(sum(monthAppts) - consumables - expenses),
    cashedThisMonth: cashed,
    unpaid: billed.filter((a) => a.paymentStatus !== 'paid').length,
    upcomingCount: upcoming.length,
    nextAppointment: upcoming[0] ?? null,
    lowStock: lowStock.filter((s) => (s.quantity ?? 0) <= (s.alertThreshold ?? 0)).map((s) => s.name),
  };
}

export async function fitnessSummary(ref = today()) {
  const goals = await getSetting('goals');
  const wk = startOfWeek(ref);
  const sessions = await prisma.workoutSession.findMany({ where: { status: 'done' } });
  const weekDone = sessions.filter((s) => s.date! >= wk && s.date! <= addDays(wk, 6)).length;
  const monthDone = sessions.filter((s) => s.date!.slice(0, 7) === ref.slice(0, 7)).length;
  return { weekDone, weekGoal: goals.workoutsPerWeek ?? 3, monthDone, total: sessions.length, last: sessions.sort((a, b) => b.date!.localeCompare(a.date!))[0] ?? null };
}

export async function waterToday(ref = today()) {
  const goals = await getSetting('goals');
  const logs = await prisma.waterLog.findMany({ where: { date: ref } });
  const ml = logs.reduce((s, l) => s + (l.ml ?? 0), 0);
  return { ml, goal: goals.waterMl ?? 2000, pct: Math.min(100, Math.round((ml / (goals.waterMl || 2000)) * 100)) };
}

export async function studiesSummary(ref = today()) {
  const homework = await prisma.homework.findMany({ where: { status: { not: 'done' } }, orderBy: { dueDate: 'asc' } });
  const exams = await prisma.exam.findMany({ where: { date: { gte: ref } }, orderBy: { date: 'asc' } });
  const courses = await prisma.course.findMany();
  const grades = await prisma.grade.findMany();
  // weighted average /20
  let num = 0;
  let den = 0;
  for (const c of courses) {
    const gs = grades.filter((g) => g.courseId === c.id);
    if (!gs.length) continue;
    const cw = gs.reduce((s, g) => s + (g.coefficient ?? 1), 0);
    const avg = gs.reduce((s, g) => s + ((g.value ?? 0) / (g.outOf || 20)) * 20 * (g.coefficient ?? 1), 0) / cw;
    num += avg * (c.coefficient ?? 1);
    den += c.coefficient ?? 1;
  }
  return {
    homeworkOpen: homework.length,
    homeworkOverdue: homework.filter((h) => h.dueDate! < ref).length,
    nextHomework: homework.slice(0, 5),
    exams: exams.slice(0, 5),
    average: den ? round2(num / den) : null,
  };
}

export async function toeicSummary(ref = today()) {
  const goals = await getSetting('goals');
  const exams = await prisma.toeicExam.findMany({ orderBy: { date: 'desc' } });
  const scored = exams.filter((e) => e.total != null && e.type !== 'planned');
  const planned = exams.filter((e) => e.type === 'planned' && e.date! >= ref).sort((a, b) => a.date!.localeCompare(b.date!))[0] ?? null;
  const attempts = await prisma.toeicAttempt.findMany();
  const weekStart = startOfWeek(ref);
  const minutes = Math.round(attempts.reduce((s, a) => s + (a.durationSec ?? 0), 0) / 60);
  const weekMinutes = Math.round(attempts.filter((a) => a.date! >= weekStart).reduce((s, a) => s + (a.durationSec ?? 0), 0) / 60);
  const focusToeic = await prisma.focusSession.findMany({ where: { category: 'toeic' } });
  const byPart: Record<number, { score: number; total: number }> = {};
  for (const a of attempts) {
    byPart[a.part!] ??= { score: 0, total: 0 };
    byPart[a.part!].score += a.score ?? 0;
    byPart[a.part!].total += a.total ?? 0;
  }
  const weakParts = Object.entries(byPart)
    .filter(([, v]) => v.total >= 3)
    .map(([p, v]) => ({ part: Number(p), rate: Math.round((v.score / v.total) * 100) }))
    .sort((a, b) => a.rate - b.rate);
  const mistakes = await prisma.toeicMistake.findMany({ where: { reviewed: false } });
  const notions: Record<string, number> = {};
  for (const m of mistakes) if (m.notion) notions[m.notion] = (notions[m.notion] ?? 0) + 1;
  return {
    target: goals.toeicTarget ?? 600,
    current: scored[0]?.total ?? null,
    best: scored.length ? Math.max(...scored.map((e) => e.total!)) : null,
    examDate: planned?.date ?? null,
    exercises: attempts.length,
    questions: attempts.reduce((s, a) => s + (a.total ?? 0), 0),
    accuracy: attempts.length ? Math.round((attempts.reduce((s, a) => s + (a.score ?? 0), 0) / Math.max(1, attempts.reduce((s, a) => s + (a.total ?? 0), 0))) * 100) : null,
    minutes: minutes + focusToeic.reduce((s, f) => s + (f.minutes ?? 0), 0),
    weekMinutes,
    weakParts,
    weakNotions: Object.entries(notions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => ({ notion: n, count: c })),
    flashcardsDue: await prisma.flashcard.count({ where: { OR: [{ nextReview: null }, { nextReview: { lte: ref } }] } }),
  };
}

export async function tasksSummary(ref = today()) {
  const open = await prisma.task.findMany({ where: { status: { not: 'done' } } });
  const todayTasks = open.filter((t) => t.date === ref);
  const overdue = open.filter((t) => t.date && t.date < ref);
  const doneToday = await prisma.task.count({ where: { status: 'done', date: ref } });
  return { today: todayTasks.length, overdue: overdue.length, open: open.length, doneToday };
}

export async function habitsToday(ref = today()) {
  const habits = await prisma.habit.findMany({ where: { active: true } });
  const logs = await prisma.habitLog.findMany({ where: { date: ref } });
  return { total: habits.length, done: habits.filter((h) => logs.some((l) => l.habitId === h.id)).length };
}

export async function goalsSummary() {
  const goals = await prisma.goal.findMany({ where: { status: 'active' } });
  const pct = (g: (typeof goals)[number]) => (g.targetValue ? Math.min(100, Math.round(((g.currentValue ?? 0) / g.targetValue) * 100)) : g.progress ?? 0);
  return {
    active: goals.length,
    avg: goals.length ? Math.round(goals.reduce((s, g) => s + pct(g), 0) / goals.length) : 0,
    top: goals.slice(0, 5).map((g) => ({ id: g.id, title: g.title, pct: pct(g), category: g.category })),
    done: await prisma.goal.count({ where: { status: 'done' } }),
  };
}

export async function airbnbSummary(ref = today()) {
  const m0 = startOfMonth(ref);
  const m1 = endOfMonth(ref);
  const listings = await prisma.airbnbListing.findMany();
  const bookings = (await prisma.airbnbBooking.findMany()).filter((b) => b.status !== 'cancelled' && b.status !== 'inquiry');
  const daysInMonth = Number(m1.slice(8, 10));
  let nights = 0;
  let revenue = 0;
  let fees = 0;
  for (const b of bookings) {
    const s = b.checkIn! < m0 ? m0 : b.checkIn!;
    const e = b.checkOut! > addDays(m1, 1) ? addDays(m1, 1) : b.checkOut!;
    const n = Math.max(0, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000));
    const total = Math.max(1, Math.round((new Date(b.checkOut!).getTime() - new Date(b.checkIn!).getTime()) / 86400000));
    nights += n;
    revenue += ((b.amount ?? 0) * n) / total;
    fees += ((b.fees ?? 0) * n) / total;
  }
  const costs = listings.reduce((s, l) => s + (l.monthlyCosts ?? 0), 0);
  return {
    listings: listings.length,
    bookingsMonth: bookings.filter((b) => b.checkIn! <= m1 && b.checkOut! >= m0).length,
    nights,
    occupancy: listings.length ? Math.round((nights / (daysInMonth * listings.length)) * 100) : 0,
    revenue: round2(revenue),
    fees: round2(fees),
    costs: round2(costs),
    result: round2(revenue - fees - costs),
    avgNight: nights ? round2(revenue / nights) : 0,
    upcoming: bookings.filter((b) => b.checkIn! >= ref).sort((a, b) => a.checkIn!.localeCompare(b.checkIn!)).slice(0, 5),
  };
}

/** Aggregated activity between two dates (inclusive) — used by reviews & Life Analytics. */
export async function periodSummary(from: string, to: string) {
  const fromTs = new Date(`${from}T00:00:00`);
  const toTs = new Date(`${to}T23:59:59`);
  const tasksDone = await prisma.task.findMany({ where: { status: 'done', completedAt: { gte: fromTs.toISOString(), lte: toTs.toISOString() } } });
  const focus = await prisma.focusSession.findMany({ where: { date: { gte: from, lte: to } } });
  const attempts = await prisma.toeicAttempt.findMany({ where: { date: { gte: from, lte: to } } });
  const workouts = await prisma.workoutSession.findMany({ where: { status: 'done', date: { gte: from, lte: to } } });
  const txs = await prisma.transaction.findMany({ where: { date: { gte: from, lte: to } } });
  const contribs = await prisma.savingsContribution.findMany({ where: { date: { gte: from, lte: to } } });
  const goalsDone = await prisma.goal.findMany({ where: { status: 'done', updatedAt: { gte: fromTs, lte: toTs } } });
  const lash = await prisma.lashAppointment.findMany({ where: { status: 'done', start: { gte: from, lte: `${to}T23:59` } } });
  const ideas = await prisma.businessIdea.count({ where: { updatedAt: { gte: fromTs, lte: toTs } } });
  const thesis = await prisma.thesisItem.count({ where: { updatedAt: { gte: fromTs, lte: toTs } } });
  const projects = await prisma.groupProject.count({ where: { updatedAt: { gte: fromTs, lte: toTs } } });
  const homeworkDone = await prisma.homework.count({ where: { status: 'done', updatedAt: { gte: fromTs, lte: toTs } } });
  const journal = await prisma.journalEntry.count({ where: { date: { gte: from, lte: to } } });
  const habitLogs = await prisma.habitLog.count({ where: { date: { gte: from, lte: to } } });
  const flows = flowTotals(txs.map((t) => ({ ...t, amount: t.amount ?? 0, accountId: t.accountId!, date: t.date! })));
  const byCat: Record<string, number> = {};
  for (const t of tasksDone) byCat[t.category ?? 'perso'] = (byCat[t.category ?? 'perso'] ?? 0) + 1;
  const studyMinutes = focus.filter((f) => ['cours', 'devoirs', 'toeic'].includes(f.category ?? '')).reduce((s, f) => s + (f.minutes ?? 0), 0);
  return {
    from,
    to,
    tasksDone: tasksDone.length,
    tasksByCategory: byCat,
    topTasks: tasksDone.filter((t) => t.priority === 'high' || t.priority === 'urgent' || t.focus).slice(0, 8).map((t) => t.title),
    focusMinutes: focus.reduce((s, f) => s + (f.minutes ?? 0), 0),
    studyMinutes,
    toeicAttempts: attempts.length,
    toeicMinutes: Math.round(attempts.reduce((s, a) => s + (a.durationSec ?? 0), 0) / 60) + focus.filter((f) => f.category === 'toeic').reduce((s, f) => s + (f.minutes ?? 0), 0),
    toeicAccuracy: attempts.length ? Math.round((attempts.reduce((s, a) => s + (a.score ?? 0), 0) / Math.max(1, attempts.reduce((s, a) => s + (a.total ?? 0), 0))) * 100) : null,
    workouts: workouts.length,
    income: flows.income,
    expense: flows.expense,
    net: flows.net,
    saved: round2(contribs.reduce((s, c) => s + (c.amount ?? 0), 0)),
    lashRevenue: round2(lash.reduce((s, a) => s + (a.price ?? 0), 0)),
    lashCount: lash.length,
    goalsDone: goalsDone.map((g) => g.title),
    projectsUpdated: ideas + thesis + projects,
    homeworkDone,
    journal,
    habitLogs,
  };
}
