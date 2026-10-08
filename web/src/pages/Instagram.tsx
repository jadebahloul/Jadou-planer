import * as React from 'react';
import { Link } from 'react-router-dom';
import { Camera, RefreshCw, Link2, ShieldCheck, Sparkles, Inbox, Unplug } from 'lucide-react';
import { today, addMonths, startOfMonth, monthKey, formatFr } from '@shared/dates';
import { eur } from '@shared/finance';
import { useApi, useList, useInvalidate } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Segmented, Badge, Empty } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { ContentPlanner, ContentLibrary, Performance } from '@/components/social';
import { BarsChart } from '@/components/charts';
import { askJadou } from '@/components/layout/Shell';
import { toast } from 'sonner';

function ConnectCard() {
  const { data: st, refetch } = useApi<any>('/instagram/status');
  const [media, setMedia] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const invalidate = useInvalidate();
  const connect = async () => {
    try {
      const { url } = await api<{ url: string }>('/instagram/connect');
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const sync = async () => {
    setBusy(true);
    try {
      const r = await api<any>('/instagram/sync', { method: 'POST' });
      setMedia(r.media ?? []);
      invalidate();
      toast.success('Statistiques Instagram synchronisées ♡');
      if (r.insightsError) toast(`Certaines statistiques ne sont pas accessibles : ${r.insightsError}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      refetch();
    }
  };
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1fr_1.2fr]">
        <div className="relative bg-gradient-to-br from-[#8A3B55] via-[#C9608A] to-[#E9A86A] p-6 text-white">
          <Camera className="h-8 w-8" strokeWidth={1.4} />
          <div className="mt-4 font-display text-3xl">Connect my Instagram</div>
          <p className="mt-2 text-sm text-white/85">Via les API officielles de Meta uniquement (Instagram API with Instagram Login). Lecture seule : aucune publication automatique.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {st?.connected ? (
              <>
                <Button variant="soft" icon={RefreshCw} loading={busy} onClick={sync}>Synchroniser</Button>
                <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" icon={Unplug} onClick={async () => { await api('/instagram/disconnect', { method: 'POST' }); refetch(); }}>Déconnecter</Button>
              </>
            ) : (
              <Button variant="soft" icon={Link2} onClick={connect} disabled={!st?.configured}>Connect my Instagram</Button>
            )}
          </div>
        </div>
        <div className="space-y-3 p-6 text-sm">
          <div className="flex items-center gap-2">
            <Badge color={st?.connected ? '#3F8F5F' : st?.configured ? '#B7791F' : '#8B8185'}>{st?.connected ? `Connecté${st.username ? ` · @${st.username}` : ''}` : st?.configured ? 'Prêt à connecter' : 'Non configuré'}</Badge>
            {st?.lastSync && <span className="text-xs text-muted">Dernière synchro : {formatFr(st.lastSync.slice(0, 10))}</span>}
          </div>
          {!st?.configured && (
            <div className="space-y-2 text-ink/80">
              <p className="font-medium">Conditions nécessaires (imposées par Meta) :</p>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                <li>Un compte Instagram <b>professionnel</b> (Business ou Créateur).</li>
                <li>Une application sur developers.facebook.com avec le produit « Instagram API with Instagram Login ».</li>
                <li>Une URL de redirection <b>HTTPS</b> déclarée dans l’app (ex. via un tunnel HTTPS vers ton ordinateur).</li>
                <li>Renseigner l’App ID et l’App Secret dans <Link to="/settings/integrations" className="text-wine underline">Settings › Integrations</Link>.</li>
              </ol>
              <p className="text-xs text-muted">En attendant, tout fonctionne en saisie manuelle : relevés de statistiques, planning éditorial, demandes clientes.</p>
            </div>
          )}
          {st?.configured && !st?.connected && <p className="text-xs text-muted">Clique sur « Connect my Instagram » : tu seras redirigée vers Instagram pour autoriser l’accès en lecture (profil & statistiques).</p>}
          <div className="flex items-center gap-2 rounded-xl bg-sunken/70 p-3 text-xs text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-wine" />Le jeton d’accès est chiffré et stocké uniquement sur ton ordinateur. Messages privés : non consultés (permissions supplémentaires requises) — utilise l’onglet « Demandes ».</div>
        </div>
      </div>
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-1 border-t border-line p-1 sm:grid-cols-6">
          {media.slice(0, 12).map((m) => (
            <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden bg-sunken">
              {(m.thumbnail_url || m.media_url) && <img src={m.thumbnail_url || m.media_url} alt="" className="h-full w-full object-cover" />}
              <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">♥ {m.like_count ?? 0} · 💬 {m.comments_count ?? 0}</span>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

function Analytics() {
  const t0 = today();
  const { data: metrics = [] } = useList('socialMetric', { where: { account: 'lash', network: 'instagram' }, orderBy: 'date', dir: 'asc' });
  const { data: appts = [] } = useList('lashAppointment');
  const { data: clients = [] } = useList('client');
  const months = Array.from({ length: 6 }, (_, i) => monthKey(addMonths(startOfMonth(t0), i - 5)));
  const data = months.map((m) => {
    const last = metrics.filter((x) => x.date.slice(0, 7) === m).pop();
    return {
      month: m,
      followers: last?.followers ?? null,
      rdv: appts.filter((a) => a.start.slice(0, 7) === m && a.status === 'done').length,
      newIg: clients.filter((c) => c.source === 'instagram' && c.createdAt.slice(0, 7) === m).length,
      ca: appts.filter((a) => a.start.slice(0, 7) === m && a.status === 'done').reduce((s, a) => s + (a.price ?? 0), 0),
    };
  });
  const igClients = clients.filter((c) => c.source === 'instagram');
  const igRevenue = appts.filter((a) => a.status === 'done' && igClients.some((c) => c.id === a.clientId)).reduce((s, a) => s + (a.price ?? 0), 0);
  const label = (m: string) => new Date(+m.slice(0, 4), +m.slice(5) - 1).toLocaleDateString('fr-FR', { month: 'short' });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-5"><div className="eyebrow">Clientes venues d’Instagram</div><div className="num mt-2 font-display text-4xl">{igClients.length}</div><div className="text-xs text-muted">sur {clients.length} clientes</div></Card>
        <Card className="p-5"><div className="eyebrow">CA généré par ces clientes</div><div className="num mt-2 font-display text-4xl">{eur(igRevenue)}</div></Card>
        <Card className="p-5"><div className="eyebrow">Abonnés (dernier relevé)</div><div className="num mt-2 font-display text-4xl">{metrics.length ? metrics[metrics.length - 1].followers ?? '—' : '—'}</div></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Rendez-vous réalisés & nouvelles clientes Instagram" /><div className="p-5"><BarsChart data={data} x="month" labelFmt={label} series={[{ key: 'rdv', name: 'RDV réalisés' }, { key: 'newIg', name: 'Nouvelles clientes via Instagram' }]} /></div></Card>
        <Card><CardHeader title="Chiffre d’affaires" /><div className="p-5"><BarsChart data={data} x="month" labelFmt={label} series={[{ key: 'ca', name: 'CA', color: '#E07A9A' }]} fmt="eur" /></div></Card>
      </div>
      <p className="text-xs text-muted">Chaque fiche cliente contient « Comment m’avez-vous connue ? » : c’est ce champ qui relie Instagram à tes rendez-vous et à ton chiffre d’affaires. Les abonnés proviennent de tes relevés (manuels ou API).</p>
    </div>
  );
}

export function InstagramPage() {
  const [tab, setTab] = React.useState<'dashboard' | 'planner' | 'library' | 'analytics' | 'inbox'>('dashboard');
  return (
    <Page>
      <PageHeader eyebrow="Business" title="Instagram" accent="Manager" subtitle="Ton compte cils : statistiques, calendrier éditorial, contenus et demandes." coverKey="instagram" variant={2} actions={<Button variant="outline" icon={Sparkles} onClick={askJadou}>Idées avec Jadou AI</Button>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'planner', label: 'Content Planner' }, { value: 'library', label: 'Content Library' }, { value: 'analytics', label: 'Analytics' }, { value: 'inbox', label: 'Demandes', icon: Inbox }]} />
      {tab === 'dashboard' && (
        <div className="space-y-5">
          <ConnectCard />
          <Performance account="lash" />
        </div>
      )}
      {tab === 'planner' && <ContentPlanner account="lash" />}
      {tab === 'library' && <ContentLibrary account="lash" />}
      {tab === 'analytics' && <Analytics />}
      {tab === 'inbox' && (
        <div className="space-y-3">
          <Card className="p-4 text-sm text-muted">L’accès aux messages privés Instagram nécessite des autorisations Meta supplémentaires (instagram_business_manage_messages) et une validation de l’app. En attendant, note ici les demandes reçues en DM, WhatsApp ou SMS.</Card>
          <ResourceTable resource="inboxRequest" title="Demandes clientes" defaults={{ date: today(), channel: 'instagram', status: 'new' }} filterField="status" />
        </div>
      )}
    </Page>
  );
}
