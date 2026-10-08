import { describe, expect, it } from 'vitest';
import { parseCapture, extractDateTime } from '../shared/parser';
import { accountBalance, flowTotals, loanPayment, propertyMetrics, monthlyNeeded, simulateInvestment } from '../shared/finance';
import { addDays, expandRecurrence, nextOccurrence, startOfWeek, isoWeek, addMonths } from '../shared/dates';

const REF = '2026-10-08'; // a Thursday

describe('dates', () => {
  it('computes week starts (Monday) and ISO weeks', () => {
    expect(startOfWeek(REF)).toBe('2026-10-05');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
  });
  it('clamps month additions to the last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
  it('expands recurrences inside a range', () => {
    expect(expandRecurrence('2026-10-01', 'weekly', '2026-10-01', '2026-10-31')).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
    expect(expandRecurrence('2026-10-09', 'weekdays', '2026-10-09', '2026-10-13')).toEqual(['2026-10-09', '2026-10-12', '2026-10-13']);
    expect(nextOccurrence('2026-10-09', 'weekdays')).toBe('2026-10-12');
  });
});

describe('quick capture parser (French)', () => {
  it('parses relative dates and times', () => {
    expect(extractDateTime('demain à 14h', REF)).toMatchObject({ date: '2026-10-09', time: '14:00' });
    expect(extractDateTime('vendredi 18h30', REF)).toMatchObject({ date: '2026-10-09', time: '18:30' });
    expect(extractDateTime('hier', REF).date).toBe('2026-10-07');
    expect(extractDateTime('le 15/11', REF).date).toBe('2026-11-15');
    expect(extractDateTime('le 3 janvier', REF).date).toBe('2027-01-03');
    expect(extractDateTime('dans 3 jours', REF).date).toBe('2026-10-11');
  });
  it('detects expenses with amount and category', () => {
    const p = parseCapture('Courses Monoprix 32,40 € hier', REF);
    expect(p.resource).toBe('transaction');
    expect(p.data).toMatchObject({ type: 'expense', amount: 32.4, date: '2026-10-07', category: 'courses' });
  });
  it('detects income', () => {
    expect(parseCapture('J’ai reçu 80€ pour une pose de cils', REF).data).toMatchObject({ type: 'income', amount: 80, category: 'cils' });
  });
  it('detects lash appointments with client & service', () => {
    const p = parseCapture('RDV cils vendredi 14h avec Sarah, remplissage', REF);
    expect(p.resource).toBe('lashAppointment');
    expect(p.data.start).toBe('2026-10-09T14:00');
    expect(p.hints).toMatchObject({ clientName: 'Sarah', serviceName: 'Remplissage' });
  });
  it('detects events, wishlist, water, homework, ideas and tasks', () => {
    expect(parseCapture('Coiffeur samedi à 11h', REF)).toMatchObject({ resource: 'event', data: { start: '2026-10-10T11:00', category: 'beaute' } });
    expect(parseCapture('Ajoute ce parfum à ma wishlist : Libre YSL 120 €', REF)).toMatchObject({ resource: 'wishlistItem', data: { name: 'Libre YSL', price: 120, category: 'perfume' } });
    expect(parseCapture('bu 500ml', REF)).toMatchObject({ resource: 'waterLog', data: { ml: 500 } });
    expect(parseCapture('Rendre le dossier de stratégie digitale le 15/11', REF)).toMatchObject({ resource: 'homework', data: { dueDate: '2026-11-15' } });
    expect(parseCapture('Idée business : box beauté pour étudiantes', REF).resource).toBe('businessIdea');
    expect(parseCapture('Envoyer le CV à la pharmacie', REF)).toMatchObject({ resource: 'task', data: { category: 'alternance' } });
  });
});

describe('finance', () => {
  const txs = [
    { type: 'income', amount: 1000, accountId: 1, date: '2026-10-01' },
    { type: 'expense', amount: 200, accountId: 1, date: '2026-10-02' },
    { type: 'transfer', amount: 300, accountId: 1, toAccountId: 2, date: '2026-10-03' },
    { type: 'withdrawal', amount: 50, accountId: 1, date: '2026-10-04' },
  ];
  it('computes balances with internal transfers', () => {
    expect(accountBalance({ id: 1, initialBalance: 100 }, txs)).toBe(550);
    expect(accountBalance({ id: 2, initialBalance: 0 }, txs)).toBe(300);
  });
  it('never counts transfers or withdrawals as income/expense', () => {
    expect(flowTotals(txs)).toEqual({ income: 1000, expense: 200, net: 800 });
  });
  it('computes loan payments and property metrics', () => {
    expect(loanPayment(100000, 3.6, 25)).toBeCloseTo(506.01, 1);
    expect(loanPayment(1200, 0, 1)).toBe(100);
    const m = propertyMetrics({ price: 100000, fees: 8000, works: 2000, downPayment: 10000, rate: 3, durationYears: 20, rent: 600, charges: 50, propertyTax: 600, insurance: 15 });
    expect(m.totalCost).toBe(110000);
    expect(m.grossYield).toBeCloseTo(6.55, 1);
    expect(m.loan).toBe(100000);
  });
  it('computes savings plans and simulations', () => {
    expect(monthlyNeeded(1200, 0, '2026-10-08', '2027-10-01')).toBe(100);
    const s = simulateInvestment(0, 100, 1, 0);
    expect(s[1]).toMatchObject({ year: 1, value: 1200, invested: 1200 });
  });
});

describe('addDays', () => {
  it('crosses month boundaries', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'));
});
