// Pure finance helpers shared by API, assistant and UI.

export interface TxLike {
  type: string | null;
  amount: number;
  accountId: number;
  toAccountId?: number | null;
  date: string;
  category?: string | null;
}

export interface AccountLike {
  id: number;
  initialBalance?: number | null;
  initialDate?: string | null;
}

/** Signed effect of a transaction on a given account. */
export function txEffect(tx: TxLike, accountId: number): number {
  const amt = Math.abs(tx.amount || 0);
  if (tx.type === 'transfer') {
    if (tx.accountId === accountId) return -amt;
    if (tx.toAccountId === accountId) return amt;
    return 0;
  }
  if (tx.accountId !== accountId) return 0;
  if (tx.type === 'income' || tx.type === 'deposit') return amt;
  if (tx.type === 'expense' || tx.type === 'withdrawal') return -amt;
  return 0;
}

export function accountBalance(acc: AccountLike, txs: TxLike[], upTo?: string): number {
  let bal = acc.initialBalance || 0;
  for (const tx of txs) {
    if (upTo && tx.date > upTo) continue;
    if (acc.initialDate && tx.date < acc.initialDate) continue;
    bal += txEffect(tx, acc.id);
  }
  return round2(bal);
}

/** Income/expense totals — internal transfers, withdrawals and deposits are excluded. */
export function flowTotals(txs: TxLike[]): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += Math.abs(tx.amount);
    else if (tx.type === 'expense') expense += Math.abs(tx.amount);
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Standard amortized monthly payment. rate in % per year. */
export function loanPayment(principal: number, ratePct: number, years: number): number {
  if (!principal || !years) return 0;
  const n = years * 12;
  const r = ratePct / 100 / 12;
  if (r === 0) return round2(principal / n);
  return round2((principal * r) / (1 - Math.pow(1 + r, -n)));
}

export interface PropertyInput {
  price?: number | null;
  fees?: number | null;
  works?: number | null;
  downPayment?: number | null;
  loanAmount?: number | null;
  rate?: number | null;
  durationYears?: number | null;
  monthlyPayment?: number | null;
  rent?: number | null;
  charges?: number | null;
  propertyTax?: number | null;
  insurance?: number | null;
  taxRate?: number | null;
}

export function propertyMetrics(p: PropertyInput) {
  const price = p.price || 0;
  const totalCost = price + (p.fees || 0) + (p.works || 0);
  const loan = p.loanAmount ?? Math.max(0, totalCost - (p.downPayment || 0));
  const monthly = p.monthlyPayment || loanPayment(loan, p.rate || 0, p.durationYears || 0);
  const annualRent = (p.rent || 0) * 12;
  const annualCharges = (p.charges || 0) * 12 + (p.propertyTax || 0) + (p.insurance || 0) * 12;
  const grossYield = totalCost ? (annualRent / totalCost) * 100 : 0;
  const netBeforeTax = annualRent - annualCharges;
  const tax = Math.max(0, netBeforeTax) * ((p.taxRate || 0) / 100);
  const netYield = totalCost ? ((netBeforeTax - tax) / totalCost) * 100 : 0;
  const cashflow = (annualRent - annualCharges - tax) / 12 - monthly;
  return {
    totalCost: round2(totalCost),
    loan: round2(loan),
    monthlyPayment: round2(monthly),
    grossYield: round2(grossYield),
    netYield: round2(netYield),
    monthlyCashflow: round2(cashflow),
    annualTax: round2(tax),
  };
}

/** Compound growth with monthly contributions. Returns yearly points. */
export function simulateInvestment(initial: number, monthly: number, years: number, annualRatePct: number) {
  const r = annualRatePct / 100 / 12;
  let value = initial;
  let invested = initial;
  const points = [{ year: 0, value: round2(value), invested: round2(invested) }];
  for (let m = 1; m <= years * 12; m++) {
    value = value * (1 + r) + monthly;
    invested += monthly;
    if (m % 12 === 0) points.push({ year: m / 12, value: round2(value), invested: round2(invested) });
  }
  return points;
}

/** Monthly amount needed to reach target by date. */
export function monthlyNeeded(target: number, saved: number, fromDate: string, targetDate?: string | null): number | null {
  if (!targetDate) return null;
  const [y1, m1] = fromDate.split('-').map(Number);
  const [y2, m2] = targetDate.split('-').map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1);
  const remaining = Math.max(0, target - saved);
  if (remaining === 0) return 0;
  if (months <= 0) return round2(remaining);
  return round2(remaining / months);
}

export const eur = (n: number | null | undefined, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n || 0);
