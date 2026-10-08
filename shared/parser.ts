/**
 * Quick Capture — a deterministic French natural-language parser.
 * Works fully offline (no AI needed). Jadou AI can refine the result when Ollama is available.
 */
import { addDays, today as todayFn, weekdayOf, toISODate, parseDate } from './dates';
import type { ResourceName } from './registry';

export interface CaptureProposal {
  resource: ResourceName;
  data: Record<string, unknown>;
  summary: string;
  /** extra hint for the UI (e.g. client name to match) */
  hints?: Record<string, string>;
}

const DAYS: Record<string, number> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, février: 2, fevrier: 2, févr: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6,
  juillet: 7, juil: 7, août: 8, aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, décembre: 12, decembre: 12, déc: 12,
};

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'");
}

interface Extracted {
  date?: string;
  time?: string;
  amount?: number;
  rest: string;
}

export function extractDateTime(input: string, ref = todayFn()): Extracted {
  let rest = ` ${input} `;
  let date: string | undefined;
  let time: string | undefined;
  let amount: number | undefined;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) {
      fn(m);
      rest = rest.replace(m[0], ' ');
    }
  };

  // amount: 12€, 12,50 €, 12 euros, €12
  take(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)\s?(?:€|euros?\b|eur\b)/i, (m) => (amount = parseFloat(m[1].replace(',', '.'))));
  if (amount === undefined) take(/€\s?(\d+(?:[.,]\d{1,2})?)/, (m) => (amount = parseFloat(m[1].replace(',', '.'))));

  // time: à 14h, 14h30, 14:30, 9h
  take(/(?:\sa\s|\sà\s|\svers\s|\s)(\d{1,2})\s?(?:h|:)\s?(\d{2})?(?=\s|$|[,.])/i, (m) => {
    const h = Number(m[1]);
    if (h <= 23) time = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  });
  const n = normalize(rest);
  if (!time) {
    if (/\bce soir\b/.test(n)) time = '19:00';
    else if (/\bce matin\b/.test(n)) time = '09:00';
    else if (/\bcet apres-midi\b|\bcet aprem\b/.test(n)) time = '14:00';
  }

  // relative days
  const rel: [RegExp, number][] = [
    [/\bapres[- ]demain\b/, 2],
    [/\bavant[- ]hier\b/, -2],
    [/\bhier\b/, -1],
    [/\bdemain\b/, 1],
    [/\baujourd'hui\b|\bce soir\b|\bce matin\b|\bcet apres-midi\b/, 0],
  ];
  for (const [re, off] of rel) {
    const nn = normalize(rest);
    const m = nn.match(re);
    if (m && !date) {
      date = addDays(ref, off);
      rest = removeNormalized(rest, m[0]);
    }
  }

  // dans N jours / semaines
  if (!date) {
    const m = normalize(rest).match(/\bdans (\d+) (jours?|semaines?)\b/);
    if (m) {
      const k = Number(m[1]) * (m[2].startsWith('semaine') ? 7 : 1);
      date = addDays(ref, k);
      rest = removeNormalized(rest, m[0]);
    }
  }
  if (!date) {
    const m = normalize(rest).match(/\b(la )?semaine prochaine\b/);
    if (m) {
      const wd = weekdayOf(ref);
      date = addDays(ref, ((8 - wd) % 7) || 7);
      rest = removeNormalized(rest, m[0]);
    }
  }

  // weekday names: "vendredi", "lundi prochain"
  if (!date) {
    const m = normalize(rest).match(/\b(ce |le )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain)?\b/);
    if (m) {
      const target = DAYS[m[2]];
      const cur = weekdayOf(ref);
      let delta = (target - cur + 7) % 7;
      if (delta === 0) delta = m[3] ? 7 : 0;
      date = addDays(ref, delta);
      rest = removeNormalized(rest, m[0]);
    }
  }

  // explicit dates: 12/10, 12/10/2026, le 12 octobre, 12 oct
  if (!date) {
    const m = rest.match(/(?:le\s)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
    if (m) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : guessYear(ref, Number(m[2]), Number(m[1]));
      date = toISODate(new Date(y, Number(m[2]) - 1, Number(m[1])));
      rest = rest.replace(m[0], ' ');
    }
  }
  if (!date) {
    const m = normalize(rest).match(/\b(?:le )?(\d{1,2}) (janvier|janv|fevrier|fevr|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\b\.?( \d{4})?/);
    if (m) {
      const mo = MONTHS[m[2]] ?? MONTHS[m[2] + '.'];
      const y = m[3] ? Number(m[3]) : guessYear(ref, mo, Number(m[1]));
      date = toISODate(new Date(y, mo - 1, Number(m[1])));
      rest = removeNormalized(rest, m[0]);
    }
  }
  if (!date) {
    const m = normalize(rest).match(/\ble (\d{1,2})(er)?\b(?! ?(h|€|euros|ml))/);
    if (m) {
      const d = Number(m[1]);
      const r = parseDate(ref);
      let cand = new Date(r.getFullYear(), r.getMonth(), d);
      if (toISODate(cand) < ref) cand = new Date(r.getFullYear(), r.getMonth() + 1, d);
      date = toISODate(cand);
      rest = removeNormalized(rest, m[0]);
    }
  }
  if (time && !date) date = ref;

  return { date, time, amount, rest: rest.replace(/\s+/g, ' ').trim() };
}

function guessYear(ref: string, month: number, day: number): number {
  const r = parseDate(ref);
  const cand = toISODate(new Date(r.getFullYear(), month - 1, day));
  return cand < addDays(ref, -60) ? r.getFullYear() + 1 : r.getFullYear();
}

/** Remove a normalized substring from the original string (same length mapping, accents stripped). */
function removeNormalized(original: string, normPiece: string): string {
  const norm = normalize(original);
  const idx = norm.indexOf(normPiece);
  if (idx === -1) return original;
  return original.slice(0, idx) + ' ' + original.slice(idx + normPiece.length);
}

function cleanTitle(s: string, words: RegExp[]): string {
  let out = s;
  for (const w of words) out = out.replace(w, ' ');
  out = out.replace(/\s+/g, ' ').replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, '').trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

export function detectCategory(text: string): string {
  const n = normalize(text);
  if (/toeic|listening|reading|vocab/.test(n)) return 'toeic';
  if (/\bcils?\b|pose|remplissage|depose|lash|cliente/.test(n)) return 'cils';
  if (/sport|muscu|seance|salle|hip thrust|squat|fessiers|cardio|workout/.test(n)) return 'sport';
  if (/devoir|dossier|expose|rendu|memoire|partiel|examen/.test(n)) return 'devoirs';
  if (/\bcours\b|inseec|master|amphi|td\b/.test(n)) return 'cours';
  if (/pharmacie|alternance|varenne|campagne|tiktok/.test(n)) return 'alternance';
  if (/airbnb|voyageur|menage|check-?in/.test(n)) return 'airbnb';
  if (/banque|impot|facture|loyer|budget|epargne|virement|assurance/.test(n)) return 'finance';
  if (/coiffeur|ongles|onglerie|estheticienne|skincare|soin/.test(n)) return 'beaute';
  if (/medecin|dentiste|docteur|kine|gyneco|dermato/.test(n)) return 'sante';
  if (/voyage|vol\b|hotel|valise|billet/.test(n)) return 'voyage';
  if (/business|entreprise|projet|instagram/.test(n)) return 'business';
  return 'perso';
}

export function detectTxCategory(text: string): string {
  const n = normalize(text);
  const map: [RegExp, string][] = [
    [/resto|restaurant|uber ?eats|deliveroo|cafe|starbucks|brunch/, 'restaurants'],
    [/courses|supermarche|carrefour|monoprix|lidl|franprix|auchan|leclerc/, 'courses'],
    [/uber|metro|navigo|train|sncf|essence|taxi|bolt/, 'transport'],
    [/loyer|electricite|edf|internet|box/, 'logement'],
    [/netflix|spotify|abonnement|deezer|icloud|disney/, 'abonnements'],
    [/zara|vetement|shopping|robe|chaussures|sac/, 'shopping'],
    [/coiffeur|sephora|skincare|maquillage|ongles|parfum|beaute/, 'beaute'],
    [/salle|basic fit|fitness|sport|proteine/, 'sport'],
    [/pharmacie|medecin|mutuelle|sante/, 'sante'],
    [/livre|ecole|inseec|toeic|formation/, 'etudes'],
    [/cinema|sortie|bar|concert|loisir/, 'loisirs'],
    [/vol|hotel|voyage|airbnb/, 'voyages'],
    [/cadeau/, 'cadeaux'],
    [/colle|cils|patchs|pinces|materiel/, 'materiel_cils'],
  ];
  for (const [re, cat] of map) if (re.test(n)) return cat;
  return 'autre';
}

export function detectWishCategory(text: string): string {
  const n = normalize(text);
  if (/parfum|eau de/.test(n)) return 'perfume';
  if (/shampo|masque cheveux|huile cheveux|dyson|lisseur|boucleur|cheveux/.test(n)) return 'haircare';
  if (/serum|creme|spf|nettoyant|skincare|toner/.test(n)) return 'skincare';
  if (/rouge a levres|mascara|fond de teint|palette|blush|gloss|maquillage/.test(n)) return 'beauty';
  if (/robe|sac|chaussures|jean|manteau|veste|top|pull|bottes|baskets/.test(n)) return 'fashion';
  if (/iphone|ipad|macbook|airpods|ecouteurs|ordinateur|ecran|camera|tech/.test(n)) return 'tech';
  if (/bougie|deco|canape|plaid|vase|maison/.test(n)) return 'home';
  if (/valise|voyage/.test(n)) return 'travel';
  if (/dior|chanel|louis vuitton|hermes|cartier|prada|ysl|celine|luxe/.test(n)) return 'luxury';
  return 'other';
}

export function parseCapture(input: string, ref = todayFn()): CaptureProposal {
  const raw = input.trim();
  const n = normalize(raw);
  const url = raw.match(/https?:\/\/\S+/)?.[0];
  const ex = extractDateTime(url ? raw.replace(url, ' ') : raw, ref);
  const rest = ex.rest;

  // --- water
  const water = n.match(/(\d{2,4})\s?ml\b/);
  if (water && /eau|bu|boire|hydrat|ml/.test(n) && !ex.amount) {
    return {
      resource: 'waterLog',
      data: { date: ex.date ?? ref, ml: Number(water[1]), time: ex.time ?? currentTime() },
      summary: `Hydratation +${water[1]} ml`,
    };
  }

  // --- wishlist
  if (/wishlist|liste d'envies|envie de m'acheter|j'ai envie d/.test(n)) {
    const afterColon = rest.includes(':') ? rest.slice(rest.indexOf(':') + 1) : rest;
    const name = cleanTitle(afterColon, [/ajout(e|er)?/gi, /(a|à|dans) ma wishlist/gi, /wishlist/gi, /j[’']ai envie d(e|')\s?(m[’']acheter)?/gi, /\bce(tte)?\b/gi, /\bmon\b|\bma\b/gi, /^(le|la|les|un|une)\s/gi]);
    return {
      resource: 'wishlistItem',
      data: { name: name || 'Nouveau produit', category: detectWishCategory(raw), price: ex.amount ?? null, link: url ?? null, status: 'want', priority: 'medium' },
      summary: `Wishlist · ${name || 'Nouveau produit'}${ex.amount ? ` · ${ex.amount} €` : ''}`,
    };
  }

  // --- lash appointment
  if (/(rdv|rendez-vous|rendez vous).*(cils|cliente|pose|remplissage|depose|volume|hybride)|(cliente|pose|remplissage|depose).*(rdv|rendez-vous|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}h)/.test(n)) {
    const client = raw.match(/(?:avec|pour|cliente)\s+([A-ZÀ-Ý][\p{L}-]+(?:\s[A-ZÀ-Ý][\p{L}-]+)?)/u)?.[1];
    let service = '';
    if (/remplissage/.test(n)) service = 'Remplissage';
    else if (/volume/.test(n)) service = 'Volume russe';
    else if (/hybride/.test(n)) service = 'Pose hybride';
    else if (/depose/.test(n)) service = 'Dépose';
    else if (/classique|pose/.test(n)) service = 'Pose classique';
    const date = ex.date ?? ref;
    return {
      resource: 'lashAppointment',
      data: { start: `${date}T${ex.time ?? '10:00'}`, price: ex.amount ?? null, status: 'booked', paymentStatus: 'unpaid', durationMin: 120 },
      summary: `RDV cils${client ? ` · ${client}` : ''}${service ? ` · ${service}` : ''} · ${date}${ex.time ? ` ${ex.time}` : ''}`,
      hints: { clientName: client ?? '', serviceName: service },
    };
  }

  // --- money
  if (ex.amount !== undefined) {
    const isIncome = /recu|gagne|encaisse|salaire|vire sur|rembourse|paye par|prime|vente/.test(n) && !/paye\s|j'ai paye/.test(n);
    const label = cleanTitle(rest, [/j'ai (depense|paye|achete|recu|gagne)/gi, /\b(depense|dépense|paiement|achat|revenu)s?\b/gi, /^(pour|de|en)\s/gi]);
    return {
      resource: 'transaction',
      data: {
        type: isIncome ? 'income' : 'expense',
        amount: ex.amount,
        date: ex.date ?? ref,
        label: label || (isIncome ? 'Revenu' : 'Dépense'),
        category: isIncome ? (/cils|cliente/.test(n) ? 'cils' : /salaire|alternance/.test(n) ? 'salaire' : 'autre') : detectTxCategory(raw),
      },
      summary: `${isIncome ? 'Revenu' : 'Dépense'} · ${label || ''} · ${ex.amount} €`,
    };
  }

  // --- workout
  if (/\b(seance|muscu|workout|entrainement sport|salle de sport|leg day|lower body)\b/.test(n)) {
    const name = cleanTitle(rest, [/\b(ajoute|planifie|programme)\b/gi, /\bune?\b/gi]);
    return {
      resource: 'workoutSession',
      data: { name: name || 'Séance', date: ex.date ?? ref, time: ex.time ?? null, status: 'planned' },
      summary: `Séance · ${name || 'Séance'} · ${ex.date ?? ref}`,
    };
  }

  // --- homework
  if (/\b(devoir|dossier a rendre|expose|a rendre|rendu)\b/.test(n)) {
    const title = cleanTitle(rest, [/\b(ajoute|un|une|le|la)\b/gi, /\bdevoirs?\b/gi, /a rendre/gi, /pour\s*$/gi]);
    return {
      resource: 'homework',
      data: { title: title || 'Devoir', dueDate: ex.date ?? addDays(ref, 7), dueTime: ex.time ?? null, priority: 'high', status: 'todo' },
      summary: `Devoir · ${title || 'Devoir'} · pour le ${ex.date ?? addDays(ref, 7)}`,
    };
  }

  // --- appointment / event
  if (/\b(rdv|rendez-vous|rendez vous|reunion|coiffeur|medecin|dentiste|diner|dejeuner avec|anniversaire|soiree|cours de)\b/.test(n) || (ex.time && !/\b(faire|appeler|envoyer|preparer|reviser|finir|terminer)\b/.test(n))) {
    const title = cleanTitle(rest, [/\b(ajoute|programme|planifie)\b/gi, /\bmon\b|\bma\b|\bun\b|\bune\b/gi]);
    const date = ex.date ?? ref;
    return {
      resource: 'event',
      data: { title: title || 'Rendez-vous', start: `${date}T${ex.time ?? '09:00'}`, allDay: !ex.time, category: detectCategory(raw), recurrence: 'none' },
      summary: `Rendez-vous · ${title || 'Rendez-vous'} · ${date}${ex.time ? ` à ${ex.time}` : ''}`,
    };
  }

  // --- goal
  if (/\bobjectif\b/.test(n)) {
    const title = cleanTitle(rest, [/\b(nouvel |mon )?objectif( :)?\b/gi]);
    return { resource: 'goal', data: { title: title || 'Nouvel objectif', targetDate: ex.date ?? null, horizon: 'monthly', status: 'active', category: 'personal' }, summary: `Objectif · ${title}` };
  }

  // --- idea
  if (/\bidee\b/.test(n)) {
    const title = cleanTitle(rest, [/\b(une |nouvelle )?id[ée]e( de| :|:)?\b/gi, /^business\s/gi]);
    if (/business|entreprise|lancer|marque|boutique|service|application|concept/.test(n)) {
      return { resource: 'businessIdea', data: { name: title || 'Nouvelle idée', stage: 'idea' }, summary: `Idée business · ${title}` };
    }
    return { resource: 'note', data: { content: title || raw, kind: 'idea' }, summary: `Idée · ${title}` };
  }

  // --- resource (link)
  if (url) {
    const title = cleanTitle(rest, [/\b(ressource|lien|sauvegarde|enregistre)\b/gi]) || url.replace(/^https?:\/\//, '').slice(0, 60);
    return { resource: 'resource', data: { title, url, type: /youtube|vimeo/.test(url) ? 'video' : /\.pdf/.test(url) ? 'pdf' : 'link', folder: 'general' }, summary: `Ressource · ${title}` };
  }

  // --- note
  if (/^note\b|^noter\b|^a retenir\b/.test(n)) {
    return { resource: 'note', data: { content: cleanTitle(raw, [/^note\s*:?/i, /^noter\s*:?/i, /^à retenir\s*:?/i]), kind: 'note' }, summary: 'Note rapide' };
  }

  // --- default: task
  const title = cleanTitle(rest, [/^(ajoute|ajouter|tache|tâche|todo|a faire|à faire|penser a|penser à|il faut)\s*:?\s*/gi]);
  const urgent = /urgent|asap|important/.test(n);
  return {
    resource: 'task',
    data: { title: title || raw, date: ex.date ?? ref, time: ex.time ?? null, category: detectCategory(raw), priority: urgent ? 'high' : 'medium', status: 'todo' },
    summary: `Tâche · ${title || raw}${ex.date ? ` · ${ex.date}` : ''}`,
  };
}

function currentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
