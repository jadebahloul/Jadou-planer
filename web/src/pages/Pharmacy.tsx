import * as React from 'react';
import { Plus, Megaphone, CalendarDays, ListChecks, Target, Sparkles } from 'lucide-react';
import { today, addDays, formatFr, relativeDay } from '@shared/dates';
import { eur } from '@shared/finance';
import { REGISTRY, optionLabel, optionColor } from '@shared/registry';
import { useList } from '@/lib/hooks';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, Segmented, Stat, Badge } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { TaskCheck } from '@/components/widgets';
import { GoalCard } from './Goals';
import { ContentPlanner, ContentLibrary, Performance } from '@/components/social';

export function PharmacyPage() {
  const [tab, setTab] = React.useState<'dashboard' | 'planner' | 'campaigns' | 'library' | 'performance'>('dashboard');
  const t0 = today();
  const { data: tasks = [] } = useList('task', { where: { category: 'alternance', status: { not: 'done' } } });
  const { data: posts = [] } = useList('contentPost', { where: { account: 'pharmacy', date: { gte: t0, lte: addDays(t0, 14) } } });
  const { data: campaigns = [] } = useList('campaign');
  const { data: events = [] } = useList('event', { where: { category: 'alternance', start: { gte: t0 } } });
  const { data: goals = [] } = useList('goal', { where: { category: 'career', status: 'active' } });
  const open = useRecordDialog();
  const activeCampaigns = campaigns.filter((c) => c.status !== 'done');
  return (
    <Page>
      <PageHeader eyebrow="Studies & Career" title="Pharmacy" accent="Work" subtitle="Marketing digital & événementiel — Grande Pharmacie La Varenne" coverKey="pharmacy" variant={2} actions={<><Button icon={Plus} onClick={() => open({ resource: 'task', defaults: { category: 'alternance', date: t0 } })}>Tâche</Button><Button variant="outline" icon={Megaphone} onClick={() => open({ resource: 'campaign', defaults: { start: t0 } })}>Campagne</Button></>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'dashboard', label: 'Marketing Dashboard' }, { value: 'planner', label: 'Social Media Planner' }, { value: 'campaigns', label: 'Campaign Manager' }, { value: 'library', label: 'Content Library' }, { value: 'performance', label: 'Performance' }]} />
      {tab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Tâches ouvertes" value={tasks.length} icon={ListChecks} />
            <Stat label="Publications (14 j)" value={posts.length} icon={Sparkles} sub={`${posts.filter((p) => p.status === 'ready' || p.status === 'published').length} prêtes`} />
            <Stat label="Campagnes actives" value={activeCampaigns.length} icon={Megaphone} />
            <Stat label="Événements à venir" value={events.length} icon={CalendarDays} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader icon={ListChecks} title="Tâches" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'task', defaults: { category: 'alternance', date: t0 } })}>Tâche</Button>} />
              <div className="p-2">{tasks.length === 0 ? <Empty title="Aucune tâche" className="py-4" /> : tasks.slice(0, 8).map((t) => <TaskCheck key={t.id} task={t} showDate />)}</div>
            </Card>
            <Card>
              <CardHeader icon={Sparkles} title="Publications à venir" />
              <div className="space-y-1 p-3">
                {posts.length === 0 && <Empty title="Rien de planifié" className="py-4" />}
                {posts.map((p) => (
                  <button key={p.id} onClick={() => open({ resource: 'contentPost', id: p.id })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sunken">
                    <span className="w-20 text-xs capitalize text-muted">{relativeDay(p.date)}</span>
                    <span className="flex-1 truncate text-sm font-medium">{p.theme}</span>
                    <Badge color={optionColor(REGISTRY.contentPost.fields.status.options, p.status)}>{optionLabel(REGISTRY.contentPost.fields.status.options, p.status)}</Badge>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Megaphone} title="Campagnes en cours / prévues" />
              <div className="space-y-2 p-3">
                {activeCampaigns.length === 0 && <Empty title="Aucune campagne" className="py-4" />}
                {activeCampaigns.map((c) => (
                  <button key={c.id} onClick={() => open({ resource: 'campaign', id: c.id })} className="block w-full rounded-2xl border border-line/70 p-3 text-left hover:border-wine/30">
                    <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span><Badge className="ml-auto">{optionLabel(REGISTRY.campaign.fields.type.options, c.type)}</Badge></div>
                    <div className="mt-1 text-xs text-muted">{c.start ? formatFr(c.start) : '—'} → {c.end ? formatFr(c.end) : '—'}{c.budget ? ` · ${eur(c.budget)}` : ''}</div>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Target} title="Objectifs" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'goal', defaults: { category: 'career' } })}>Objectif</Button>} />
              <div className="grid gap-3 p-3">{goals.length === 0 ? <Empty title="Aucun objectif carrière" className="py-4" /> : goals.map((g) => <GoalCard key={g.id} g={g} />)}</div>
            </Card>
          </div>
          <ResourceTable resource="event" title="Événements de la pharmacie" params={{ where: { category: 'alternance' } }} defaults={{ category: 'alternance', start: `${t0}T09:00` }} columns={['title', 'start', 'location']} />
        </div>
      )}
      {tab === 'planner' && <ContentPlanner account="pharmacy" />}
      {tab === 'campaigns' && <ResourceTable resource="campaign" title="Campaign Manager" defaults={{ start: t0 }} filterField="status" />}
      {tab === 'library' && <ContentLibrary account="pharmacy" />}
      {tab === 'performance' && <Performance account="pharmacy" />}
    </Page>
  );
}
