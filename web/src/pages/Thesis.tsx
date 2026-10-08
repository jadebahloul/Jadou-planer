import * as React from 'react';
import { Plus, BookOpenText, PenLine } from 'lucide-react';
import { REGISTRY, optionColor, TASK_STATUS } from '@shared/registry';
import { formatFr, today, diffDays } from '@shared/dates';
import { useList, useSettings, useSaveSetting } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Badge, Stat, Progress, Input } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { nf, pct } from '@/lib/utils';

const SECTIONS = REGISTRY.thesisItem.fields.type.options;

export function ThesisPage() {
  const { data: items = [] } = useList('thesisItem');
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const open = useRecordDialog();
  const goal = settings?.goals?.thesisWords ?? 15000;
  const words = items.reduce((s, i) => s + (i.words ?? 0), 0);
  const deadlines = items.filter((i) => i.date && i.status !== 'done').sort((a, b) => a.date.localeCompare(b.date));
  const doneRatio = pct(items.filter((i) => i.status === 'done').length, items.length);
  return (
    <Page>
      <PageHeader eyebrow="Studies & Career" title="Master" accent="Thesis" subtitle="Problématique, hypothèses, plan, bibliographie, recherches, entretiens, rédaction et échéances." coverKey="thesis" variant={2} actions={<Button icon={Plus} onClick={() => open({ resource: 'thesisItem' })}>Élément</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Avancement" value={`${doneRatio} %`} sub={<Progress value={doneRatio} className="mt-2" />} />
        <Stat label="Mots rédigés" value={nf(words)} icon={PenLine} sub={<span className="flex items-center gap-1">objectif <Input type="number" className="h-6 w-20 px-2 py-0 text-xs" defaultValue={goal} onBlur={(e) => save.mutate({ key: 'goals', value: { ...settings?.goals, thesisWords: Number(e.target.value) || 15000 } })} /></span>} />
        <Stat label="Sources" value={items.filter((i) => i.type === 'source').length} icon={BookOpenText} />
        <Stat label="Prochaine échéance" value={deadlines[0] ? `J-${diffDays(deadlines[0].date, today())}` : '—'} sub={deadlines[0]?.title} />
      </div>
      <Progress value={pct(words, goal)} className="mb-6" height={8} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => {
          const list = items.filter((i) => i.type === s.value);
          return (
            <Card key={s.value} className="flex flex-col">
              <CardHeader title={s.label} action={<button onClick={() => open({ resource: 'thesisItem', defaults: { type: s.value } })} className="text-muted hover:text-wine" aria-label="Ajouter"><Plus className="h-4 w-4" /></button>} />
              <div className="flex-1 space-y-1.5 p-3">
                {list.length === 0 && <div className="px-2 py-3 text-xs text-muted">Vide</div>}
                {list.map((i) => (
                  <button key={i.id} onClick={() => open({ resource: 'thesisItem', id: i.id })} className="block w-full rounded-xl border border-line/70 p-2.5 text-left hover:border-wine/30">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-sm font-medium">{i.title}</span>
                      <Badge color={optionColor(TASK_STATUS, i.status)}>{TASK_STATUS.find((x) => x.value === i.status)?.label}</Badge>
                    </div>
                    {i.content && <p className="mt-1 line-clamp-3 text-xs text-muted">{i.content}</p>}
                    <div className="mt-1 flex gap-2 text-[11px] text-muted">{i.date && <span>{formatFr(i.date)}</span>}{i.words ? <span>{nf(i.words)} mots</span> : null}{i.url && <a href={i.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-wine">lien ↗</a>}</div>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
