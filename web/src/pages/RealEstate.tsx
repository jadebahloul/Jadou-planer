import * as React from 'react';
import { Plus, Building2, Calculator, Info, Scale } from 'lucide-react';
import { eur, propertyMetrics, type PropertyInput } from '@shared/finance';
import { REGISTRY, optionLabel } from '@shared/registry';
import { useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Input, Label, Badge, Select } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, nf } from '@/lib/utils';

const PF = REGISTRY.property.fields;

function MetricsGrid({ p }: { p: PropertyInput }) {
  const m = propertyMetrics(p);
  const cells = [
    ['Coût total', eur(m.totalCost)],
    ['Crédit', eur(m.loan)],
    ['Mensualité', eur(m.monthlyPayment, 2)],
    ['Rendement brut', `${nf(m.grossYield, 2)} %`],
    ['Rendement net estimé', `${nf(m.netYield, 2)} %`],
    ['Cash-flow mensuel', eur(m.monthlyCashflow, 2)],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map(([k, v]) => (
        <div key={k} className={cn('rounded-xl bg-sunken/70 p-3', k === 'Cash-flow mensuel' && (m.monthlyCashflow >= 0 ? 'bg-good/10' : 'bg-bad/10'))}>
          <div className="text-[11px] text-muted">{k}</div>
          <div className="num font-display text-xl">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Simulator() {
  const [v, setV] = React.useState<Record<string, number>>({ price: 150000, fees: 12000, works: 5000, downPayment: 20000, rate: 3.6, durationYears: 25, rent: 750, charges: 80, propertyTax: 900, insurance: 20, taxRate: 0 });
  const f = (k: string, label: string, step = 1) => (
    <div key={k}><Label>{label}</Label><Input type="number" step={step} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) || 0 })} /></div>
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-5">
        <div className="eyebrow mb-3">Property Simulator</div>
        <div className="grid grid-cols-2 gap-3">
          {f('price', 'Prix (€)')}{f('fees', 'Frais (€)')}{f('works', 'Travaux (€)')}{f('downPayment', 'Apport (€)')}{f('rate', 'Taux (%)', 0.05)}{f('durationYears', 'Durée (ans)')}{f('rent', 'Loyer mensuel (€)')}{f('charges', 'Charges mensuelles (€)')}{f('propertyTax', 'Taxe foncière / an (€)')}{f('insurance', 'Assurance / mois (€)')}{f('taxRate', 'Fiscalité estimée (%)', 0.5)}
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-5"><CardHeader icon={Calculator} title="Résultats" className="mb-4 px-0 pt-0" /><MetricsGrid p={{ ...v, loanAmount: null }} /></Card>
        <div className="flex gap-2 rounded-2xl bg-warn/10 p-4 text-xs text-ink/80"><Info className="h-4 w-4 shrink-0 text-warn" />Estimation simplifiée (crédit amortissable à taux fixe, fiscalité appliquée en % du résultat net avant impôt, hors vacance locative). À valider avec un courtier / un conseiller.</div>
      </div>
    </div>
  );
}

export function RealEstatePage() {
  const [tab, setTab] = React.useState<'portfolio' | 'projects' | 'compare' | 'simulator'>('portfolio');
  const { data: props = [] } = useList('property');
  const open = useRecordDialog();
  const [own, setOwn] = React.useState<string>('all');
  const owned = props.filter((p) => p.status === 'owned' && (own === 'all' || p.ownership === own));
  const projects = props.filter((p) => p.status === 'project');
  const [cmp, setCmp] = React.useState<number[]>([]);
  const totals = owned.reduce((s, p) => { const m = propertyMetrics(p as PropertyInput); return { rent: s.rent + (p.rent ?? 0), cash: s.cash + m.monthlyCashflow, value: s.value + (p.price ?? 0) }; }, { rent: 0, cash: 0, value: 0 });

  const PropCard = ({ p }: { p: any }) => {
    const m = propertyMetrics(p);
    return (
      <Card hover className="cursor-pointer overflow-hidden" onClick={() => open({ resource: 'property', id: p.id })}>
        {p.photo ? <img src={p.photo} alt="" className="h-40 w-full object-cover" /> : <div className="grid h-24 place-items-center bg-gradient-to-br from-sand to-petal"><Building2 className="h-8 w-8 text-wine/40" strokeWidth={1.3} /></div>}
        <div className="p-5">
          <div className="mb-1 flex flex-wrap gap-1.5"><Badge>{optionLabel(PF.ownership.options, p.ownership)}</Badge><Badge>{optionLabel(PF.rentalType.options, p.rentalType)}</Badge></div>
          <div className="font-display text-2xl">{p.name}</div>
          <div className="text-xs text-muted">{p.city ?? '—'}{p.surface ? ` · ${p.surface} m²` : ''}{p.price ? ` · ${eur(p.price)}` : ''}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{nf(m.grossYield, 1)} %</div><div className="text-muted">brut</div></div>
            <div className="rounded-xl bg-sunken/70 py-2"><div className="num font-semibold">{nf(m.netYield, 1)} %</div><div className="text-muted">net est.</div></div>
            <div className={cn('rounded-xl py-2', m.monthlyCashflow >= 0 ? 'bg-good/10' : 'bg-bad/10')}><div className="num font-semibold">{eur(m.monthlyCashflow)}</div><div className="text-muted">cash-flow</div></div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Page>
      <PageHeader eyebrow="Money" title="Real" accent="Estate" subtitle="Biens personnels, familiaux ou gérés · projets · simulateur." coverKey="realestate" variant={0} actions={<><Button icon={Plus} onClick={() => open({ resource: 'property', defaults: { status: 'owned' } })}>Bien</Button><Button variant="outline" icon={Plus} onClick={() => open({ resource: 'property', defaults: { status: 'project' } })}>Projet</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'portfolio', label: 'Mes biens' }, { value: 'projects', label: 'Property Projects' }, { value: 'compare', label: 'Comparer', icon: Scale }, { value: 'simulator', label: 'Simulateur', icon: Calculator }]} />
      {tab === 'portfolio' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Biens" value={owned.length} icon={Building2} />
            <Stat label="Valeur d’achat" value={eur(totals.value)} />
            <Stat label="Loyers mensuels" value={eur(totals.rent)} />
            <Stat label="Cash-flow mensuel" value={eur(totals.cash)} />
          </div>
          <div className="flex gap-1.5">{[{ value: 'all', label: 'Tous' }, ...PF.ownership.options].map((o) => <button key={o.value} className={cn('chip', own === o.value && 'chip-active')} onClick={() => setOwn(o.value)}>{o.label}</button>)}</div>
          {owned.length === 0 ? <Card><Empty icon={Building2} title="Aucun bien" text="Ajoute un bien : crédit, mensualité, charges, taxe foncière, loyer… rentabilité et cash-flow sont calculés." /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{owned.map((p) => <PropCard key={p.id} p={p} />)}</div>}
        </div>
      )}
      {tab === 'projects' && (projects.length === 0 ? <Card><Empty icon={Building2} title="Aucun projet" text="Enregistre les biens repérés (annonces) pour les comparer." /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((p) => <PropCard key={p.id} p={p} />)}</div>)}
      {tab === 'compare' && (
        <Card className="overflow-x-auto p-5">
          <div className="mb-4 flex flex-wrap gap-2">{props.map((p) => <button key={p.id} className={cn('chip', cmp.includes(p.id) && 'chip-active')} onClick={() => setCmp(cmp.includes(p.id) ? cmp.filter((x) => x !== p.id) : [...cmp, p.id].slice(-4))}>{p.name}</button>)}</div>
          {cmp.length < 2 ? <Empty title="Sélectionne 2 à 4 biens" /> : (
            <table className="w-full text-sm">
              <tbody>
                {[['Ville', (p: any) => p.city ?? '—'], ['Surface', (p: any) => (p.surface ? `${p.surface} m²` : '—')], ['Prix', (p: any) => eur(p.price)], ['Prix / m²', (p: any) => (p.price && p.surface ? eur(p.price / p.surface) : '—')], ['Loyer', (p: any) => eur(p.rent)], ['Mensualité', (p: any) => eur(propertyMetrics(p).monthlyPayment)], ['Rendement brut', (p: any) => `${nf(propertyMetrics(p).grossYield, 2)} %`], ['Rendement net', (p: any) => `${nf(propertyMetrics(p).netYield, 2)} %`], ['Cash-flow', (p: any) => eur(propertyMetrics(p).monthlyCashflow)]].map(([k, fn]: any) => (
                  <tr key={k} className="border-t border-line/60"><th className="eyebrow py-2.5 pr-4 text-left">{k}</th>{cmp.map((id) => <td key={id} className="num py-2.5 font-medium">{fn(props.find((p) => p.id === id))}</td>)}</tr>
                ))}
                <tr><th /> {cmp.map((id) => <td key={id} className="pt-2 font-display text-lg">{props.find((p) => p.id === id)?.name}</td>)}</tr>
              </tbody>
            </table>
          )}
        </Card>
      )}
      {tab === 'simulator' && <Simulator />}
    </Page>
  );
}
