import * as React from 'react';
import { Plus, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { today, addMonths, startOfMonth, endOfMonth, monthKey, FR_MONTHS } from '@shared/dates';
import { eur } from '@shared/finance';
import { useApi, useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, IconButton, Progress, Stat } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, pct } from '@/lib/utils';

const KINDS = [
  { v: 'income', label: 'Revenus', color: '#3F8F5F' },
  { v: 'fixed', label: 'Charges fixes', color: '#8A3B55' },
  { v: 'variable', label: 'Dépenses variables', color: '#C08A1C' },
  { v: 'savings', label: 'Épargne', color: '#008F80' },
  { v: 'investment', label: 'Investissements', color: '#4E79C4' },
];

export function BudgetPage() {
  const [month, setMonth] = React.useState(startOfMonth(today()));
  const mk = monthKey(month);
  const { data: lines = [] } = useList('budgetLine');
  const { data: txs = [] } = useList('transaction', { where: { date: { gte: month, lte: endOfMonth(month) } } });
  const { data: contribs = [] } = useList('savingsContribution', { where: { date: { gte: month, lte: endOfMonth(month) } } });
  const { data: invest = [] } = useList('investment', { where: { date: { gte: month, lte: endOfMonth(month) } } });
  const { data: m } = useApi<any>(`/stats/money?date=${month}`);
  const open = useRecordDialog();
  const active = lines.filter((l) => !l.month || l.month === mk);
  const actualFor = (l: any) => {
    if (l.kind === 'income') return txs.filter((t) => t.type === 'income' && (!l.category || t.category === l.category)).reduce((s, t) => s + t.amount, 0);
    if (l.kind === 'savings') return contribs.reduce((s, c) => s + c.amount, 0);
    if (l.kind === 'investment') return invest.reduce((s, i) => s + (i.amount ?? 0), 0);
    return l.category ? txs.filter((t) => t.type === 'expense' && t.category === l.category).reduce((s, t) => s + t.amount, 0) : null;
  };
  const planned = (k: string) => active.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
  const remaining = planned('income') - planned('fixed') - planned('variable') - planned('savings') - planned('investment');
  const realExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const realIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  return (
    <Page>
      <PageHeader eyebrow="Money" title="Monthly" accent="Budget" subtitle="Revenus, charges fixes, dépenses variables, épargne, investissements et reste disponible." coverKey="budget" variant={0} actions={<Button icon={Plus} onClick={() => open({ resource: 'budgetLine', defaults: { kind: 'variable' } })}>Ligne de budget</Button>} />
      <div className="mb-5 flex items-center gap-2">
        <IconButton icon={ChevronLeft} label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} />
        <div className="h-display min-w-[180px] text-center text-2xl capitalize">{FR_MONTHS[+mk.slice(5) - 1]} {mk.slice(0, 4)}</div>
        <IconButton icon={ChevronRight} label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Reste disponible prévu" value={eur(remaining)} accent icon={Wallet} sub="revenus − charges − épargne − invest." />
        <Stat label="Revenus réels" value={eur(realIncome)} sub={`prévu ${eur(planned('income'))}`} />
        <Stat label="Dépenses réelles" value={eur(realExpense)} sub={`prévu ${eur(planned('fixed') + planned('variable'))}`} />
        <Stat label="Solde prévisionnel" value={m ? eur(m.forecast) : '—'} sub="comptes courants, fin de mois" />
      </div>
      {active.length === 0 ? (
        <Card><Empty icon={Wallet} title="Aucun budget pour ce mois" text="Ajoute tes lignes : salaire d’alternance, loyer, abonnements, courses, épargne… Une ligne sans mois s’applique à tous les mois. Associe une catégorie pour comparer avec tes dépenses réelles." action={<Button variant="soft" icon={Plus} onClick={() => open({ resource: 'budgetLine', defaults: { kind: 'income' } })}>Première ligne</Button>} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {KINDS.map((k) => {
            const ls = active.filter((l) => l.kind === k.v);
            return (
              <Card key={k.v}>
                <CardHeader title={k.label} eyebrow={`Prévu ${eur(planned(k.v))}`} action={<button onClick={() => open({ resource: 'budgetLine', defaults: { kind: k.v, month: '' } })} className="text-muted hover:text-wine" aria-label="Ajouter"><Plus className="h-4 w-4" /></button>} />
                <div className="space-y-3 p-5">
                  {ls.length === 0 && <div className="text-xs text-muted">—</div>}
                  {ls.map((l) => {
                    const actual = actualFor(l);
                    const over = actual != null && k.v !== 'income' && k.v !== 'savings' && k.v !== 'investment' && actual > l.amount;
                    return (
                      <button key={l.id} onClick={() => open({ resource: 'budgetLine', id: l.id })} className="block w-full text-left">
                        <div className="mb-1 flex items-baseline justify-between text-sm">
                          <span className="font-medium">{l.label}{!l.month && <span className="ml-1 text-[10px] text-muted">(chaque mois)</span>}</span>
                          <span className={cn('num', over && 'font-semibold text-bad')}>{actual != null ? `${eur(actual)} / ` : ''}{eur(l.amount)}</span>
                        </div>
                        {actual != null && <Progress value={pct(actual, l.amount)} color={over ? 'rgb(var(--bad))' : k.color} height={5} />}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
