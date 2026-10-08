import * as React from 'react';
import { ArrowUp, Check, X, Sparkles, Cpu, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getResource } from '@shared/registry';
import { api } from '@/lib/api';
import { useApi, useInvalidate } from '@/lib/hooks';
import { RichText, Badge, useConfirm, IconButton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Action {
  op: 'create' | 'update';
  resource: string;
  id?: number;
  data: Record<string, unknown>;
  summary: string;
  hints?: Record<string, string>;
  state?: 'pending' | 'done' | 'dismissed';
}
interface Msg {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  actions: Action[];
  engine?: string;
}

export const AI_SUGGESTIONS = [
  'Quelles sont mes priorités ?',
  'Organise-moi ma journée',
  'Quels devoirs dois-je rendre ?',
  'Programme mes révisions TOEIC',
  'Trouve-moi deux créneaux pour le sport',
  'Combien ai-je sur mes comptes ?',
  'Fais-moi mon bilan financier',
  'Combien ai-je gagné avec les cils ?',
  'Prépare mes publications Instagram',
  'Fais-moi un bilan Airbnb',
  'Combien coûte toute ma wishlist ?',
  'Quels achats correspondent à mon budget ?',
];

export function AiChat({ compact }: { compact?: boolean }) {
  const { data: history } = useApi<Msg[]>('/ai/history');
  const { data: status } = useApi<{ enabled: boolean; available: boolean; model?: string; modelInstalled?: boolean }>('/ai/status', { refetchInterval: 30_000 });
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);
  const invalidate = useInvalidate();
  const confirm = useConfirm();

  React.useEffect(() => {
    if (history) setMsgs(history);
  }, [history]);
  React.useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const send = async (text = input) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    setMsgs((m) => [...m, { id: Date.now(), role: 'user', content: t, actions: [] }]);
    setBusy(true);
    try {
      const r = await api<{ id: number; reply: string; actions: Action[]; engine: string }>('/ai/chat', { body: { message: t } });
      setMsgs((m) => [...m, { id: r.id, role: 'assistant', content: r.reply, actions: r.actions.map((a) => ({ ...a, state: 'pending' })), engine: r.engine }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (msg: Msg, index: number, ok: boolean) => {
    const a = msg.actions[index];
    try {
      if (ok) {
        await api('/ai/execute', { body: { action: a, messageId: msg.id, index } });
        invalidate();
        toast.success('C’est fait ♡');
      } else await api('/ai/dismiss', { body: { messageId: msg.id, index } });
      setMsgs((ms) => ms.map((m) => (m.id === msg.id ? { ...m, actions: m.actions.map((x, i) => (i === index ? { ...x, state: ok ? 'done' : 'dismissed' } : x)) } : m)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const acceptAll = async (msg: Msg) => {
    for (let i = 0; i < msg.actions.length; i++) if (msg.actions[i].state === 'pending') await act(msg, i, true);
  };

  const clear = async () => {
    if (!(await confirm({ title: 'Effacer la conversation ?', text: 'La mémoire de Jadou AI (Settings › Data & Privacy) est conservée.', confirm: 'Effacer', danger: true }))) return;
    await api('/ai/history', { method: 'DELETE' });
    setMsgs([]);
  };

  const llm = status?.available && status?.modelInstalled;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line/70 px-4 py-2.5">
        <Badge color={llm ? '#3F8F5F' : '#B7791F'}>
          <Cpu className="h-3 w-3" /> {llm ? `IA locale · ${status?.model}` : 'Mode local (sans IA)'}
        </Badge>
        <span className="hidden text-[11px] text-muted sm:inline">Tes données restent sur ton ordinateur</span>
        <IconButton icon={Trash2} label="Effacer la conversation" className="ml-auto h-8 w-8" onClick={clear} />
      </div>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {msgs.length === 0 && !busy && (
          <div className="mx-auto max-w-md pt-4 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-wine text-onwine shadow-lift">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="h-display text-2xl">Bonjour Jadou ♡</div>
            <p className="mt-1 text-sm text-muted">Pose-moi une question sur ta journée, ton argent, tes études ou tes projets. Je propose — tu valides.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[88%] rounded-3xl px-4 py-3', m.role === 'user' ? 'rounded-br-lg bg-wine text-onwine' : 'rounded-bl-lg border border-line/70 bg-surface')}>
                {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <RichText text={m.content} />}
                {m.actions?.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {m.actions.map((a, i) => (
                      <div key={i} className={cn('flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs', a.state === 'done' ? 'border-good/30 bg-good/5' : a.state === 'dismissed' ? 'border-line opacity-50' : 'border-blush bg-petal/50')}>
                        <span className="eyebrow shrink-0 text-[9px]">{a.op === 'create' ? '+ ' : '✎ '}{getResource(a.resource)?.label}</span>
                        <span className="min-w-0 flex-1 truncate text-ink">{a.summary}</span>
                        {a.state === 'pending' ? (
                          <>
                            <button onClick={() => act(m, i, false)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface" aria-label="Ignorer">
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => act(m, i, true)} className="grid h-7 w-7 place-items-center rounded-full bg-wine text-onwine" aria-label="Confirmer">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted">{a.state === 'done' ? 'Enregistré ✓' : 'Ignoré'}</span>
                        )}
                      </div>
                    ))}
                    {m.actions.filter((a) => a.state === 'pending').length > 1 && (
                      <button onClick={() => acceptAll(m)} className="mt-1 text-xs font-semibold text-wine hover:underline">
                        Tout confirmer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-wine" /> Jadou réfléchit…
          </div>
        )}
      </div>
      <div className="border-t border-line/70 p-3">
        {msgs.length < 3 && (
          <div className={cn('mb-2.5 flex gap-1.5 overflow-x-auto pb-1', !compact && 'flex-wrap')}>
            {AI_SUGGESTIONS.slice(0, compact ? 12 : 12).map((s) => (
              <button key={s} onClick={() => send(s)} className="chip shrink-0">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-1.5 pl-4 focus-within:border-wine/40 focus-within:shadow-ring"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Demande à Jadou AI…"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted/70"
          />
          <button type="submit" disabled={!input.trim() || busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-wine text-onwine transition disabled:opacity-40" aria-label="Envoyer">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
