import * as React from 'react';
import Papa from 'papaparse';
import { Plus, Upload, Landmark, ArrowLeftRight, Wallet, PiggyBank, TrendingUp, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { today } from '@shared/dates';
import { eur } from '@shared/finance';
import { optionLabel, TX_CATEGORIES, REGISTRY } from '@shared/registry';
import { useApi, useList, useInvalidate } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Modal, Select, Label } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TrendChart, DonutChart, BarsChart } from '@/components/charts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function parseDateAny(s: string): string | null {
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const num = (s: unknown) => {
  if (s == null || s === '') return NaN;
  const t = String(s).replace(/\s|€| /g, '');
  return parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
};

function CsvImport({ open, onClose, accounts }: { open: boolean; onClose: () => void; accounts: any[] }) {
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [cols, setCols] = React.useState<string[]>([]);
  const [map, setMap] = React.useState({ date: '', label: '', amount: '', debit: '', credit: '' });
  const [accountId, setAccountId] = React.useState<string>('');
  const [preview, setPreview] = React.useState<any>(null);
  const invalidate = useInvalidate();
  const guess = (cs: string[], re: RegExp) => cs.find((c) => re.test(c.toLowerCase())) ?? '';
  const onFile = (f: File) => {
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const cs = r.meta.fields ?? [];
        setCols(cs);
        setRows(r.data);
        setMap({ date: guess(cs, /date/), label: guess(cs, /libell|label|description|intitul|operation/), amount: guess(cs, /^montant|amount|valeur/), debit: guess(cs, /d[ée]bit/), credit: guess(cs, /cr[ée]dit/) });
        setPreview(null);
      },
    });
  };
  const mapped = rows.map((r) => {
    const amount = map.amount ? num(r[map.amount]) : (num(r[map.credit]) || 0) - Math.abs(num(r[map.debit]) || 0);
    return { date: parseDateAny(r[map.date]), label: r[map.label], amount };
  });
  const run = async (dryRun: boolean) => {
    if (!accountId) return toast.error('Choisis le compte');
    const r = await api('/import/transactions', { body: { accountId: Number(accountId), rows: mapped, dryRun } });
    if (dryRun) setPreview(r);
    else {
      toast.success(`${r.imported} transactions importées · ${r.duplicates} doublons ignorés`);
      invalidate();
      onClose();
      setRows([]);
      setPreview(null);
    }
  };
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Import bancaire CSV" description="Exporte un relevé CSV depuis ta banque, puis associe les colonnes. Les doublons sont détectés automatiquement." size="lg" footer={rows.length ? <><Button variant="ghost" onClick={() => run(true)}>Prévisualiser</Button><Button onClick={() => run(false)} disabled={!preview}>Importer</Button></> : undefined}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-2xl bg-petal/50 p-3 text-xs"><ShieldCheck className="h-4 w-4 text-wine" />Jadou Planner ne te demandera jamais tes identifiants bancaires. Le fichier est lu sur ton ordinateur.</div>
        <div><Label>Compte</Label><Select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} {a.bank ? `(${a.bank})` : ''}</option>)}</Select></div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-6 text-sm text-muted hover:border-wine/40">
          <FileSpreadsheet className="h-6 w-6" />{rows.length ? `${rows.length} lignes lues — changer de fichier` : 'Choisir un fichier .csv'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {cols.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(['date', 'label', 'amount', 'debit', 'credit'] as const).map((k) => (
              <div key={k}><Label>{{ date: 'Date', label: 'Libellé', amount: 'Montant (signé)', debit: 'ou Débit', credit: 'ou Crédit' }[k]}</Label><Select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}><option value="">—</option>{cols.map((c) => <option key={c}>{c}</option>)}</Select></div>
            ))}
          </div>
        )}
        {preview && (
          <div className="rounded-2xl border border-line p-3 text-sm">
            <div className="mb-2 flex gap-4"><b>{preview.imported} nouvelles</b><span className="text-muted">{preview.duplicates} doublons</span><span className="text-muted">{preview.invalid} lignes invalides</span></div>
            {preview.preview.map((p: any, i: number) => <div key={i} className="flex justify-between border-t border-line/60 py-1 text-xs"><span>{p.date} · {p.label}</span><span className={p.type === 'income' ? 'text-good' : ''}>{p.type === 'income' ? '+' : '−'}{eur(p.amount, 2)} · {optionLabel(TX_CATEGORIES, p.category)}</span></div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function BanksPage() {
  const [tab, setTab] = React.useState<'overview' | 'transactions' | 'analytics'>('overview');
  const [acc, setAcc] = React.useState<number | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const { data: m } = useApi<any>('/stats/money');
  const { data: series = [] } = useApi<any[]>('/stats/money-series?months=12');
  const { data: accounts = [] } = useList('bankAccount');
  const open = useRecordDialog();
  const t0 = today();
  const label = (x: string) => new Date(+x.slice(0, 4), +x.slice(5) - 1).toLocaleDateString('fr-FR', { month: 'short' });

  return (
    <Page>
      <PageHeader eyebrow="Money" title="My" accent="Banks" subtitle="Saisie manuelle & import CSV — aucun mot de passe bancaire, jamais." coverKey="banks" variant={2} actions={<><Button icon={Plus} onClick={() => open({ resource: 'transaction', defaults: { date: t0, type: 'expense', accountId: acc ?? accounts[0]?.id } })}>Transaction</Button><Button variant="outline" icon={ArrowLeftRight} onClick={() => open({ resource: 'transaction', defaults: { date: t0, type: 'transfer', category: 'epargne', label: 'Virement interne', accountId: accounts[0]?.id } })}>Virement</Button><Button variant="outline" icon={Upload} onClick={() => setImportOpen(true)} disabled={!accounts.length}>Import CSV</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Money Dashboard' }, { value: 'transactions', label: 'Transactions' }, { value: 'analytics', label: 'Analytics' }]} />

      {tab === 'overview' && (
        <div className="space-y-5">
          {m && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Total disponible" value={eur(m.available)} icon={Wallet} accent />
              <Stat label="Épargne" value={eur(m.savingsBalance)} icon={PiggyBank} />
              <Stat label="Investissements" value={eur(m.investValue)} icon={TrendingUp} sub={m.invested ? `investi ${eur(m.invested)}` : undefined} />
              <Stat label="Revenus du mois" value={eur(m.income)} />
              <Stat label="Dépenses du mois" value={eur(m.expense)} />
              <Stat label="Solde prévisionnel" value={eur(m.forecast)} sub={m.budget.hasBudget ? 'selon ton budget' : 'ajoute un budget pour l’affiner'} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {m?.accounts.map((a: any) => (
              <Card key={a.id} hover className={cn('cursor-pointer overflow-hidden', acc === a.id && 'ring-2 ring-wine/40')} onClick={() => (setAcc(a.id), setTab('transactions'))}>
                <div className="h-1.5" style={{ background: a.color ?? '#713F4B' }} />
                <div className="p-5">
                  <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted" /><span className="eyebrow">{a.bank || 'Banque'}</span><span className="ml-auto text-[11px] text-muted">{optionLabel(REGISTRY.bankAccount.fields.type.options, a.type)}</span></div>
                  <div className="mt-2 font-semibold">{a.name}</div>
                  <div className={cn('num mt-1 font-display text-3xl', a.balance < 0 && 'text-bad')}>{eur(a.balance, 2)}</div>
                </div>
              </Card>
            ))}
            <button onClick={() => open({ resource: 'bankAccount' })} className="grid min-h-[130px] place-items-center rounded-2xl border border-dashed border-line text-sm text-muted transition hover:border-wine/40 hover:text-wine">
              <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" />Ajouter un compte</span>
            </button>
          </div>
          {!m?.hasAccounts && <Card><Empty icon={Landmark} title="Commence par tes comptes" text="Ex. BoursoBank (compte courant), Crédit Agricole, Livret A, Trade Republic (investissement). Indique le solde initial et sa date : chaque transaction mettra le solde à jour." /></Card>}
          {m?.hasAccounts && <ResourceTable resource="transaction" title="Dernières transactions" params={{ take: 12 }} defaults={{ date: t0, type: 'expense' }} />}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto">
            <button className={cn('chip', !acc && 'chip-active')} onClick={() => setAcc(null)}>Tous les comptes</button>
            {accounts.map((a) => <button key={a.id} className={cn('chip shrink-0', acc === a.id && 'chip-active')} onClick={() => setAcc(a.id)}>{a.name}</button>)}
          </div>
          <ResourceTable key={acc ?? 'all'} resource="transaction" title="Transactions" params={acc ? { where: { OR: [{ accountId: acc }, { toAccountId: acc }] } } : undefined} defaults={{ date: t0, type: 'expense', accountId: acc ?? undefined }} filterField="type" exportable emptyText="Les virements entre tes comptes ne sont jamais comptés comme revenus." />
        </div>
      )}

      {tab === 'analytics' && m && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader title="Évolution du solde total" eyebrow="12 mois" /><div className="p-5"><TrendChart data={series} x="month" labelFmt={label} series={[{ key: 'balance', name: 'Solde des comptes' }]} fmt="eur" /></div></Card>
            <Card><CardHeader title="Revenus & dépenses" eyebrow="12 mois" /><div className="p-5"><BarsChart data={series} x="month" labelFmt={label} series={[{ key: 'income', name: 'Revenus' }, { key: 'expense', name: 'Dépenses' }]} fmt="eur" /></div></Card>
            <Card><CardHeader title="Répartition des dépenses" eyebrow="Ce mois" /><div className="p-5">{Object.keys(m.byCategory).length ? <DonutChart data={Object.entries(m.byCategory).map(([k, v]) => ({ name: optionLabel(TX_CATEGORIES, k), value: v as number }))} center={<div><div className="num font-display text-xl">{eur(m.expense)}</div><div className="text-[10px] text-muted">dépensés</div></div>} /> : <Empty title="Aucune dépense ce mois" className="py-6" />}</div></Card>
            <Card><CardHeader title="Revenus par source" eyebrow="Ce mois" /><div className="p-5">{Object.keys(m.incomeBySource).length ? <DonutChart data={Object.entries(m.incomeBySource).map(([k, v]) => ({ name: optionLabel(TX_CATEGORIES, k), value: v as number }))} center={<div><div className="num font-display text-xl">{eur(m.income)}</div><div className="text-[10px] text-muted">reçus</div></div>} /> : <Empty title="Aucun revenu ce mois" className="py-6" />}</div></Card>
          </div>
          <Card><CardHeader title="Épargne versée par mois" eyebrow="Versements sur objectifs d’épargne" /><div className="p-5"><BarsChart data={series} x="month" labelFmt={label} series={[{ key: 'saved', name: 'Épargne versée', color: '#008F80' }]} fmt="eur" /></div></Card>
        </div>
      )}
      <CsvImport open={importOpen} onClose={() => setImportOpen(false)} accounts={accounts} />
    </Page>
  );
}
