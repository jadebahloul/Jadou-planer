import * as React from 'react';
import { Plus, Search, Inbox, Pencil, Trash2, Download } from 'lucide-react';
import { getResource, type FieldDef, type ResourceName } from '@shared/registry';
import { useList, useRemove, type ListParams, type Row } from '@/lib/hooks';
import { Button, Card, Empty, Input, Menu, Skeleton, useConfirm } from '@/components/ui';
import { DisplayValue, refTitle } from './fields';
import { useRecordDialog, type OpenRecordOpts } from './RecordDialog';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

/** Map of id → title for every ref field shown */
export function useRefMaps(fields: [string, FieldDef][]) {
  const refs = Array.from(new Set(fields.filter(([, f]) => f.type === 'ref').map(([, f]) => f.ref!)));
  const lists = refs.map((r) => useList(r as ResourceName).data ?? []); // eslint-disable-line react-hooks/rules-of-hooks
  return React.useMemo(() => {
    const out: Record<string, Map<number, string>> = {};
    refs.forEach((r, i) => (out[r] = new Map(lists[i].map((row) => [row.id, refTitle(r, row)]))));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lists.map((l) => l.map((r) => r.updatedAt)))]);
}

export interface ResourceTableProps {
  resource: ResourceName;
  params?: ListParams;
  columns?: string[];
  title?: React.ReactNode;
  defaults?: Record<string, unknown>;
  dialog?: Partial<OpenRecordOpts>;
  filterField?: string;
  emptyText?: string;
  addLabel?: string;
  rowsFilter?: (r: Row) => boolean;
  compact?: boolean;
  className?: string;
  extraActions?: (r: Row) => { label: string; onSelect: () => void; icon?: any }[];
  exportable?: boolean;
}

export function ResourceTable({ resource, params, columns, title, defaults, dialog, filterField, emptyText, addLabel, rowsFilter, compact, className, extraActions, exportable }: ResourceTableProps) {
  const def = getResource(resource)!;
  const { data, isLoading } = useList(resource, params);
  const open = useRecordDialog();
  const remove = useRemove(resource);
  const confirm = useConfirm();
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState<string | null>(null);
  const cols: [string, FieldDef][] = (columns ?? Object.entries(def.fields).filter(([, f]) => f.list).map(([k]) => k)).map((k) => [k, def.fields[k]] as [string, FieldDef]).filter(([, f]) => f);
  const refs = useRefMaps(cols);
  const filterDef = filterField ? def.fields[filterField] : undefined;

  const rows = (data ?? [])
    .filter((r) => !rowsFilter || rowsFilter(r))
    .filter((r) => !filter || String(r[filterField!]) === filter)
    .filter((r) => !q || def.search.concat(def.titleField).some((f) => String(r[f] ?? '').toLowerCase().includes(q.toLowerCase())));

  const edit = (r: Row) => open({ resource, id: r.id, ...dialog });
  const add = () => open({ resource, defaults, ...dialog });

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
        {title && <h3 className="mr-auto text-[15px] font-semibold">{title}</h3>}
        <div className={cn('relative', !title && 'mr-auto')}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="h-9 w-44 rounded-full py-1.5 pl-8 text-xs sm:w-56" />
        </div>
        {exportable && (
          <a href={`/api/export/csv/${resource}`} className="chip">
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        )}
        <Button size="sm" icon={Plus} onClick={add}>
          {addLabel ?? 'Ajouter'}
        </Button>
      </div>
      {filterDef?.options && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-line/70 px-4 py-2.5 sm:px-5">
          <button className={cn('chip', !filter && 'chip-active')} onClick={() => setFilter(null)}>
            Tout
          </button>
          {filterDef.options.map((o) => (
            <button key={o.value} className={cn('chip shrink-0', filter === o.value && 'chip-active')} onClick={() => setFilter(filter === o.value ? null : o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {isLoading ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty icon={Inbox} title={q || filter ? 'Aucun résultat' : 'Rien pour l’instant'} text={emptyText ?? `Ajoutez votre premier élément : ${def.label.toLowerCase()}.`} action={!q && !filter ? <Button size="sm" variant="soft" icon={Plus} onClick={add}>{addLabel ?? 'Ajouter'}</Button> : undefined} />
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {cols.map(([k, f]) => (
                    <th key={k} className={cn('eyebrow whitespace-nowrap px-5 py-3 font-semibold', ['money', 'number', 'int'].includes(f.type) && 'text-right')}>
                      {f.label}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => edit(r)} className="cursor-pointer border-t border-line/60 transition hover:bg-petal/40">
                    {cols.map(([k, f], i) => (
                      <td key={k} className={cn('px-5', compact ? 'py-2' : 'py-3', i === 0 && 'font-medium', ['money', 'number', 'int'].includes(f.type) && 'text-right')}>
                        <DisplayValue field={f} value={r[k]} refs={f.type === 'ref' ? refs[f.ref!] : undefined} />
                      </td>
                    ))}
                    <td className="pr-3" onClick={(e) => e.stopPropagation()}>
                      <Menu
                        items={[
                          ...(extraActions?.(r) ?? []),
                          { label: 'Modifier', icon: Pencil, onSelect: () => edit(r) },
                          { label: 'Supprimer', icon: Trash2, danger: true, onSelect: async () => (await confirm({ title: 'Supprimer ?', text: refTitle(resource, r), confirm: 'Supprimer', danger: true })) && remove.mutate(r.id) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* mobile cards */}
          <div className="divide-y divide-line/60 md:hidden">
            {rows.map((r) => (
              <button key={r.id} onClick={() => edit(r)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left active:bg-petal/40">
                <div className="font-medium">
                  <DisplayValue field={cols[0][1]} value={r[cols[0][0]]} refs={cols[0][1].type === 'ref' ? refs[cols[0][1].ref!] : undefined} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {cols.slice(1).map(([k, f]) => (r[k] != null && r[k] !== '' ? <span key={k} className="inline-flex items-center gap-1"><DisplayValue field={f} value={r[k]} refs={f.type === 'ref' ? refs[f.ref!] : undefined} /></span> : null))}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

export async function quickPatch(resource: string, id: number, data: Record<string, unknown>) {
  return api(`/r/${resource}/${id}`, { method: 'PATCH', body: data });
}
