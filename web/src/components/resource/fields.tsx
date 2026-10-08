import * as React from 'react';
import { ImagePlus, Loader2, Plus, Trash2, X, Check, GripVertical, FileText } from 'lucide-react';
import { getResource, optionColor, optionLabel, type FieldDef, type ResourceName } from '@shared/registry';
import { formatFr } from '@shared/dates';
import { eur } from '@shared/finance';
import { useList, type Row } from '@/lib/hooks';
import { uploadFiles } from '@/lib/api';
import { cn, uid, nf } from '@/lib/utils';
import { Badge, Input, Rating, Select, Switch, Textarea } from '@/components/ui';
import { toast } from 'sonner';

export function refTitle(resource: string, row: Row | undefined): string {
  if (!row) return '';
  const def = getResource(resource);
  if (!def) return String(row.id);
  if (resource === 'lashAppointment') return `${formatFr(row.start, { time: true })}`;
  const v = row[def.titleField];
  if (def.fields[def.titleField]?.type === 'date') return formatFr(v, { year: true });
  return String(v ?? `#${row.id}`);
}

export function RefSelect({ resource, value, onChange, placeholder, id }: { resource: string; value: unknown; onChange: (v: number | null) => void; placeholder?: string; id?: string }) {
  const { data = [] } = useList(resource as ResourceName);
  return (
    <Select id={id} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{placeholder ?? '—'}</option>
      {data.map((r) => (
        <option key={r.id} value={r.id}>
          {refTitle(resource, r)}
        </option>
      ))}
    </Select>
  );
}

export function ImageField({ value, onChange, accept = 'image/*,application/pdf,audio/*,video/*,.doc,.docx,.xls,.xlsx,.csv,.txt' }: { value: string | null | undefined; onChange: (v: string | null) => void; accept?: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const isImg = value && (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(value) || /^https?:/.test(value));
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const [f] = await uploadFiles(files);
      onChange(f.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-line bg-sunken">
          {isImg ? <img src={value} alt="" className="h-36 w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> : (
            <a href={value} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-sm text-wine underline">
              <FileText className="h-4 w-4" /> Ouvrir le fichier
            </a>
          )}
          <button type="button" onClick={() => onChange(null)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-muted shadow hover:text-bad" aria-label="Retirer">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files);
          }}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-sunken/50 text-xs text-muted transition hover:border-wine/40 hover:text-wine"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.5} />}
          Déposer ou choisir un fichier
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files)} />
      {!value && (
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…ou coller un lien https://" className="py-1.5 text-xs" />
          {url && (
            <button type="button" className="chip" onClick={() => (onChange(url.trim()), setUrl(''))}>
              OK
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface CheckItem {
  id: string;
  title: string;
  done?: boolean;
}

export function ChecklistEditor({ value, onChange, placeholder = 'Ajouter un élément…', checkable = true }: { value: CheckItem[] | null | undefined; onChange: (v: CheckItem[]) => void; placeholder?: string; checkable?: boolean }) {
  const items = Array.isArray(value) ? value : [];
  const [draft, setDraft] = React.useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { id: uid(), title: draft.trim(), done: false }]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.id} className="group flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-sunken/60">
          <GripVertical className="h-3.5 w-3.5 text-line" />
          {checkable && (
            <button type="button" onClick={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border transition', it.done ? 'border-wine bg-wine text-onwine' : 'border-line')}>
              {it.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
          )}
          <input value={it.title} onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))} className={cn('min-w-0 flex-1 bg-transparent text-sm outline-none', it.done && 'text-muted line-through')} />
          <button type="button" onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="opacity-0 transition group-hover:opacity-100" aria-label="Supprimer">
            <Trash2 className="h-3.5 w-3.5 text-muted hover:text-bad" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={placeholder} className="py-2" />
        <button type="button" onClick={add} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-petal text-wine" aria-label="Ajouter">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const CHECKLIST_FIELDS: Record<string, string> = { subtasks: 'Sous-tâches', steps: 'Étapes', checklist: 'Checklist' };

export function FieldInput({ name, field, value, onChange, error }: { name: string; field: FieldDef; value: any; onChange: (v: any) => void; error?: string }) {
  const id = `f-${name}`;
  let control: React.ReactNode;
  switch (field.type) {
    case 'text':
      control = <Textarea id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
      break;
    case 'number':
    case 'money':
    case 'int':
      control = (
        <div className="relative">
          <Input id={id} type="number" inputMode="decimal" step={field.type === 'int' ? 1 : 'any'} value={value ?? ''} min={field.min} max={field.max} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} placeholder={field.placeholder} className={field.type === 'money' ? 'pr-8' : ''} />
          {field.type === 'money' && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>}
        </div>
      );
      break;
    case 'boolean':
      control = <Switch checked={!!value} onChange={onChange} label={field.label} />;
      break;
    case 'date':
      control = <Input id={id} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
      break;
    case 'datetime':
      control = <Input id={id} type="datetime-local" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
      break;
    case 'time':
      control = <Input id={id} type="time" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
      break;
    case 'enum':
      control =
        (field.options?.length ?? 0) <= 4 && !field.required ? (
          <div className="flex flex-wrap gap-1.5">
            {field.options!.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(value === o.value ? null : o.value)} className={cn('chip', value === o.value && 'chip-active')}>
                {o.color && value !== o.value && <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} />}
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
            {!field.required && <option value="">—</option>}
            {field.options!.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        );
      break;
    case 'ref':
      control = <RefSelect id={id} resource={field.ref!} value={value} onChange={onChange} />;
      break;
    case 'rating':
      control = <Rating value={value} onChange={onChange} max={field.max ?? 5} size={22} />;
      break;
    case 'color':
      control = (
        <div className="flex items-center gap-2">
          {['#713F4B', '#C98B9B', '#D4876C', '#C9A35F', '#8BA77F', '#5E8C8A', '#6C8EBF', '#8E7DBE'].map((c) => (
            <button key={c} type="button" onClick={() => onChange(c)} className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition', value === c && 'ring-2 ring-ink/40')} style={{ background: c }} aria-label={c} />
          ))}
          <input type="color" value={value ?? '#713F4B'} onChange={(e) => onChange(e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent" />
        </div>
      );
      break;
    case 'image':
      control = <ImageField value={value} onChange={onChange} />;
      break;
    case 'tags':
      control = <Input id={id} value={Array.isArray(value) ? value.join(', ') : value ?? ''} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trimStart()))} placeholder="tag1, tag2…" />;
      break;
    case 'json':
      control = CHECKLIST_FIELDS[name] ? <ChecklistEditor value={value} onChange={onChange} /> : null;
      break;
    default:
      control = <Input id={id} type={field.type === 'url' ? 'url' : 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  }
  if (control === null) return null;
  return (
    <div className={cn(field.wide || field.type === 'text' || field.type === 'json' || field.type === 'image' ? 'sm:col-span-2' : '')}>
      {field.type !== 'boolean' && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
          {field.type === 'json' ? CHECKLIST_FIELDS[name] : field.label}
          {field.required && <span className="text-wine"> *</span>}
        </label>
      )}
      {control}
      {field.help && <p className="mt-1 text-[11px] text-muted">{field.help}</p>}
      {error && <p className="mt-1 text-[11px] font-medium text-bad">{error}</p>}
    </div>
  );
}

/** Read-only display of a field value */
export function DisplayValue({ field, value, refs }: { field: FieldDef; value: any; refs?: Map<number, string> }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted/60">—</span>;
  switch (field.type) {
    case 'money':
      return <span className="num">{eur(value, 2)}</span>;
    case 'number':
      return <span className="num">{nf(value, 2)}</span>;
    case 'date':
      return <span>{formatFr(value, { year: value.slice(0, 4) !== String(new Date().getFullYear()) })}</span>;
    case 'datetime':
      return <span>{formatFr(value, { time: true })}</span>;
    case 'boolean':
      return value ? <Check className="h-4 w-4 text-wine" /> : <span className="text-muted/60">—</span>;
    case 'enum': {
      const c = optionColor(field.options, value);
      return <Badge color={c}>{optionLabel(field.options, value)}</Badge>;
    }
    case 'ref':
      return <span>{refs?.get(value) ?? `#${value}`}</span>;
    case 'rating':
      return <Rating value={value} size={13} />;
    case 'tags':
      return <span className="text-muted">{(value as string[]).join(', ')}</span>;
    case 'url':
      return (
        <a href={value} target="_blank" rel="noreferrer" className="text-wine underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
          Lien ↗
        </a>
      );
    case 'image':
      return <img src={value} alt="" className="h-9 w-9 rounded-lg object-cover" />;
    case 'color':
      return <span className="inline-block h-4 w-4 rounded-full" style={{ background: value }} />;
    default:
      return <span className="line-clamp-2">{String(value)}</span>;
  }
}
