/**
 * Jadou AI — local engine.
 * Deterministic answers computed from real data. Works with no AI model installed,
 * and is also used for precise questions (balances, revenue…) even when Ollama is running.
 */
import { prisma } from '../db';
import { normalize, parseCapture } from '../../../shared/parser';
import { addDays, today, startOfWeek, formatFr, weekdayOf, startOfMonth, endOfMonth, timeToMinutes, minutesToTime } from '../../../shared/dates';
import { eur, round2 } from '../../../shared/finance';
import { optionLabel, TX_CATEGORIES, WISHLIST_CATEGORIES } from '../../../shared/registry';
import { moneySummary, lashSummary, airbnbSummary, studiesSummary, toeicSummary, fitnessSummary, goalsSummary } from '../stats';
import { freeSlots } from './context';
import { getSetting } from '../settings';

export interface AiAction {
  op: 'create' | 'update';
  resource: string;
  id?: number;
  data: Record<string, unknown>;
  summary: string;
  hints?: Record<string, string>;
}

export interface AiReply {
  reply: string;
  actions: AiAction[];
  engine: 'local' | 'ollama';
  /** creative request better served by the LLM when it is available */
  creative?: boolean;
}

const PRIO_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

type Handler = (msg: string, n: string) => Promise<AiReply | null>;

const reply = (text: string, actions: AiAction[] = []): AiReply => ({ reply: text, actions, engine: 'local' });

// ---------------------------------------------------------------- intents

const priorities: Handler = async (_m, n) => {
  if (!/priorit|par quoi (je )?commenc|quoi faire aujourd|qu'est-ce que je dois faire/.test(n)) return null;
  const ref = today();
  const open = await prisma.task.findMany({ where: { status: { not: 'done' } } });
  const focus = open.filter((t) => t.focus && (!t.date || t.date <= ref));
  const overdue = open.filter((t) => t.date && t.date < ref);
  const todayT = open.filter((t) => t.date === ref && !t.focus);
  const hw = await prisma.homework.findMany({ where: { status: { not: 'done' }, dueDate: { lte: addDays(ref, 3) } }, orderBy: { dueDate: 'asc' } });
  const sorted = [...todayT].sort((a, b) => (PRIO_RANK[a.priority ?? 'medium'] ?? 2) - (PRIO_RANK[b.priority ?? 'medium'] ?? 2));
  const lines: string[] = [];
  if (focus.length) lines.push('**Tes priorités du jour (Today’s Focus)**', ...focus.map((t) => `• ${t.title}${t.time ? ` — ${t.time}` : ''}`));
  if (overdue.length) lines.push('', `**En retard (${overdue.length})**`, ...overdue.slice(0, 5).map((t) => `• ${t.title} (prévu ${formatFr(t.date)})`));
  if (hw.length) lines.push('', '**Devoirs à rendre sous 3 jours**', ...hw.map((h) => `• ${h.title} — ${formatFr(h.dueDate, { weekday: true })}`));
  if (sorted.length) lines.push('', '**Aujourd’hui**', ...sorted.slice(0, 8).map((t) => `• ${t.title}${t.priority === 'high' || t.priority === 'urgent' ? ' ⚑' : ''}`));
  if (!lines.length) return reply('Rien d’urgent : aucune tâche prévue aujourd’hui ni en retard. Tu peux avancer sur un objectif de fond ou planifier ta semaine ♡');
  const actions: AiAction[] = [];
  if (!focus.length && sorted.length) {
    for (const t of sorted.slice(0, 3)) actions.push({ op: 'update', resource: 'task', id: t.id, data: { focus: true }, summary: `Mettre « ${t.title} » dans Today’s Focus` });
  }
  return reply(lines.join('\n') + (actions.length ? '\n\nJe peux placer les 3 plus importantes dans ton Today’s Focus :' : ''), actions);
};

const organizeDay: Handler = async (_m, n) => {
  if (!/organis.*(journee|jour|aujourd)|planifie.*(journee|aujourd)|plan de (la )?journee/.test(n)) return null;
  const ref = /demain/.test(n) ? addDays(today(), 1) : today();
  const tasks = (await prisma.task.findMany({ where: { status: { not: 'done' }, OR: [{ date: ref }, { date: { lt: ref } }] } }))
    .filter((t) => !t.time)
    .sort((a, b) => Number(!!b.focus) - Number(!!a.focus) || (PRIO_RANK[a.priority ?? 'medium'] ?? 2) - (PRIO_RANK[b.priority ?? 'medium'] ?? 2));
  const slots = await freeSlots(ref, 20);
  if (!tasks.length) return reply(`Aucune tâche sans horaire à placer ${ref === today() ? 'aujourd’hui' : 'demain'}. Tes créneaux libres : ${slots.map((s) => `${s.start}–${s.end}`).join(', ') || 'aucun'}.`);
  const actions: AiAction[] = [];
  const lines: string[] = [];
  const pool = slots.map((s) => ({ cur: timeToMinutes(s.start), end: timeToMinutes(s.end) }));
  for (const t of tasks) {
    const dur = t.durationMin || 45;
    const slot = pool.find((p) => p.end - p.cur >= dur);
    if (!slot) {
      lines.push(`• ${t.title} — pas de créneau assez long, à reporter`);
      continue;
    }
    const time = minutesToTime(slot.cur);
    slot.cur += dur + 10; // 10 min breathing room
    lines.push(`• **${time}** ${t.title} (${dur} min)`);
    actions.push({ op: 'update', resource: 'task', id: t.id, data: { date: ref, time }, summary: `${time} · ${t.title}` });
  }
  const fixed = (await import('../calendar')).calendarFeed;
  const agenda = (await fixed(ref, ref)).filter((i) => i.start.length > 10 && i.source !== 'task');
  const head = agenda.length ? `**Déjà prévu**\n${agenda.map((a) => `• ${a.start.slice(11)} ${a.title}`).join('\n')}\n\n` : '';
  return reply(`${head}**Proposition pour ${ref === today() ? 'aujourd’hui' : 'demain'}**\n${lines.join('\n')}\n\nValide pour enregistrer les horaires dans My Tasks et My Calendar.`, actions);
};

const organizeWeek: Handler = async (_m, n) => {
  if (!/(organis|planifi|prepare).*(semaine)|planning de (la|ma) semaine/.test(n)) return null;
  const ref = today();
  const open = await prisma.task.findMany({ where: { status: { not: 'done' }, time: null, OR: [{ date: { lte: addDays(ref, 6) } }, { date: null }] } });
  if (!open.length) return reply('Toutes tes tâches de la semaine ont déjà un horaire (ou il n’y en a pas). Ta semaine est prête ✨');
  const sorted = open.sort((a, b) => (PRIO_RANK[a.priority ?? 'medium'] ?? 2) - (PRIO_RANK[b.priority ?? 'medium'] ?? 2) || String(a.date ?? '9999').localeCompare(String(b.date ?? '9999')));
  const actions: AiAction[] = [];
  const lines: string[] = [];
  const pools: Record<string, { cur: number; end: number }[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(ref, i);
    pools[d] = (await freeSlots(d, 20, '08:30', '21:00')).map((x) => ({ cur: timeToMinutes(x.start), end: timeToMinutes(x.end) }));
  }
  const load: Record<string, number> = {};
  for (const t of sorted) {
    const dur = t.durationMin || 45;
    // keep the planned day when possible, otherwise the least loaded day before the deadline
    const candidates = Object.keys(pools).filter((d) => !t.date || t.date < ref || d <= t.date);
    const preferred = t.date && t.date >= ref ? [t.date, ...candidates.filter((d) => d !== t.date)] : candidates.sort((a, b) => (load[a] ?? 0) - (load[b] ?? 0));
    let placed = false;
    for (const d of preferred) {
      const slot = pools[d]?.find((p) => p.end - p.cur >= dur);
      if (!slot) continue;
      const time = minutesToTime(slot.cur);
      slot.cur += dur + 10;
      load[d] = (load[d] ?? 0) + dur;
      lines.push(`• ${formatFr(d, { weekday: true })} **${time}** — ${t.title}`);
      actions.push({ op: 'update', resource: 'task', id: t.id, data: { date: d, time }, summary: `${formatFr(d, { weekday: true })} ${time} · ${t.title}` });
      placed = true;
      break;
    }
    if (!placed) lines.push(`• ${t.title} — pas de créneau libre cette semaine`);
  }
  return reply(`**Proposition de planning pour les 7 prochains jours** (autour de tes cours, alternance, RDV et séances) :\n${lines.join('\n')}\n\nValide les créneaux qui te conviennent.`, actions);
};

const homework: Handler = async (_m, n) => {
  if (!/devoir|a rendre|rendus?\b/.test(n) || /ajoute|cree|nouveau/.test(n)) return null;
  const s = await studiesSummary();
  const all = await prisma.homework.findMany({ where: { status: { not: 'done' } }, orderBy: { dueDate: 'asc' } });
  if (!all.length) return reply('Aucun devoir en attente 🎓 Tout est rendu !');
  const courses = new Map((await prisma.course.findMany()).map((c) => [c.id, c.name]));
  return reply(
    `**${all.length} devoir${all.length > 1 ? 's' : ''} à rendre**${s.homeworkOverdue ? ` (dont ${s.homeworkOverdue} en retard)` : ''}\n` +
      all.map((h) => `• ${h.title}${h.courseId ? ` · ${courses.get(h.courseId)}` : ''} — ${formatFr(h.dueDate, { weekday: true })}${h.dueDate! < today() ? ' ⚠︎ en retard' : ''}`).join('\n') +
      (s.exams.length ? `\n\n**Prochains examens**\n${s.exams.map((e) => `• ${e.title} — ${formatFr(e.date, { weekday: true })}`).join('\n')}` : ''),
  );
};

const toeicPlanIntent: Handler = async (_m, n) => {
  if (!/toeic/.test(n) || !/programme|planifi|organis|revision|plan/.test(n)) return null;
  const plan = await getSetting('toeicPlan');
  const ref = today();
  const actions: AiAction[] = [];
  const lines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ref, i);
    const p = plan[String(weekdayOf(d))];
    if (!p) continue;
    const exists = await prisma.task.findFirst({ where: { date: d, category: 'toeic', title: { contains: p.focus } } });
    if (exists) continue;
    const slots = await freeSlots(d, p.minutes, '17:00', '21:30');
    const time = slots[0]?.start ?? null;
    lines.push(`• ${formatFr(d, { weekday: true })}${time ? ` à ${time}` : ''} — ${p.focus} (${p.minutes} min)`);
    actions.push({ op: 'create', resource: 'task', data: { title: `TOEIC · ${p.focus}`, category: 'toeic', date: d, time, durationMin: p.minutes, priority: 'high', status: 'todo' }, summary: `${formatFr(d, { weekday: true })} · TOEIC ${p.focus}` });
  }
  const t = await toeicSummary();
  if (!actions.length) return reply('Tes révisions TOEIC des 7 prochains jours sont déjà planifiées ✓');
  return reply(
    `**Programme TOEIC des 7 prochains jours** (objectif ${t.target}${t.current ? `, score actuel ${t.current}` : ''})\n${lines.join('\n')}` +
      (t.weakParts.length ? `\n\nPoint faible actuel : Partie ${t.weakParts[0].part} (${t.weakParts[0].rate} % de réussite) — je te conseille d’y ajouter 10 min.` : '') +
      '\n\nValide pour les ajouter à My Tasks et My Calendar.',
    actions,
  );
};

const sportSlots: Handler = async (_m, n) => {
  if (!/(creneau|creneaux|place|trouve)/.test(n) || !/sport|seance|muscu|salle|entrainement/.test(n)) return null;
  const count = /\b(trois|3)\b/.test(n) ? 3 : /\b(un|une|1)\b/.test(n) && !/deux|2/.test(n) ? 1 : 2;
  const ref = today();
  const actions: AiAction[] = [];
  const lines: string[] = [];
  const tpls = await prisma.workoutTemplate.findMany({ where: { active: true } });
  let i = /demain/.test(n) ? 1 : 0;
  while (actions.length < count && i < 10) {
    const d = addDays(ref, i++);
    const already = await prisma.workoutSession.count({ where: { date: d } });
    if (already) continue;
    const slots = await freeSlots(d, 75, weekdayOf(d) % 6 === 0 ? '09:00' : '07:00', '21:00');
    // prefer evenings on weekdays (after classes / work), late morning on weekends
    const pref = weekdayOf(d) % 6 === 0 ? 600 : 1050;
    const fit = slots.map((s) => ({ s, start: Math.max(timeToMinutes(s.start), pref) })).find((x) => timeToMinutes(x.s.end) - x.start >= 75);
    const slot = fit ? { start: minutesToTime(fit.start) } : slots[0];
    if (!slot) continue;
    const tpl = tpls.find((t) => t.weekday === String(weekdayOf(d))) ?? tpls[actions.length % Math.max(1, tpls.length)];
    const name = tpl?.name ?? 'Séance fessiers';
    lines.push(`• ${formatFr(d, { weekday: true })} à **${slot.start}** — ${name}`);
    actions.push({ op: 'create', resource: 'workoutSession', data: { name, templateId: tpl?.id ?? null, date: d, time: slot.start, status: 'planned', durationMin: 75 }, summary: `${formatFr(d, { weekday: true })} ${slot.start} · ${name}` });
    i++; // avoid consecutive days for recovery
  }
  if (!actions.length) return reply('Je n’ai pas trouvé de créneau libre de 75 min dans les prochains jours. Essaie de libérer une soirée ?');
  return reply(`**${actions.length} créneau${actions.length > 1 ? 'x' : ''} sport trouvé${actions.length > 1 ? 's' : ''}** (en évitant tes cours, ton alternance et tes rendez-vous) :\n${lines.join('\n')}`, actions);
};

const balances: Handler = async (_m, n) => {
  if (!/(combien|solde|argent).*(compte|banque|ai-je|j'ai|dispo)|mes comptes|mes soldes/.test(n) || /econom|gagn/.test(n)) return null;
  const m = await moneySummary();
  if (!m.hasAccounts) return reply('Tu n’as pas encore enregistré de compte bancaire. Va dans **Money › My Banks** pour ajouter BoursoBank, Crédit Agricole, Trade Republic… (aucun mot de passe bancaire n’est jamais demandé).');
  return reply(
    `**Tes comptes**\n${m.accounts.map((a) => `• ${a.name}${a.bank ? ` (${a.bank})` : ''} : **${eur(a.balance, 2)}**`).join('\n')}\n\n` +
      `Disponible (courant) : **${eur(m.available, 2)}** · Épargne : **${eur(m.savingsBalance, 2)}**` +
      (m.investValue ? ` · Investissements (valeur estimée) : **${eur(m.investValue, 2)}**` : '') +
      `\nPatrimoine financier : **${eur(m.netWorth, 2)}**`,
  );
};

const saved: Handler = async (_m, n) => {
  if (!/econom|epargn/.test(n)) return null;
  const m = await moneySummary();
  const lines = [`Ce mois-ci (${m.month}) : revenus **${eur(m.income)}**, dépenses **${eur(m.expense)}**, solde **${eur(m.net)}**.`, `Versements d’épargne enregistrés : **${eur(m.savedThisMonth)}**.`];
  if (m.savingsGoals.length) lines.push('', '**Objectifs d’épargne**', ...m.savingsGoals.map((g) => `• ${g.name} : ${eur(g.saved)} / ${eur(g.target)} (${g.pct} %)${g.monthlyNeeded ? ` — ${eur(g.monthlyNeeded)}/mois nécessaires` : ''}`));
  return reply(lines.join('\n'));
};

const bestActivity: Handler = async (_m, n) => {
  if (!/(activite|quoi|source).*(rapporte|gagne)|rapporte le plus|revenus? par/.test(n)) return null;
  const y = today().slice(0, 4);
  const txs = await prisma.transaction.findMany({ where: { type: 'income', date: { gte: `${y}-01-01` } } });
  const by: Record<string, number> = {};
  for (const t of txs) by[t.category ?? 'autre'] = (by[t.category ?? 'autre'] ?? 0) + (t.amount ?? 0);
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return reply('Aucun revenu enregistré cette année pour le moment.');
  return reply(`**Revenus ${y} par source**\n${rows.map(([c, v], i) => `${i === 0 ? '🏆' : '•'} ${optionLabel(TX_CATEGORIES, c)} : **${eur(v)}**`).join('\n')}`);
};

const financialReview: Handler = async (_m, n) => {
  if (!/bilan financ|bilan (de mes )?finance|bilan argent|point financ|bilan budget/.test(n)) return null;
  const m = await moneySummary();
  const top = Object.entries(m.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const lines = [
    `**Bilan financier — ${m.month}**`,
    `• Revenus : **${eur(m.income)}** · Dépenses : **${eur(m.expense)}** · Solde : **${eur(m.net)}**`,
    `• Disponible : ${eur(m.available)} · Épargne : ${eur(m.savingsBalance)} · Investissements : ${eur(m.investValue)}`,
    `• Solde prévisionnel fin de mois : **${eur(m.forecast)}**${m.budget.hasBudget ? '' : ' (ajoute un budget pour l’affiner)'}`,
  ];
  if (top.length) lines.push('', '**Principaux postes de dépenses**', ...top.map(([c, v]) => `• ${optionLabel(TX_CATEGORIES, c)} : ${eur(v)}`));
  if (m.budget.hasBudget && m.expense > m.budget.plannedOut) lines.push('', `⚠︎ Dépenses au-dessus du budget prévu (${eur(m.budget.plannedOut)}).`);
  if (m.income > 0) lines.push('', `Taux d’épargne du mois : **${Math.round(((m.income - m.expense) / m.income) * 100)} %**`);
  return reply(lines.join('\n'));
};

const lashRevenue: Handler = async (_m, n) => {
  if (!/(cils|lash)/.test(n) || !/gagne|chiffre|ca\b|revenu|rapporte|bilan/.test(n)) return null;
  const l = await lashSummary();
  return reply(
    `**Lash Studio**\n• Aujourd’hui : ${eur(l.today)} · Semaine : ${eur(l.week)} · Mois : **${eur(l.month)}** (${l.monthCount} RDV réalisés)\n• Panier moyen : ${eur(l.avgBasket)} · Clientes : ${l.clientsCount}\n• Consommables estimés : ${eur(l.consumables)} · Achats matériel : ${eur(l.expenses)}\n• Résultat estimé du mois : **${eur(l.estimatedResult)}**\n• Encaissé ce mois : ${eur(l.cashedThisMonth)}${l.unpaid ? ` · ${l.unpaid} RDV réalisé(s) non encaissé(s)` : ''}\n• Total depuis le début : ${eur(l.allTime)}`,
  );
};

const airbnbReview: Handler = async (_m, n) => {
  if (!/airbnb/.test(n) || !/bilan|combien|taux|occup|revenu/.test(n)) return null;
  const a = await airbnbSummary();
  if (!a.listings) return reply('Aucun logement Airbnb enregistré. Ajoute-le dans **Money › Airbnb**.');
  return reply(`**Bilan Airbnb du mois**\n• Réservations : ${a.bookingsMonth} · Nuits : ${a.nights} · Occupation : **${a.occupancy} %**\n• Revenus : **${eur(a.revenue)}** · Frais : ${eur(a.fees)} · Charges : ${eur(a.costs)}\n• Résultat estimé : **${eur(a.result)}** · Prix moyen/nuit : ${eur(a.avgNight)}${a.upcoming.length ? `\n\n**Prochaines arrivées**\n${a.upcoming.map((b) => `• ${b.guest} — ${formatFr(b.checkIn, { weekday: true })}`).join('\n')}` : ''}`);
};

const wishlistQ: Handler = async (_m, n) => {
  if (!/wishlist|envies|achats/.test(n) || /ajoute/.test(n)) return null;
  const items = await prisma.wishlistItem.findMany({ where: { status: { notIn: ['purchased', 'archived'] } } });
  if (/budget|correspond|peux.*(acheter|m'offrir)/.test(n)) {
    const m = await moneySummary();
    const reserve = m.budget.plannedSavings || 0;
    const room = round2(Math.max(0, m.income - m.expense - reserve));
    const fit = items.filter((i) => (i.price ?? 0) > 0 && (i.price ?? 0) <= room).sort((a, b) => (PRIO_RANK[a.priority ?? 'medium'] ?? 2) - (PRIO_RANK[b.priority ?? 'medium'] ?? 2));
    return reply(`Marge du mois après dépenses${reserve ? ' et épargne prévue' : ''} : **${eur(room)}**.\n${fit.length ? `**Compatibles avec ton budget :**\n${fit.map((i) => `• ${i.name}${i.brand ? ` (${i.brand})` : ''} — ${eur(i.price, 2)}`).join('\n')}` : 'Aucun produit de ta wishlist ne rentre dans ta marge actuelle — patience ♡'}`);
  }
  const beauty = /beaute|beauty|maquillage|skincare|parfum|cheveux/.test(n);
  const list = beauty ? items.filter((i) => ['beauty', 'skincare', 'haircare', 'perfume'].includes(i.category ?? '')) : items;
  const total = round2(list.reduce((s, i) => s + (i.price ?? 0), 0));
  if (!list.length) return reply(beauty ? 'Aucun produit beauté dans ta wishlist pour l’instant.' : 'Ta wishlist est vide.');
  return reply(`**${beauty ? 'Produits beauté' : 'Wishlist'} — ${list.length} produit${list.length > 1 ? 's' : ''} · ${eur(total, 2)}**\n${list.slice(0, 15).map((i) => `• ${i.name}${i.brand ? ` (${i.brand})` : ''} — ${i.price ? eur(i.price, 2) : 'prix ?'} · ${optionLabel(WISHLIST_CATEGORIES, i.category)}`).join('\n')}`);
};

const tripChecklist: Handler = async (_m, n) => {
  if (!/checklist|valise|liste/.test(n) || !/voyage|vacances|valise|depart/.test(n)) return null;
  const trips = await prisma.trip.findMany({ where: { status: { not: 'done' } }, orderBy: { start: 'asc' } });
  const trip = trips.find((t) => !t.start || t.start >= today()) ?? trips[0];
  if (!trip) return reply('Aucun voyage enregistré. Crée-le dans **Lifestyle › Travel Planner**, puis redemande-moi la checklist ✈︎', [{ op: 'create', resource: 'trip', data: { destination: 'Nouveau voyage', status: 'idea' }, summary: 'Créer un voyage' }]);
  const base = ['Passeport / carte d’identité', 'Billets & cartes d’embarquement', 'Réservation hébergement', 'Assurance voyage', 'Carte bancaire + un peu d’espèces', 'Chargeurs & adaptateur', 'Trousse skincare (format voyage)', 'Trousse maquillage', 'Médicaments & ordonnances', 'Tenues jour / soir', 'Maillot de bain', 'Tenue de sport', 'Pyjama', 'Lunettes de soleil & SPF', 'Écouteurs', 'Copie des documents (Document Vault)'];
  const existing = ((trip.checklist && JSON.parse(trip.checklist)) as { title: string }[]) ?? [];
  const merged = [...existing, ...base.filter((b) => !existing.some((e) => e.title === b)).map((title, i) => ({ id: `c${Date.now()}${i}`, title, done: false }))];
  return reply(`Voici une checklist pour **${trip.destination}**${trip.start ? ` (${formatFr(trip.start)})` : ''} :\n${base.map((b) => `☐ ${b}`).join('\n')}`, [{ op: 'update', resource: 'trip', id: trip.id, data: { checklist: merged }, summary: `Ajouter ${base.length} éléments à la checklist « ${trip.destination} »` }]);
};

const memoryIntent: Handler = async (m, n) => {
  const match = m.match(/^(?:souviens[- ]toi|rappelle[- ]toi|retiens|n'oublie pas|mémorise|memorise)\s+(?:que|de|bien)?\s*:?\s*(.+)$/i);
  if (!match) return null;
  const content = match[1].trim().replace(/^./, (c) => c.toUpperCase());
  const category = /objectif|veux|vise/.test(n) ? 'goal' : /projet/.test(n) ? 'project' : /decid|choisi/.test(n) ? 'decision' : /habitude|chaque|tous les/.test(n) ? 'habit' : 'preference';
  return reply('Je peux mémoriser cette information (stockée uniquement en local, modifiable dans Settings › Data & Privacy) :', [{ op: 'create', resource: 'memory', data: { content, category }, summary: content }]);
};

const weeklyReview: Handler = async (_m, n) => {
  if (!/bilan.*(semaine|hebdo)|ma semaine|resume de la semaine/.test(n)) return null;
  const wk = startOfWeek(today());
  const end = addDays(wk, 6);
  const done = await prisma.task.count({ where: { status: 'done', completedAt: { gte: new Date(wk).toISOString() } } });
  const f = await fitnessSummary();
  const t = await prisma.toeicAttempt.findMany({ where: { date: { gte: wk, lte: end } } });
  const txs = await prisma.transaction.findMany({ where: { date: { gte: wk, lte: end } } });
  const inc = txs.filter((x) => x.type === 'income').reduce((s, x) => s + (x.amount ?? 0), 0);
  const exp = txs.filter((x) => x.type === 'expense').reduce((s, x) => s + (x.amount ?? 0), 0);
  const g = await goalsSummary();
  return reply(`**Ta semaine (depuis le ${formatFr(wk)})**\n• Tâches terminées : ${done}\n• Sport : ${f.weekDone}/${f.weekGoal} séances\n• TOEIC : ${t.length} entraînement(s), ${Math.round(t.reduce((s, a) => s + (a.durationSec ?? 0), 0) / 60)} min\n• Revenus : ${eur(inc)} · Dépenses : ${eur(exp)}\n• Objectifs actifs : ${g.active} (progression moyenne ${g.avg} %)\n\nRetrouve le bilan complet et tes 3 priorités dans **Organization › Monthly Review**.`);
};

const instagramIdeas: Handler = async (_m, n) => {
  if (!/(publication|post|contenu|reel|story|instagram|insta)/.test(n) || !/prepare|idee|propose|planifi|organis|redige|ecri/.test(n)) return null;
  const ref = today();
  const ideas = [
    { format: 'before_after', theme: 'Avant / après — pose volume russe', description: 'Le regard qui change tout ✨ Avant / après d’une pose volume russe, sur-mesure selon la forme de l’œil. Réservations en DM 💌' },
    { format: 'reel', theme: 'Coulisses : préparation d’une pose', description: 'Hygiène, précision et patience : voici les coulisses d’une pose 🤍 Quelle étape te surprend le plus ?' },
    { format: 'availability', theme: 'Disponibilités de la semaine', description: 'Les créneaux de la semaine sont ouverts 🗓️ Écris-moi en DM pour réserver ta pose ou ton remplissage.' },
    { format: 'carousel', theme: 'Conseils d’entretien des extensions', description: '5 gestes pour faire durer tes extensions plus longtemps 👇 Enregistre ce post pour t’en souvenir !' },
    { format: 'story', theme: 'Sondage : classique, hybride ou volume ?', description: 'Sondage en story : quel style te ressemble le plus ?' },
  ];
  const actions: AiAction[] = ideas.slice(0, 4).map((idea, i) => {
    const date = addDays(ref, 1 + i * 2);
    return { op: 'create', resource: 'contentPost', data: { account: 'lash', network: 'instagram', date, time: '18:30', status: 'draft', hashtags: '#extensionsdecils #lashartist #volumerusse #cilsparis', ...idea }, summary: `${formatFr(date, { weekday: true })} · ${idea.theme}` };
  });
  return { reply: `Voici un plan éditorial pour ta semaine Instagram (brouillons — rien n’est publié automatiquement) :\n${actions.map((a) => `• ${a.summary}`).join('\n')}`, actions, engine: 'local', creative: true };
};

const capture: Handler = async (m, n) => {
  if (!/^(ajoute|ajouter|cree|creer|programme|planifie|note|enregistre|mets|rajoute|j'ai depense|j'ai paye|j'ai achete|j'ai recu|depense|rdv|rendez-vous|rappelle-moi)/.test(n)) return null;
  const cleaned = m.replace(/^(ajoute|ajouter|crée|créer|cree|programme|planifie|enregistre|mets|rajoute)\s+(moi\s+)?/i, '');
  const p = parseCapture(/wishlist/i.test(m) ? m : cleaned);
  return reply(`Voici ce que je propose d’enregistrer :`, [{ op: 'create', resource: p.resource, data: p.data, summary: p.summary, hints: p.hints }]);
};

const HANDLERS: Handler[] = [memoryIntent, organizeWeek, organizeDay, toeicPlanIntent, sportSlots, priorities, homework, financialReview, lashRevenue, airbnbReview, balances, saved, bestActivity, wishlistQ, tripChecklist, weeklyReview, instagramIdeas, capture];

export async function localAnswer(message: string): Promise<AiReply | null> {
  const n = normalize(message.trim());
  for (const h of HANDLERS) {
    const r = await h(message.trim(), n);
    if (r) return r;
  }
  return null;
}

export const LOCAL_HELP = `Je fonctionne en **mode local** (sans modèle d’IA) : je comprends les demandes courantes et je calcule tout à partir de tes vraies données.

Essaie par exemple :
• « Quelles sont mes priorités ? » · « Organise-moi ma journée » · « Organise ma semaine »
• « Quels devoirs dois-je rendre ? » · « Programme mes révisions TOEIC »
• « Trouve-moi deux créneaux pour le sport »
• « Combien ai-je sur mes comptes ? » · « Fais-moi mon bilan financier »
• « Combien ai-je gagné avec les cils ? » · « Fais-moi un bilan Airbnb »
• « Ajoute un rendez-vous cliente vendredi 14h avec Sarah »
• « Ajoute ce parfum à ma wishlist : Libre YSL 120 € »
• « Crée une checklist pour mon voyage » · « Souviens-toi que… »

Pour des conversations libres (conseils, rédaction, idées), installe **Ollama** et un modèle local — voir Settings › Integrations.`;

export { startOfMonth, endOfMonth };
