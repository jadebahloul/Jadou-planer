import * as React from 'react';
import { Brain, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { optionLabel, REGISTRY } from '@shared/registry';
import { useList, useRemove } from '@/lib/hooks';
import { Page } from '@/components/layout/PageHeader';
import { Card, CardHeader, Button, Empty } from '@/components/ui';
import { AiChat } from '@/components/AiChat';
import { useRecordDialog } from '@/components/resource/RecordDialog';

export function AiPage() {
  const { data: memory = [] } = useList('memory');
  const open = useRecordDialog();
  const remove = useRemove('memory');
  return (
    <Page className="max-w-[1400px]">
      <div className="mb-5">
        <div className="eyebrow mb-1 text-wine/80">Assistant</div>
        <h1 className="h-display text-[40px] leading-tight">Jadou <em className="text-wine">AI</em> ♡</h1>
        <p className="text-sm text-muted">Comprend tes demandes en français, retrouve tes informations, propose des actions — tu confirmes chaque modification.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="h-[calc(100dvh-260px)] min-h-[520px] overflow-hidden">
          <AiChat />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader icon={Brain} title="Mémoire locale" eyebrow={`${memory.length} élément${memory.length > 1 ? 's' : ''}`} action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'memory' })}>Ajouter</Button>} />
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto p-3">
              {memory.length === 0 && <Empty title="Rien de mémorisé" text="Dis « Souviens-toi que… » ou ajoute une information." className="py-4" />}
              {memory.map((m) => (
                <div key={m.id} className="group rounded-xl border border-line/70 p-2.5 text-sm">
                  <div className="eyebrow text-[9px]">{optionLabel(REGISTRY.memory.fields.category.options, m.category)}</div>
                  <div className="cursor-pointer" onClick={() => open({ resource: 'memory', id: m.id })}>{m.content}</div>
                  <button onClick={() => remove.mutate(m.id)} className="mt-1 text-[11px] text-muted opacity-0 transition hover:text-bad group-hover:opacity-100">Oublier</button>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4 text-xs text-muted">
            <div className="mb-2 flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-wine" />Confidentialité</div>
            Aucune donnée n’est envoyée à un service externe. Avec Ollama, le modèle tourne sur ton ordinateur. Les données de santé ne sont partagées avec le modèle que si tu l’autorises. <Link to="/settings/integrations" className="text-wine underline">Configurer l’IA locale</Link>
          </Card>
        </div>
      </div>
    </Page>
  );
}
