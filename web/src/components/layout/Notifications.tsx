import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bell, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApi, useSettings } from '@/lib/hooks';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  level: 'info' | 'warn' | 'urgent';
  link: string;
}

const SEEN_KEY = 'jadou-seen-notices';

export function NotificationsBell() {
  const { data = [] } = useApi<Notice[]>('/notifications', { refetchInterval: 60_000 });
  const { data: settings } = useSettings();
  const nav = useNavigate();
  const [seen, setSeen] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const unseen = data.filter((n) => !seen.includes(n.id));

  // browser notifications for new important items (only if enabled by the user)
  const notified = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!settings?.notifications?.browser || !('Notification' in window) || Notification.permission !== 'granted') return;
    for (const n of unseen) {
      if (n.level === 'info' || notified.current.has(n.id)) continue;
      notified.current.add(n.id);
      new Notification(n.title, { body: n.body, tag: n.id });
    }
  }, [unseen, settings]);

  const markSeen = () => {
    const ids = Array.from(new Set([...seen, ...data.map((d) => d.id)])).slice(-300);
    setSeen(ids);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  return (
    <Popover.Root onOpenChange={(o) => !o && markSeen()}>
      <Popover.Trigger asChild>
        <div className="relative">
          <IconButton icon={unseen.length ? BellRing : Bell} label="Notifications" />
          {unseen.length > 0 && <span className="pointer-events-none absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-wine px-1 text-[9px] font-bold text-onwine">{unseen.length}</span>}
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-1.5rem))] rounded-3xl border border-line bg-surface p-2 shadow-lift data-[state=open]:animate-fade-up">
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <div className="h-display text-xl">Rappels</div>
            <span className="text-xs text-muted">{data.length} actif{data.length > 1 ? 's' : ''}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {data.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">Tout est sous contrôle ♡</div>}
            {data.map((n) => (
              <Popover.Close asChild key={n.id}>
                <button onClick={() => nav(n.link)} className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-sunken">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.level === 'urgent' ? 'bg-bad' : n.level === 'warn' ? 'bg-warn' : 'bg-blush')} />
                  <div className="min-w-0">
                    <div className={cn('text-sm', !seen.includes(n.id) && 'font-semibold')}>{n.title}</div>
                    <div className="text-xs text-muted">{n.body}</div>
                  </div>
                </button>
              </Popover.Close>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
