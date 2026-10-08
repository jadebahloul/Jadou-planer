import * as React from 'react';
import { Plus, Images, Quote, Target } from 'lucide-react';
import { REGISTRY, optionLabel } from '@shared/registry';
import { useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Empty, Progress } from '@/components/ui';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { goalPct } from './Goals';
import { cn } from '@/lib/utils';

const CATS = REGISTRY.visionItem.fields.category.options;
const TONES = ['from-petal to-sand', 'from-sand to-blush/60', 'from-blush/50 to-petal', 'from-[#EDE5DD] to-[#F7E9EC]'];

export function VisionPage() {
  const { data: items = [] } = useList('visionItem');
  const { data: goals = [] } = useList('goal');
  const open = useRecordDialog();
  const [cat, setCat] = React.useState<string | null>(null);
  const list = items.filter((i) => !cat || i.category === cat);
  return (
    <Page>
      <PageHeader eyebrow="Lifestyle" title="Vision" accent="Board" subtitle="Business, money, fitness, career, real estate, travel, lifestyle — ce que je construis." coverKey="vision" variant={2} actions={<><Button icon={Plus} onClick={() => open({ resource: 'visionItem', defaults: { kind: 'image', category: cat ?? 'lifestyle' } })}>Photo</Button><Button variant="outline" icon={Quote} onClick={() => open({ resource: 'visionItem', defaults: { kind: 'quote', category: cat ?? 'lifestyle' } })}>Citation</Button></>} />
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <button className={cn('chip', !cat && 'chip-active')} onClick={() => setCat(null)}>Tout</button>
        {CATS.map((c) => <button key={c.value} className={cn('chip shrink-0', cat === c.value && 'chip-active')} onClick={() => setCat(c.value)}>{c.label}</button>)}
      </div>
      {list.length === 0 ? <Card><Empty icon={Images} title="Ton moodboard t’attend" text="Ajoute tes propres photos, citations et inspirations. Relie-les à tes objectifs pour voir leur progression." /></Card> : (
        <div className="columns-2 gap-4 md:columns-3 xl:columns-4 [&>*]:mb-4">
          {list.map((i, k) => {
            const goal = goals.find((g) => g.id === i.goalId);
            return (
              <button key={i.id} onClick={() => open({ resource: 'visionItem', id: i.id })} className="group relative block w-full break-inside-avoid overflow-hidden rounded-3xl text-left shadow-card transition hover:shadow-lift">
                {i.image ? (
                  <>
                    <img src={i.image} alt={i.title ?? ''} className="w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                    {(i.title || i.text) && <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/60 via-transparent p-4"><div className="text-white">{i.title && <div className="font-display text-2xl leading-tight">{i.title}</div>}{i.text && <div className="text-xs text-white/85">{i.text}</div>}</div></div>}
                  </>
                ) : (
                  <div className={cn('bg-gradient-to-br p-6', TONES[k % TONES.length], i.kind === 'quote' ? 'py-10' : '')}>
                    <div className="eyebrow mb-3 flex items-center gap-1.5 text-wine/70">{i.kind === 'quote' ? <Quote className="h-3 w-3" /> : <Target className="h-3 w-3" />}{optionLabel(CATS, i.category)}</div>
                    {i.kind === 'quote' ? <p className="font-display text-2xl italic leading-snug">“{i.text ?? i.title}”</p> : <><div className="font-display text-2xl">{i.title}</div>{i.text && <p className="mt-1 text-sm text-ink/70">{i.text}</p>}</>}
                  </div>
                )}
                {goal && <div className="bg-surface p-3"><div className="mb-1 flex justify-between text-[11px]"><span className="truncate">{goal.title}</span><span>{goalPct(goal)} %</span></div><Progress value={goalPct(goal)} height={4} /></div>}
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
