import * as React from 'react';
import { Plus, NotebookPen, Search } from 'lucide-react';
import { today, formatFr } from '@shared/dates';
import { useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Input, Rating } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn } from '@/lib/utils';

const MOODS = ['', '😔', '😕', '😌', '😊', '🥰'];

export function JournalPage() {
  const { data: entries = [] } = useList('journalEntry');
  const open = useRecordDialog();
  const [q, setQ] = React.useState('');
  const [tag, setTag] = React.useState<string | null>(null);
  const tags = Array.from(new Set(entries.flatMap((e) => e.tags ?? []))).filter(Boolean);
  const list = entries.filter((e) => (!q || `${e.title} ${e.content}`.toLowerCase().includes(q.toLowerCase())) && (!tag || (e.tags ?? []).includes(tag)));
  return (
    <Page className="max-w-5xl">
      <PageHeader eyebrow="Lifestyle" title="Personal" accent="Journal" subtitle="Un espace privé, stocké uniquement sur ton ordinateur." coverKey="journal" variant={1} actions={<Button icon={Plus} onClick={() => open({ resource: 'journalEntry', defaults: { date: today() } })}>Écrire</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans mon journal…" className="w-64 rounded-full pl-8" />
        </div>
        {tags.map((t) => (
          <button key={t} className={cn('chip', tag === t && 'chip-active')} onClick={() => setTag(tag === t ? null : t)}>
            #{t}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty icon={NotebookPen} title="Page blanche" text="Note ce que tu as ressenti, accompli ou appris aujourd’hui." action={<Button variant="soft" onClick={() => open({ resource: 'journalEntry', defaults: { date: today() } })}>Écrire ma première page</Button>} />
        </Card>
      ) : (
        <div className="relative space-y-4 border-l border-line pl-6">
          {list.map((e) => (
            <div key={e.id} className="relative">
              <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-surface bg-blush" />
              <Card hover className="cursor-pointer overflow-hidden sm:flex" onClick={() => open({ resource: 'journalEntry', id: e.id })}>
                {e.photo && <img src={e.photo} alt="" className="h-48 w-full object-cover sm:h-auto sm:w-48" />}
                <div className="p-5">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                    <span className="capitalize">{formatFr(e.date, { weekday: true, year: true })}</span>
                    {e.mood ? <span className="text-base">{MOODS[e.mood]}</span> : null}
                  </div>
                  {e.title && <div className="font-display text-2xl">{e.title}</div>}
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-ink/80">{e.content}</p>
                  {(e.tags ?? []).length > 0 && <div className="mt-2 text-xs text-wine">{(e.tags as string[]).map((t) => `#${t}`).join(' ')}</div>}
                  {e.mood ? <Rating value={e.mood} size={12} /> : null}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
