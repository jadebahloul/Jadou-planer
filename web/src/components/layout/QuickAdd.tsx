import * as React from 'react';
import { Sparkles, ListTodo, CalendarPlus, Receipt, Dumbbell, Heart, Lightbulb, StickyNote, Target, FolderPlus, Gem, Droplets, ArrowRight } from 'lucide-react';
import { getResource, type ResourceName } from '@shared/registry';
import { today } from '@shared/dates';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/hooks';
import { Button, Modal, Input } from '@/components/ui';
import { FieldInput } from '@/components/resource/fields';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Ctx = React.createContext<() => void>(() => {});
export const useQuickAdd = () => React.useContext(Ctx);

const SHORTCUTS: { label: string; icon: any; resource: ResourceName; defaults?: () => Record<string, unknown> }[] = [
  { label: 'Tâche', icon: ListTodo, resource: 'task', defaults: () => ({ date: today() }) },
  { label: 'Rendez-vous', icon: CalendarPlus, resource: 'event', defaults: () => ({ start: `${today()}T10:00` }) },
  { label: 'Dépense', icon: Receipt, resource: 'transaction', defaults: () => ({ type: 'expense', date: today() }) },
  { label: 'RDV cils', icon: Gem, resource: 'lashAppointment', defaults: () => ({ start: `${today()}T10:00` }) },
  { label: 'Séance', icon: Dumbbell, resource: 'workoutSession', defaults: () => ({ date: today(), status: 'planned' }) },
  { label: 'Wishlist', icon: Heart, resource: 'wishlistItem' },
  { label: 'Idée', icon: Lightbulb, resource: 'note', defaults: () => ({ kind: 'idea' }) },
  { label: 'Note', icon: StickyNote, resource: 'note', defaults: () => ({ kind: 'note' }) },
  { label: 'Objectif', icon: Target, resource: 'goal' },
  { label: 'Ressource', icon: FolderPlus, resource: 'resource' },
  { label: 'Eau', icon: Droplets, resource: 'waterLog', defaults: () => ({ date: today(), ml: 250 }) },
];

const EXAMPLES = ['Resto avec Inès 24 € hier', 'RDV cils vendredi 14h avec Sarah, remplissage', 'Rendre le dossier de stratégie digitale le 15/11', 'Coiffeur samedi à 11h', 'Ajoute ce parfum à ma wishlist : Libre YSL 120 €', 'Idée business : box beauté pour étudiantes'];

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [proposal, setProposal] = React.useState<{ resource: ResourceName; data: Record<string, any>; summary: string; hints?: Record<string, string> } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const openRecord = useRecordDialog();
  const invalidate = useInvalidate();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const reset = () => {
    setText('');
    setProposal(null);
  };

  const analyse = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setProposal(await api('/ai/capture', { body: { text } }));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      await api('/ai/capture/save', { body: proposal });
      invalidate();
      toast.success(`${getResource(proposal.resource)!.label} enregistré·e ♡`);
      reset();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const def = proposal ? getResource(proposal.resource) : null;
  const keyFields = def ? Object.entries(def.fields).filter(([k, f]) => !f.hidden && (f.required || k in proposal!.data) && f.type !== 'text').slice(0, 8) : [];

  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      <Modal
        open={open}
        onOpenChange={(o) => (setOpen(o), !o && reset())}
        title="Quick Capture"
        description="Écris librement — Jadou Planner propose la bonne catégorie, tu valides."
        size="lg"
        footer={
          proposal ? (
            <>
              <Button variant="ghost" onClick={() => setProposal(null)}>
                Modifier la phrase
              </Button>
              <Button onClick={save} loading={busy}>
                Confirmer & enregistrer
              </Button>
            </>
          ) : undefined
        }
      >
        {!proposal ? (
          <div className="space-y-5">
            <div className="relative">
              <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-wine" />
              <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && analyse()} placeholder="Ex. « Courses Monoprix 32,40 € » ou « Séance fessiers demain 18h »" className="h-14 rounded-2xl pl-11 pr-28 text-[15px]" />
              <Button size="sm" className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={analyse} loading={busy} disabled={!text.trim()}>
                Analyser <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => setText(e)} className="chip">
                  {e}
                </button>
              ))}
            </div>
            <div>
              <div className="eyebrow mb-3">Ou ajouter directement</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SHORTCUTS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      setOpen(false);
                      openRecord({ resource: s.resource, defaults: s.defaults?.() });
                    }}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line/80 bg-surface px-2 py-3 text-xs font-medium text-ink transition hover:-translate-y-0.5 hover:border-wine/30 hover:shadow-card"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-petal text-wine">
                      <s.icon className="h-4 w-4" strokeWidth={1.7} />
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl bg-petal/60 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-wine text-onwine">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <div className="eyebrow text-wine/80">Catégorie proposée · {def!.label}</div>
                <div className="font-medium">{proposal.summary}</div>
              </div>
            </div>
            {proposal.hints?.clientName !== undefined && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Cliente (retrouvée ou créée automatiquement)</label>
                <Input value={proposal.hints.clientName} onChange={(e) => setProposal({ ...proposal, hints: { ...proposal.hints, clientName: e.target.value } })} placeholder="Nom de la cliente" />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {keyFields
                .filter(([k]) => !(proposal.resource === 'lashAppointment' && k === 'clientId' && proposal.hints?.clientName))
                .map(([k, f]) => (
                  <FieldInput key={k} name={k} field={f} value={proposal.data[k]} onChange={(v) => setProposal({ ...proposal, data: { ...proposal.data, [k]: v } })} />
                ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted">Pas la bonne catégorie ?</span>
              {(['task', 'event', 'transaction', 'note', 'goal', 'wishlistItem'] as ResourceName[])
                .filter((r) => r !== proposal.resource)
                .map((r) => (
                  <button
                    key={r}
                    className={cn('chip py-1')}
                    onClick={() => {
                      const title = text;
                      const base: Record<string, Record<string, unknown>> = {
                        task: { title, date: today(), status: 'todo' },
                        event: { title, start: `${today()}T10:00` },
                        transaction: { label: title, type: 'expense', date: today(), amount: proposal.data.amount ?? null },
                        note: { content: title, kind: 'note' },
                        goal: { title, status: 'active' },
                        wishlistItem: { name: title, status: 'want' },
                      };
                      setProposal({ resource: r, data: base[r], summary: `${getResource(r)!.label} · ${title}` });
                    }}
                  >
                    {getResource(r)!.label}
                  </button>
                ))}
            </div>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
