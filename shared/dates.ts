// Local-time date helpers. All dates are stored as "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm".

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toISODateTime(d: Date): string {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function parseDate(s: string): Date {
  // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" → local Date
  const [datePart, timePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh || 0, mm || 0);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMinutes(dt: string, n: number): string {
  const d = parseDate(dt);
  d.setMinutes(d.getMinutes() + n);
  return toISODateTime(d);
}

export function diffDays(a: string, b: string): number {
  // a - b in whole days
  const da = parseDate(a.slice(0, 10));
  const db = parseDate(b.slice(0, 10));
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

/** Monday-based week start */
export function startOfWeek(s: string): string {
  const d = parseDate(s);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

export function startOfMonth(s: string): string {
  return s.slice(0, 7) + '-01';
}

export function endOfMonth(s: string): string {
  const d = parseDate(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISODate(d);
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

export function addMonths(s: string, n: number): string {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

export function isoWeek(s: string): string {
  const d = parseDate(s);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${pad(week)}`;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 1000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function weekdayOf(s: string): number {
  return parseDate(s).getDay();
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/**
 * Expand a recurring item into occurrence dates between [from, to].
 * `start` is the first occurrence date (YYYY-MM-DD).
 */
export function expandRecurrence(
  start: string,
  recurrence: string | null | undefined,
  from: string,
  to: string,
  until?: string | null,
): string[] {
  const first = start.slice(0, 10);
  if (!recurrence || recurrence === 'none') return first >= from && first <= to ? [first] : [];
  const end = until && until < to ? until : to;
  const out: string[] = [];
  let i = 0;
  let cur = first;
  while (cur <= end && i < 2000) {
    const ok = recurrence !== 'weekdays' || (weekdayOf(cur) !== 0 && weekdayOf(cur) !== 6);
    if (cur >= from && ok) out.push(cur);
    i++;
    if (recurrence === 'daily' || recurrence === 'weekdays') cur = addDays(first, i);
    else if (recurrence === 'weekly') cur = addDays(first, i * 7);
    else if (recurrence === 'monthly') cur = addMonths(first, i);
    else break;
  }
  return out;
}

export function nextOccurrence(date: string, recurrence: string): string | null {
  switch (recurrence) {
    case 'daily':
      return addDays(date, 1);
    case 'weekdays': {
      let d = addDays(date, 1);
      while (weekdayOf(d) === 0 || weekdayOf(d) === 6) d = addDays(d, 1);
      return d;
    }
    case 'weekly':
      return addDays(date, 7);
    case 'monthly':
      return addMonths(date, 1);
    default:
      return null;
  }
}

const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function formatFr(s: string | null | undefined, opts: { weekday?: boolean; year?: boolean; time?: boolean } = {}): string {
  if (!s) return '';
  const d = parseDate(s);
  let out = `${d.getDate()} ${FR_MONTHS[d.getMonth()]}`;
  if (opts.weekday) out = `${FR_DAYS[d.getDay()]} ${out}`;
  if (opts.year) out += ` ${d.getFullYear()}`;
  if (opts.time && s.includes('T')) out += ` · ${s.slice(11, 16)}`;
  return out;
}

export function relativeDay(s: string, ref = today()): string {
  const n = diffDays(s, ref);
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 1 && n < 7) return `dans ${n} jours`;
  if (n < -1 && n > -7) return `il y a ${-n} jours`;
  return formatFr(s);
}

export { FR_DAYS, FR_MONTHS };
