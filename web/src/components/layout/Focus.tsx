import * as React from 'react';
import { Pause, Play, Square, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/hooks';
import { today } from '@shared/dates';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FocusState {
  label: string;
  taskId?: number;
  category: string;
  totalSec: number;
  remaining: number;
  running: boolean;
  startedAt: number;
  mode: 'focus' | 'break';
}

interface FocusApi {
  state: FocusState | null;
  start: (o: { label: string; taskId?: number; category?: string; minutes?: number }) => void;
  toggle: () => void;
  stop: (save?: boolean) => void;
}

const Ctx = React.createContext<FocusApi>({ state: null, start: () => {}, toggle: () => {}, stop: () => {} });
export const useFocus = () => React.useContext(Ctx);
const KEY = 'jadou-focus';

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<FocusState | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  });
  const invalidate = useInvalidate();

  React.useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const persist = React.useCallback(
    async (s: FocusState) => {
      const minutes = Math.round((s.totalSec - s.remaining) / 60);
      if (s.mode !== 'focus' || minutes < 1) return;
      await api('/r/focusSession', { method: 'POST', body: { label: s.label, taskId: s.taskId ?? null, category: s.category, date: today(), minutes } });
      if (s.taskId) {
        const t = await api(`/r/task/${s.taskId}`).catch(() => null);
        if (t) await api(`/r/task/${s.taskId}`, { method: 'PATCH', body: { focusMinutes: (t.focusMinutes ?? 0) + minutes } });
      }
      invalidate();
      toast.success(`${minutes} min de concentration enregistrées ♡`);
    },
    [invalidate],
  );

  React.useEffect(() => {
    if (!state?.running) return;
    const t = setInterval(() => {
      setState((s) => {
        if (!s || !s.running) return s;
        const remaining = s.remaining - 1;
        if (remaining <= 0) {
          const done = { ...s, remaining: 0, running: false };
          persist(done);
          if ('Notification' in window && Notification.permission === 'granted') new Notification(s.mode === 'focus' ? 'Session terminée ♡' : 'Pause terminée', { body: s.mode === 'focus' ? 'Prends 5 minutes de pause.' : 'On reprend ?' });
          toast(s.mode === 'focus' ? 'Session terminée — pause de 5 min ?' : 'Pause terminée', {
            action: s.mode === 'focus' ? { label: 'Pause 5 min', onClick: () => setState({ ...s, mode: 'break', totalSec: 300, remaining: 300, running: true, startedAt: Date.now() }) } : undefined,
          });
          return null;
        }
        return { ...s, remaining };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state?.running, persist]);

  const api_: FocusApi = {
    state,
    start: ({ label, taskId, category = 'perso', minutes = 25 }) => setState({ label, taskId, category, totalSec: minutes * 60, remaining: minutes * 60, running: true, startedAt: Date.now(), mode: 'focus' }),
    toggle: () => setState((s) => (s ? { ...s, running: !s.running } : s)),
    stop: (save = true) => {
      if (state && save) persist(state);
      setState(null);
    },
  };
  return <Ctx.Provider value={api_}>{children}</Ctx.Provider>;
}

export const fmtTimer = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export function FocusPill() {
  const { state, toggle, stop } = useFocus();
  if (!state) return null;
  return (
    <div className={cn('flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-xs shadow-card', state.mode === 'focus' ? 'border-wine/20 bg-petal text-wine' : 'border-line bg-surface text-muted')}>
      <Timer className="h-3.5 w-3.5" />
      <span className="num font-semibold">{fmtTimer(state.remaining)}</span>
      <span className="ml-1 hidden max-w-[140px] truncate text-ink/70 lg:inline">{state.mode === 'focus' ? state.label : 'Pause'}</span>
      <button onClick={toggle} className="ml-1 grid h-6 w-6 place-items-center rounded-full hover:bg-surface" aria-label={state.running ? 'Pause' : 'Reprendre'}>
        {state.running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <button onClick={() => stop(true)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-surface" aria-label="Terminer">
        <Square className="h-3 w-3" />
      </button>
    </div>
  );
}
