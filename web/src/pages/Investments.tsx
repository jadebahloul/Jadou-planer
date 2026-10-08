import * as React from 'react';
import { Plus, TrendingUp, Calculator, Info, RefreshCw } from 'lucide-react';
import { today } from '@shared/dates';
import { eur, simulateInvestment, round2 } from '@shared/finance';
import { useList, useInvalidate } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Input, Label, Modal } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TrendChart, DonutChart } from '@/components/charts';
import { GoalCard } from './Goals';
import { cn, nf } from '@/lib/utils';
import { toast } from 'sonner';

function Simulator() {
  const [v, setV] = React.useState({ initial: 1000, monthly: 100, years: 15, r1: 3, r2: 6, r3: 8 });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) || 0 });
  const scen = [v.r1, v.r2, v.r3].map((r) => simulateInvestment(v.initial, v.monthly, v.years, r));
  const data = scen[0].map((p, i) => ({ year: p.year, invested: p.invested, s1: scen[0][i].value, s2: scen[1][i].value, s3: scen[2][i].value }));
  const last = data[data.length - 1];
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="space-y-3 p-5">
        <div className="eyebrow">Paramètres</div>
        <div><Label>Capital initial (€)</Label><Input type="number" value={v.initial} onChange={set('initial')} /></div>
        <div><Label>Versement mensuel (€)</Label><Input type="number" value={v.monthly} onChange={set('monthly')} /></div>
        <div><Label>Durée (années)</Label><Input type="number" value={v.years} onChange={set('years')} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Prudent %</Label><Input type="number" step={0.5} value={v.r1} onChange={set('r1')} /></div>
          <div><Label>Médian %</Label><Input type="number" step={0.5} value={v.r2} onChange={set('r2')} /></div>
          <div><Label>Dynamique %</Label><Input type="number" step={0.5} value={v.r3} onChange={set('r3')} /></div>
        </div>
        <div className="flex gap-2 rounded-xl bg-warn/10 p-3 text-xs text-ink/80"><Info className="h-4 w-4 shrink-0 text-warn" />Simulation hypothétique : rendements constants supposés, hors frais et fiscalité. Elle ne garantit aucun rendement — les marchés peuvent baisser.</div>
      </Card>
      <Card>
        <CardHeader icon={Calculator} title="Scénarios" eyebrow={`Après ${v.years} ans · ${eur(last.invested)} versés`} />
        <div className="grid grid-cols-3 gap-3 px-5 pt-4">
          {[['Prudent', last.s1, v.r1], ['Médian', last.s2, v.r2], ['Dynamique', last.s3, v.r3]].map(([n, val, r]) => (
            <div key={n as string} className="rounded-2xl bg-sunken/70 p-3"><div className="text-xs text-muted">{n} · {r} %/an</div><div className="num font-display text-2xl">{eur(val as number)}</div><div className="text-[11px] text-muted">dont gains {eur((val as number) - last.invested)}</div></div>
          ))}
        </div>
        <div className="p-5"><TrendChart data={data} x="year" labelFmt={(y) => `${y} an${y > 1 ? 's' : ''}`} fmt="eur" height={280} type="line" series={[{ key: 'invested', name: 'Montant versé', color: 'rgb(var(--muted))' }, { key: 's1', name: `Prudent ${v.r1}%` }, { key: 's2', name: `Médian ${v.r2}%` }, { key: 's3', name: `Dynamique ${v.r3}%` }]} /></div>
      </Card>
    </div>
  );
}

export function InvestmentsPage() {
  const [tab, setTab] = React.useState<'portfolio' | 'operations' | 'simulator' | 'goals'>('portfolio');
  const { data: inv = [] } = useList('investment');
  const { data: goals = [] } = useList('goal', { where: { category: 'money' } });
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const [priceFor, setPriceFor] = React.useState<{ key: string; price: string } | null>(null);
  const groups = Object.values(
    inv.reduce((acc: Record<string, any>, i) => {
      const k = (i.ticker || i.asset).toUpperCase();
      acc[k] ??= { key: k, asset: i.asset, ticker: i.ticker, kind: i.kind, amount: 0, units: 0, value: 0, hasPrice: true, ids: [] as number[], currentPrice: i.currentPrice };
      acc[k].amount += i.amount ?? 0;
      acc[k].units += i.units ?? 0;
      acc[k].value += i.units && i.currentPrice ? i.units * i.currentPrice : i.amount ?? 0;
      if (!(i.units && i.currentPrice)) acc[k].hasPrice = false;
      acc[k].ids.push(i.id);
      return acc;
    }, {}),
  ) as any[];
  const invested = groups.reduce((s, g) => s + g.amount, 0);
  const value = groups.reduce((s, g) => s + g.value, 0);
  const perf = invested ? ((value - invested) / invested) * 100 : 0;
  const updatePrice = async () => {
    if (!priceFor) return;
    const g = groups.find((x) => x.key === priceFor.key);
    for (const id of g.ids) await api(`/r/investment/${id}`, { method: 'PATCH', body: { currentPrice: Number(priceFor.price.replace(',', '.')) } });
    invalidate();
    setPriceFor(null);
    toast.success('Valeur actualisée ♡');
  };
  return (
    <Page>
      <PageHeader eyebrow="Money" title="My" accent="Investments" subtitle="ETF S&P 500, actions, fonds… suivis en toute transparence (prix mis à jour manuellement)." coverKey="investments" variant={2} actions={<Button icon={Plus} onClick={() => open({ resource: 'investment', defaults: { date: today(), kind: 'etf' } })}>Achat</Button>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'portfolio', label: 'Portefeuille' }, { value: 'operations', label: 'Opérations' }, { value: 'simulator', label: 'Investment Simulator' }, { value: 'goals', label: 'Objectifs de patrimoine' }]} />
      {tab === 'portfolio' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Valeur estimée" value={eur(value, 2)} icon={TrendingUp} accent />
            <Stat label="Montant investi" value={eur(invested, 2)} />
            <Stat label="Plus/moins-value" value={<span className={value - invested >= 0 ? 'text-good' : 'text-bad'}>{value - invested >= 0 ? '+' : ''}{eur(value - invested, 2)}</span>} />
            <Stat label="Performance" value={<span className={perf >= 0 ? 'text-good' : 'text-bad'}>{perf >= 0 ? '+' : ''}{nf(perf, 2)} %</span>} />
          </div>
          {groups.length === 0 ? <Card><Empty icon={TrendingUp} title="Aucun investissement" text="Ajoute chaque achat (date, montant, nombre de parts, prix) — par exemple ton versement mensuel sur l’ETF S&P 500." /></Card> : (
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left"><th className="eyebrow px-5 py-3">Actif</th><th className="eyebrow text-right">Parts</th><th className="eyebrow text-right">PRU</th><th className="eyebrow text-right">Prix actuel</th><th className="eyebrow text-right">Valeur</th><th className="eyebrow pr-5 text-right">+/-</th></tr></thead>
                  <tbody>
                    {groups.map((g) => {
                      const pl = g.value - g.amount;
                      return (
                        <tr key={g.key} className="border-t border-line/60">
                          <td className="px-5 py-3"><div className="font-medium">{g.asset}</div><div className="text-xs text-muted">{g.ticker}</div></td>
                          <td className="num text-right">{nf(g.units, 4)}</td>
                          <td className="num text-right">{g.units ? eur(g.amount / g.units, 2) : '—'}</td>
                          <td className="text-right"><button className="chip ml-auto" onClick={() => setPriceFor({ key: g.key, price: String(g.currentPrice ?? '') })}><RefreshCw className="h-3 w-3" />{g.currentPrice ? eur(g.currentPrice, 2) : 'Définir'}</button></td>
                          <td className="num text-right font-semibold">{eur(g.value, 2)}</td>
                          <td className={cn('num pr-5 text-right', pl >= 0 ? 'text-good' : 'text-bad')}>{g.hasPrice ? `${pl >= 0 ? '+' : ''}${eur(pl, 2)} (${nf((pl / g.amount) * 100, 1)} %)` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              <Card><CardHeader title="Répartition" /><div className="p-5"><DonutChart data={groups.map((g) => ({ name: g.asset, value: round2(g.value) }))} /></div></Card>
            </div>
          )}
        </div>
      )}
      {tab === 'operations' && <ResourceTable resource="investment" title="Historique des achats" defaults={{ date: today(), kind: 'etf' }} exportable />}
      {tab === 'simulator' && <Simulator />}
      {tab === 'goals' && (
        <div className="space-y-4">
          <Button icon={Plus} onClick={() => open({ resource: 'goal', defaults: { category: 'money', horizon: 'long_term', unit: '€' } })}>Objectif de patrimoine</Button>
          {goals.length === 0 ? <Card><Empty title="Aucun objectif" text="Ex. « 10 000 € investis en ETF d’ici 2028 » (valeur cible + valeur actuelle)." /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{goals.map((g) => <GoalCard key={g.id} g={g} />)}</div>}
        </div>
      )}
      <Modal open={!!priceFor} onOpenChange={(o) => !o && setPriceFor(null)} title="Actualiser le prix" size="sm" footer={<Button onClick={updatePrice}>Enregistrer</Button>}>
        <Label>Prix actuel par part (€)</Label>
        <Input autoFocus value={priceFor?.price ?? ''} onChange={(e) => setPriceFor((p) => (p ? { ...p, price: e.target.value } : p))} />
        <p className="mt-2 text-xs text-muted">Appliqué à toutes les lignes de cet actif. Aucune donnée de marché n’est récupérée automatiquement.</p>
      </Modal>
    </Page>
  );
}
