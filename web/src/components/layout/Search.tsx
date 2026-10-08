import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, CornerDownLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { ALL_ITEMS, RESOURCE_PAGE } from '@/lib/nav';
import { formatFr } from '@shared/dates';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn } from '@/lib/utils';
import type { ResourceName } from '@shared/registry';

interface Hit {
  resource: string;
  id: number;
  title: string;
  subtitle: string;
  date?: string | null;
}

const Ctx = React.createContext<() => void>(() => {});
export const useSearch = () => React.useContext(Ctx);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [sel, setSel] = React.useState(0);
  const nav = useNavigate();
  const openRecord = useRecordDialog();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => api<Hit[]>(`/search?q=${encodeURIComponent(q.trim())}`).then(setHits).catch(() => setHits([])), 160);
    return () => clearTimeout(t);
  }, [q]);

  const pages = q.trim() ? ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : ALL_ITEMS.slice(0, 6);
  const items = [...pages.map((p) => ({ kind: 'page' as const, p })), ...hits.map((h) => ({ kind: 'hit' as const, h }))];

  const go = (i: number) => {
    const it = items[i];
    if (!it) return;
    setOpen(false);
    setQ('');
    if (it.kind === 'page') nav(it.p.path);
    else {
      nav(RESOURCE_PAGE[it.h.resource] ?? '/');
      setTimeout(() => openRecord({ resource: it.h.resource as ResourceName, id: it.h.id }), 150);
    }
  };

  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-3xl border border-line bg-surface shadow-lift outline-none data-[state=open]:animate-fade-up">
            <Dialog.Title className="sr-only">Recherche globale</Dialog.Title>
            <Dialog.Description className="sr-only">Rechercher dans toute l’application</Dialog.Description>
            <div className="flex items-center gap-3 border-b border-line px-5">
              <SearchIcon className="h-5 w-5 text-muted" strokeWidth={1.6} />
              <input
                autoFocus
                value={q}
                onChange={(e) => (setQ(e.target.value), setSel(0))}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(items.length - 1, s + 1)));
                  if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
                  if (e.key === 'Enter') go(sel);
                }}
                placeholder="Rechercher une tâche, une cliente, un devoir, une dépense…"
                className="h-16 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70"
              />
              <kbd className="rounded-md border border-line px-1.5 text-[10px] text-muted">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {pages.length > 0 && <div className="eyebrow px-3 pb-1 pt-2">Pages</div>}
              {items.map((it, i) => (
                <React.Fragment key={i}>
                  {it.kind === 'hit' && i === pages.length && <div className="eyebrow px-3 pb-1 pt-3">Résultats</div>}
                  <button onMouseEnter={() => setSel(i)} onClick={() => go(i)} className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', sel === i && 'bg-petal/70')}>
                    {it.kind === 'page' ? (
                      <>
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-sunken text-wine">
                          <it.p.icon className="h-4 w-4" strokeWidth={1.7} />
                        </span>
                        <span className="text-sm font-medium">{it.p.label}</span>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{it.h.title}</div>
                        <div className="truncate text-xs text-muted">
                          {it.h.subtitle}
                          {it.h.date ? ` · ${formatFr(it.h.date)}` : ''}
                        </div>
                      </div>
                    )}
                    {sel === i && <CornerDownLeft className="ml-auto h-3.5 w-3.5 text-muted" />}
                  </button>
                </React.Fragment>
              ))}
              {q.trim().length >= 2 && hits.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted">Aucun élément trouvé pour « {q} »</div>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
