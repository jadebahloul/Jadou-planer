import * as React from 'react';
import { Plus, PiggyBank, CalendarClock, Heart } from 'lucide-react';
import { today, formatFr } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel } from '@shared/registry';
import { useApi, useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Ring, Stat, Badge } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';

export function SavingsPage() {
  const { data: m } = useApi<any>('/stats/money');
  const { data: wishlist = [] } = useList('wishlistItem', { where: { savingsGoalId: { not: null } } });
  const { data: goalsRaw = [] } = useList('savingsGoal');
  const open = useRecordDialog();
  const goals = m?.savingsGoals ?? [];
  const totalTarget = goals.reduce((s: number, g: any) => s + g.target, 0);
  const totalSaved = goals.reduce((s: number, g: any) => s + g.saved, 0);
  return (
    <Page>
      <PageHeader eyebrow="Money" title="Savings" accent="Goals" subtitle="Sécurité, apport immobilier, futur business, voyages, achats importants." coverKey="savings" variant={1} actions={<Button icon={Plus} onClick={() => open({ resource: 'savingsGoal' })}>Objectif d’épargne</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Épargné (objectifs)" value={eur(totalSaved)} icon={PiggyBank} accent />
        <Stat label="Objectif total" value={eur(totalTarget)} />
        <Stat label="Versé ce mois" value={eur(m?.savedThisMonth ?? 0)} sub="versements + virements vers l’épargne" />
        <Stat label="Comptes épargne" value={eur(m?.savingsBalance ?? 0)} />
      </div>
      {goals.length === 0 ? (
        <Card><Empty icon={PiggyBank} title="Aucun objectif d’épargne" text="Crée un objectif : le montant mensuel nécessaire est calculé automatiquement selon ta date cible." /></Card>
      ) : (
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g: any) => {
            const raw = goalsRaw.find((x) => x.id === g.id);
            const linked = wishlist.filter((w) => w.savingsGoalId === g.id);
            return (
              <Card key={g.id} hover className="p-5">
                <div className="flex items-start gap-4">
                  <Ring value={g.pct} size={84} stroke={7} color={g.color ?? '#713F4B'}><span className="num text-sm font-semibold">{g.pct}%</span></Ring>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => open({ resource: 'savingsGoal', id: g.id })}>
                    <Badge>{optionLabel(REGISTRY.savingsGoal.fields.category.options, raw?.category)}</Badge>
                    <div className="mt-1 font-display text-2xl leading-tight">{g.name}</div>
                    <div className="num mt-1 text-sm"><b>{eur(g.saved)}</b> <span className="text-muted">/ {eur(g.target)}</span></div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-sunken/70 p-2.5"><div className="text-muted">Date cible</div><div className="font-semibold">{g.targetDate ? formatFr(g.targetDate, { year: true }) : '—'}</div></div>
                  <div className="rounded-xl bg-sunken/70 p-2.5"><div className="text-muted">Versement mensuel nécessaire</div><div className="num font-semibold">{g.monthlyNeeded != null ? eur(g.monthlyNeeded) : 'Ajoute une date'}</div></div>
                </div>
                {linked.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted"><Heart className="h-3 w-3" />{linked.map((w) => w.name).join(', ')}</div>}
                <Button size="sm" variant="soft" icon={Plus} className="mt-4 w-full" onClick={() => open({ resource: 'savingsContribution', defaults: { goalId: g.id, date: today() }, title: `Versement · ${g.name}` })}>Ajouter un versement</Button>
              </Card>
            );
          })}
        </div>
      )}
      <ResourceTable resource="savingsContribution" title="Historique des versements" defaults={{ date: today() }} />
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><CalendarClock className="h-3.5 w-3.5" />Les versements suivent tes objectifs ; pour déplacer réellement l’argent, enregistre un virement interne dans My Banks (il ne compte pas comme une dépense).</p>
    </Page>
  );
}
