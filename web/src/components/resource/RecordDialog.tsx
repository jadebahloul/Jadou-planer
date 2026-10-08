import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { getResource, type ResourceName } from '@shared/registry';
import { api, ApiError } from '@/lib/api';
import { useInvalidate, type Row } from '@/lib/hooks';
import { Button, Modal, useConfirm } from '@/components/ui';
import { FieldInput } from './fields';
import { toast } from 'sonner';

export interface OpenRecordOpts {
  resource: ResourceName;
  id?: number;
  defaults?: Record<string, unknown>;
  title?: string;
  /** limit/ordering of visible fields */
  fields?: string[];
  hide?: string[];
  onSaved?: (row: Row) => void;
}

const Ctx = React.createContext<(o: OpenRecordOpts) => void>(() => {});
export const useRecordDialog = () => React.useContext(Ctx);

export function RecordDialogProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = React.useState<OpenRecordOpts | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const invalidate = useInvalidate();
  const confirm = useConfirm();

  const open = React.useCallback(async (o: OpenRecordOpts) => {
    const def = getResource(o.resource)!;
    setErrors({});
    setOpts(o);
    if (o.id) {
      setLoading(true);
      try {
        const row = await api<Row>(`/r/${o.resource}/${o.id}`);
        setValues(row);
      } finally {
        setLoading(false);
      }
    } else {
      const init: Record<string, any> = {};
      for (const [k, f] of Object.entries(def.fields)) if (f.default !== undefined) init[k] = f.default;
      setValues({ ...init, ...(o.defaults ?? {}) });
    }
  }, []);

  const def = opts ? getResource(opts.resource) : undefined;
  const fieldEntries = def
    ? (opts!.fields ? opts!.fields.map((k) => [k, def.fields[k]] as const).filter(([, f]) => f) : Object.entries(def.fields)).filter(([k, f]) => (!f.hidden || (f.type === 'json' && ['subtasks', 'steps', 'checklist'].includes(k))) && !opts!.hide?.includes(k))
    : [];

  const save = async () => {
    if (!opts) return;
    setSaving(true);
    setErrors({});
    try {
      const payload: Record<string, unknown> = {};
      for (const [k] of Object.entries(def!.fields)) if (k in values) payload[k] = values[k];
      const row = opts.id ? await api<Row>(`/r/${opts.resource}/${opts.id}`, { method: 'PATCH', body: payload }) : await api<Row>(`/r/${opts.resource}`, { method: 'POST', body: payload });
      invalidate();
      toast.success(opts.id ? 'Modifications enregistrées ♡' : `${def!.label} ajouté·e ♡`);
      opts.onSaved?.(row);
      setOpts(null);
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!opts?.id) return;
    if (!(await confirm({ title: 'Supprimer cet élément ?', text: 'Cette action est définitive (les éléments liés générés automatiquement seront aussi retirés).', confirm: 'Supprimer', danger: true }))) return;
    await api(`/r/${opts.resource}/${opts.id}`, { method: 'DELETE' });
    invalidate();
    toast('Supprimé');
    setOpts(null);
  };

  return (
    <Ctx.Provider value={open}>
      {children}
      <Modal
        open={!!opts}
        onOpenChange={(o) => !o && setOpts(null)}
        title={opts?.title ?? (opts?.id ? `Modifier · ${def?.label}` : `Nouveau · ${def?.label}`)}
        size={fieldEntries.length > 8 ? 'lg' : 'md'}
        footer={
          <>
            {opts?.id && (
              <Button variant="danger" icon={Trash2} onClick={remove} className="mr-auto">
                Supprimer
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpts(null)}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving}>
              Enregistrer
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-muted">Chargement…</div>
        ) : (
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {fieldEntries.map(([k, f]) => (
              <FieldInput key={k} name={k} field={f} value={values[k]} error={errors[k]} onChange={(v) => setValues((s) => ({ ...s, [k]: v }))} />
            ))}
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
