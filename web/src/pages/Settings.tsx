import * as React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { User, Palette, Bell, Plug, ShieldCheck, Download, Upload, Lock, Unlock, Trash2, RotateCcw, HardDrive, Cpu, Cloud, Camera, KeyRound, Eye, EyeOff, FileDown } from 'lucide-react';
import { RESOURCE_NAMES, getResource } from '@shared/registry';
import { useApi, useList, useSettings, useSaveSetting, useRemove, useInvalidate } from '@/lib/hooks';
import { api } from '@/lib/api';
import { NAV, CORE_KEYS } from '@/lib/nav';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Input, Label, Switch, Select, Badge, Empty, useConfirm } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'personalization', label: 'Personalization', icon: Palette },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'privacy', label: 'Data & Privacy', icon: ShieldCheck },
];

function useSettingForm(key: string) {
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const value = settings?.[key] ?? {};
  const set = (patch: Record<string, unknown>, quiet = false) => save.mutate({ key, value: { ...value, ...patch } }, { onSuccess: () => !quiet && toast.success('Enregistré ♡') });
  return { value, set, settings };
}

function Profile() {
  const { value, set } = useSettingForm('profile');
  const [pw, setPw] = React.useState({ current: '', next: '' });
  const field = (k: string, label: string) => <div><Label>{label}</Label><Input defaultValue={value[k] ?? ''} key={value[k]} onBlur={(e) => e.target.value !== (value[k] ?? '') && set({ [k]: e.target.value })} /></div>;
  return (
    <div className="space-y-5">
      <Card className="p-5"><div className="grid gap-4 sm:grid-cols-2">{field('name', 'Prénom')}{field('nickname', 'Surnom (affiché dans le dashboard)')}{field('school', 'Études')}{field('job', 'Alternance')}</div></Card>
      <Card className="p-5">
        <CardHeader icon={KeyRound} title="Mot de passe local" className="mb-4 px-0 pt-0" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input type="password" placeholder="Mot de passe actuel" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <Input type="password" placeholder="Nouveau mot de passe" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <Button onClick={async () => { try { await api('/auth/password', { body: pw }); toast.success('Mot de passe modifié'); setPw({ current: '', next: '' }); } catch (e) { toast.error((e as Error).message); } }}>Changer</Button>
        </div>
      </Card>
    </div>
  );
}

function Personalization() {
  const { value: theme, set: setTheme, settings } = useSettingForm('theme');
  const save = useSaveSetting();
  const hidden: string[] = settings?.hiddenModules ?? [];
  const palettes = [
    { v: 'rose', label: 'Rose poudré', colors: ['#FAF8F6', '#EBCBD0', '#713F4B'] },
    { v: 'champagne', label: 'Champagne', colors: ['#F9F6F0', '#E8D6BE', '#7D5434'] },
    { v: 'nuit', label: 'Nuit bordeaux', colors: ['#181517', '#784654', '#E2A0B2'] },
  ];
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="eyebrow mb-3">Thème</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {palettes.map((p) => (
            <button key={p.v} onClick={() => { setTheme({ palette: p.v }, true); try { localStorage.setItem('jadou-theme', p.v); } catch { /* */ } }} className={cn('rounded-2xl border p-4 text-left transition', (theme.palette ?? 'rose') === p.v ? 'border-wine ring-2 ring-wine/20' : 'border-line hover:border-wine/30')}>
              <div className="mb-3 flex gap-1.5">{p.colors.map((c) => <span key={c} className="h-8 w-8 rounded-full border border-line" style={{ background: c }} />)}</div>
              <div className="font-medium">{p.label}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={() => setTheme({ covers: {}, headerPhoto: null })}>Retirer toutes mes photos de couverture</Button>
        </div>
      </Card>
      <Card className="p-5">
        <div className="eyebrow mb-1">Modules affichés</div>
        <p className="mb-4 text-xs text-muted">Masque les modules que tu n’utilises pas (tes données sont conservées). La disposition du dashboard se personnalise directement depuis le dashboard (« Personnaliser »).</p>
        <div className="space-y-4">
          {NAV.filter((g) => g.label !== 'Settings').map((g) => (
            <div key={g.label}>
              <div className="mb-2 text-sm font-semibold">{g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((i) => {
                  const off = hidden.includes(i.key);
                  const core = CORE_KEYS.has(i.key);
                  return <button key={i.key} disabled={core} onClick={() => save.mutate({ key: 'hiddenModules', value: off ? hidden.filter((h) => h !== i.key) : [...hidden, i.key] })} className={cn('chip', !off && 'chip-active', core && 'opacity-60')}>{off ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{i.label}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Notifications() {
  const { value, set } = useSettingForm('notifications');
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  return (
    <Card className="space-y-4 p-5">
      <Switch checked={!!value.enabled} onChange={(v) => set({ enabled: v })} label="Rappels intelligents (cloche en haut à droite)" />
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={!!value.browser} onChange={async (v) => { if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') await Notification.requestPermission(); set({ browser: v }); }} label="Notifications du navigateur (quand l’app est ouverte)" />
        <Badge>{perm === 'granted' ? 'Autorisées' : perm === 'denied' ? 'Bloquées par le navigateur' : 'Non demandées'}</Badge>
      </div>
      <Switch checked={!!value.overdueTasks} onChange={(v) => set({ overdueTasks: v })} label="Tâches en retard" />
      <Switch checked={!!value.waterReminder} onChange={(v) => set({ waterReminder: v })} label="Rappel d’hydratation (après 15 h si < 50 %)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Devoirs : prévenir X jours avant</Label><Input type="number" defaultValue={value.homeworkDays ?? 2} onBlur={(e) => set({ homeworkDays: Number(e.target.value) || 2 })} /></div>
        <div><Label>Rendez-vous cils : alerte X minutes avant</Label><Input type="number" defaultValue={value.appointmentMinutes ?? 60} onBlur={(e) => set({ appointmentMinutes: Number(e.target.value) || 60 })} /></div>
      </div>
      <p className="text-xs text-muted">Rappels couverts : rendez-vous (selon le rappel de chaque événement), devoirs, TOEIC du jour, séance du jour, échéances financières (événements catégorie Finance), Airbnb (arrivées/départs), objectifs proches, stock bas. Les rappels sont calculés tant que Jadou Planner est ouvert (aucun service externe).</p>
    </Card>
  );
}

function Integrations() {
  const { value: ai, set: setAi } = useSettingForm('ai');
  const { value: weather, set: setWeather } = useSettingForm('weather');
  const { data: status, refetch } = useApi<any>('/ai/status');
  const { data: ig, refetch: refetchIg } = useApi<any>('/instagram/status');
  const [igForm, setIgForm] = React.useState({ appId: '', appSecret: '', redirectUri: '' });
  const [city, setCity] = React.useState('');
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <CardHeader icon={Cpu} title="Jadou AI — IA locale (Ollama)" className="mb-4 px-0 pt-0" action={<Badge color={status?.available ? (status.modelInstalled ? '#3F8F5F' : '#B7791F') : '#8B8185'}>{status?.available ? (status.modelInstalled ? 'Connectée' : 'Modèle non installé') : 'Ollama non détecté'}</Badge>} />
        <Switch checked={!!ai.enabled} onChange={(v) => setAi({ enabled: v })} label="Utiliser un modèle local quand il est disponible" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label>Adresse Ollama (locale uniquement)</Label><Input defaultValue={ai.url} onBlur={(e) => setAi({ url: e.target.value })} /></div>
          <div><Label>Modèle</Label>{status?.models?.length ? <Select value={ai.model} onChange={(e) => setAi({ model: e.target.value })}>{status.models.map((m: string) => <option key={m}>{m}</option>)}{!status.models.includes(ai.model) && <option>{ai.model}</option>}</Select> : <Input defaultValue={ai.model} onBlur={(e) => setAi({ model: e.target.value })} />}</div>
        </div>
        <div className="mt-3"><Switch checked={!!ai.shareHealthData} onChange={(v) => setAi({ shareHealthData: v })} label="Autoriser l’IA locale à lire mes données de santé (eau, bien-être)" /></div>
        <div className="mt-4 rounded-2xl bg-sunken/70 p-4 text-xs leading-relaxed text-ink/80">
          <b>Installation (une fois)</b> : installe Ollama depuis ollama.com, puis dans un terminal : <code className="rounded bg-surface px-1">ollama pull {ai.model || 'llama3.1:8b'}</code>. Jadou AI l’utilisera automatiquement pour les conversations libres. Sans modèle, le mode local répond déjà aux demandes courantes (priorités, finances, planning…). <Button size="sm" variant="ghost" onClick={() => refetch()}>Tester la connexion</Button>
        </div>
      </Card>

      <Card className="p-5">
        <CardHeader icon={Camera} title="Instagram (API officielle Meta)" className="mb-4 px-0 pt-0" action={<Badge color={ig?.connected ? '#3F8F5F' : ig?.configured ? '#B7791F' : '#8B8185'}>{ig?.connected ? 'Connecté' : ig?.configured ? 'Configuré' : 'Non configuré'}</Badge>} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>App ID</Label><Input value={igForm.appId} placeholder={ig?.configured ? '••• (enregistré)' : ''} onChange={(e) => setIgForm({ ...igForm, appId: e.target.value })} /></div>
          <div><Label>App Secret (chiffré localement)</Label><Input type="password" value={igForm.appSecret} onChange={(e) => setIgForm({ ...igForm, appSecret: e.target.value })} /></div>
          <div><Label>URL de redirection HTTPS</Label><Input value={igForm.redirectUri} placeholder={ig?.redirectUri} onChange={(e) => setIgForm({ ...igForm, redirectUri: e.target.value })} /></div>
        </div>
        <Button className="mt-3" size="sm" onClick={async () => { try { await api('/instagram/config', { body: { ...igForm, appId: igForm.appId || undefined, redirectUri: igForm.redirectUri || undefined } }); toast.success('Configuration enregistrée'); setIgForm({ appId: '', appSecret: '', redirectUri: '' }); refetchIg(); } catch (e) { toast.error((e as Error).message); } }}>Enregistrer</Button>
        <p className="mt-3 text-xs text-muted">Nécessite un compte Instagram professionnel, une app Meta (produit « Instagram API with Instagram Login ») et une URL de redirection HTTPS se terminant par <code>/api/instagram/callback</code> pointant vers ce Jadou Planner (ex. tunnel HTTPS). Ensuite : Instagram Manager › Connect my Instagram.</p>
      </Card>

      <Card className="p-5">
        <CardHeader icon={Cloud} title="Météo (optionnelle)" className="mb-4 px-0 pt-0" />
        <Switch checked={!!weather.enabled} onChange={(v) => setWeather({ enabled: v })} label="Afficher la météo sur le dashboard (Open-Meteo, seule la ville est transmise)" />
        <div className="mt-3 flex gap-2"><Input placeholder={weather.city} value={city} onChange={(e) => setCity(e.target.value)} className="max-w-xs" /><Button size="sm" variant="outline" onClick={async () => { try { const r = await api<{ city: string }>('/weather/city', { body: { city } }); toast.success(`Ville : ${r.city}`); setCity(''); } catch (e) { toast.error((e as Error).message); } }}>Définir la ville</Button></div>
      </Card>

      <Card className="p-5 text-sm">
        <CardHeader icon={Plug} title="Banques" className="mb-2 px-0 pt-0" />
        <p className="text-muted">Saisie manuelle et import CSV (My Banks). Jadou Planner ne demande jamais tes identifiants bancaires. Une future synchronisation automatique devra passer par un prestataire agréé (agrégateur DSP2) — non incluse.</p>
      </Card>
    </div>
  );
}

function Vault() {
  const { data: st, refetch } = useApi<any>('/vault/status');
  const [pass, setPass] = React.useState('');
  const [files, setFiles] = React.useState<any[]>([]);
  const confirm = useConfirm();
  const load = React.useCallback(async () => setFiles(await api('/vault/files')), []);
  React.useEffect(() => { if (st?.unlocked) load().catch(() => {}); }, [st?.unlocked, load]);
  const unlock = async () => {
    try {
      await api(st?.configured ? '/vault/unlock' : '/vault/setup', { body: { passphrase: pass } });
      setPass('');
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const upload = async (f: FileList | null) => {
    if (!f?.length) return;
    for (const file of Array.from(f)) { const fd = new FormData(); fd.append('file', file); await api('/vault/files', { form: fd }); }
    load();
    toast.success('Chiffré et rangé dans le coffre ♡');
  };
  return (
    <Card className="p-5">
      <CardHeader icon={Lock} title="Document Vault" eyebrow="Chiffrement AES-256 · phrase secrète jamais stockée" className="mb-4 px-0 pt-0" action={st?.unlocked && <Button size="sm" variant="ghost" icon={Lock} onClick={async () => { await api('/vault/lock', { method: 'POST' }); setFiles([]); refetch(); }}>Verrouiller</Button>} />
      {!st?.unlocked ? (
        <div className="flex max-w-md gap-2">
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} placeholder={st?.configured ? 'Phrase secrète du coffre' : 'Choisis une phrase secrète (8+ caractères)'} />
          <Button icon={Unlock} onClick={unlock}>{st?.configured ? 'Ouvrir' : 'Créer le coffre'}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="chip cursor-pointer"><Upload className="h-3.5 w-3.5" />Ajouter des documents<input type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} /></label>
          {files.length === 0 && <p className="text-sm text-muted">Coffre vide (pièce d’identité, contrats, avis d’imposition, codes…).</p>}
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken">
              <Lock className="h-4 w-4 text-wine" />
              <span className="flex-1 truncate text-sm">{f.originalName}</span>
              <span className="text-xs text-muted">{Math.round(f.size / 1024)} Ko</span>
              <a href={`/api/vault/files/${f.id}`} className="chip py-1"><Download className="h-3 w-3" /></a>
              <button onClick={async () => { if (await confirm({ title: 'Supprimer ce document du coffre ?', danger: true, confirm: 'Supprimer' })) { await api(`/vault/files/${f.id}`, { method: 'DELETE' }); load(); } }} className="text-muted hover:text-bad" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <p className="text-[11px] text-muted">Le coffre se reverrouille après 10 minutes d’inactivité. Phrase oubliée = documents irrécupérables.</p>
        </div>
      )}
    </Card>
  );
}

function Privacy() {
  const { data: backups = [], refetch } = useApi<any[]>('/backup');
  const { value: backup, set: setBackup } = useSettingForm('backup');
  const { data: memory = [] } = useList('memory');
  const removeMem = useRemove('memory');
  const open = useRecordDialog();
  const confirm = useConfirm();
  const invalidate = useInvalidate();
  const [csv, setCsv] = React.useState('transaction');
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <CardHeader icon={ShieldCheck} title="Où sont mes données ?" className="mb-3 px-0 pt-0" />
        <p className="text-sm text-muted">Tout est stocké sur ton ordinateur, dans le dossier <code className="rounded bg-sunken px-1">data/</code> du projet (base SQLite, fichiers, sauvegardes, coffre chiffré). Le serveur n’écoute que sur 127.0.0.1 : il n’est pas accessible depuis Internet. Aucune donnée n’est transmise à un service externe sans action explicite de ta part (météo, Instagram).</p>
      </Card>
      <Card className="p-5">
        <CardHeader icon={HardDrive} title="Sauvegardes" eyebrow="Base de données + fichiers" className="mb-4 px-0 pt-0" action={<Button size="sm" onClick={async () => { await api('/backup', { method: 'POST' }); refetch(); toast.success('Sauvegarde créée ♡'); }}>Sauvegarder maintenant</Button>} />
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Switch checked={!!backup.auto} onChange={(v) => setBackup({ auto: v })} label="Sauvegarde automatique quotidienne" />
          <span className="flex items-center gap-2 text-sm text-muted">Conserver <Input type="number" className="w-20" defaultValue={backup.keep ?? 14} onBlur={(e) => setBackup({ keep: Number(e.target.value) || 14 })} /> sauvegardes auto</span>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {backups.length === 0 && <Empty title="Aucune sauvegarde" className="py-4" />}
          {backups.map((b) => (
            <div key={b.name} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-sunken">
              <HardDrive className="h-4 w-4 text-muted" />
              <span className="flex-1 truncate">{new Date(b.createdAt).toLocaleString('fr-FR')} <span className="text-xs text-muted">· {b.name.split('_').slice(1).join(' ')} · {Math.round(b.size / 1024)} Ko</span></span>
              <a href={`/api/backup/download/${b.name}`} className="chip py-1"><Download className="h-3 w-3" /></a>
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={async () => { if (await confirm({ title: 'Restaurer cette sauvegarde ?', text: 'Les données actuelles seront remplacées (une sauvegarde de sécurité est créée avant).', confirm: 'Restaurer', danger: true })) { await api('/backup/restore', { body: { name: b.name } }); invalidate(); toast.success('Sauvegarde restaurée'); refetch(); } }}>Restaurer</Button>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <CardHeader icon={FileDown} title="Exporter mes données" className="mb-4 px-0 pt-0" />
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/export/json"><Button variant="outline" icon={Download}>Tout exporter (JSON)</Button></a>
          <Select value={csv} onChange={(e) => setCsv(e.target.value)} className="w-56">{RESOURCE_NAMES.map((r) => <option key={r} value={r}>{getResource(r)!.plural}</option>)}</Select>
          <a href={`/api/export/csv/${csv}`}><Button variant="outline" icon={Download}>CSV</Button></a>
          <span className="text-xs text-muted">PDF : utilise « Exporter en PDF » dans Monthly Review (impression).</span>
        </div>
      </Card>
      <Card className="p-5">
        <CardHeader title="Mémoire de Jadou AI" eyebrow="Modifiable et supprimable à tout moment" className="mb-3 px-0 pt-0" action={<Button size="sm" variant="soft" onClick={() => open({ resource: 'memory' })}>Ajouter</Button>} />
        {memory.length === 0 ? <p className="text-sm text-muted">Aucune information mémorisée.</p> : memory.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-sunken">
            <span className="flex-1 cursor-pointer" onClick={() => open({ resource: 'memory', id: m.id })}>{m.content}</span>
            <button onClick={() => removeMem.mutate(m.id)} className="text-muted hover:text-bad" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Card>
      <Vault />
    </div>
  );
}

export function SettingsPage() {
  const { tab = 'profile' } = useParams();
  return (
    <Page className="max-w-5xl">
      <PageHeader eyebrow="Settings" title="Settings" accent={TABS.find((t) => t.key === tab)?.label} compact variant={1} />
      <div className="mb-5 flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => <NavLink key={t.key} to={`/settings/${t.key}`} className={({ isActive }) => cn('chip shrink-0', isActive && 'chip-active')}><t.icon className="h-3.5 w-3.5" />{t.label}</NavLink>)}
      </div>
      {tab === 'profile' && <Profile />}
      {tab === 'personalization' && <Personalization />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'integrations' && <Integrations />}
      {tab === 'privacy' && <Privacy />}
    </Page>
  );
}
