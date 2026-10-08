import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Plus, Search, PanelLeftClose, PanelLeft, Menu as MenuIcon, X, LogOut, Sparkles, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NAV, ALL_ITEMS, CORE_KEYS, MOBILE_TABS } from '@/lib/nav';
import { useSettings } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui';
import { useQuickAdd } from './QuickAdd';
import { useSearch } from './Search';
import { NotificationsBell } from './Notifications';
import { FocusPill } from './Focus';
import { AiChat } from '@/components/AiChat';
import { api } from '@/lib/api';

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-wine text-onwine shadow-[0_8px_18px_-8px_rgb(var(--wine))]">
        <span className="font-display text-xl italic leading-none">J</span>
        <Heart className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-blush text-blush" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-[19px] font-semibold tracking-tight">Jadou Planner</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Life OS ♡</div>
        </div>
      )}
    </div>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { data: settings } = useSettings();
  const hidden: string[] = settings?.hiddenModules ?? [];
  return (
    <nav className="space-y-5">
      {NAV.map((g) => {
        const items = g.items.filter((i) => CORE_KEYS.has(i.key) || !hidden.includes(i.key));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            {!collapsed && <div className="eyebrow mb-1.5 px-3 text-[10px]">{g.label}</div>}
            <div className="space-y-0.5">
              {items.map((i) => (
                <NavLink
                  key={i.key}
                  to={i.path}
                  end={i.path === '/'}
                  onClick={onNavigate}
                  title={collapsed ? i.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition',
                      collapsed && 'justify-center px-0',
                      isActive ? 'bg-petal font-semibold text-wine' : 'text-ink/75 hover:bg-sunken hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId={collapsed ? 'nav-dot-c' : 'nav-dot'} className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-wine" />}
                      <i.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.6} />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Shell() {
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem('jadou-nav') === 'c');
  const [drawer, setDrawer] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const quickAdd = useQuickAdd();
  const search = useSearch();
  const loc = useLocation();
  const { data: settings } = useSettings();

  React.useEffect(() => {
    try {
      localStorage.setItem('jadou-nav', collapsed ? 'c' : 'o');
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  React.useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme?.palette ?? 'rose';
  }, [settings?.theme?.palette]);
  React.useEffect(() => {
    const onAsk = () => setAiOpen(true);
    window.addEventListener('jadou:ask', onAsk);
    return () => window.removeEventListener('jadou:ask', onAsk);
  }, []);
  React.useEffect(() => {
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const current = ALL_ITEMS.find((i) => (i.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.path)));

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className={cn('no-print hidden shrink-0 flex-col border-r border-line/70 bg-surface/60 backdrop-blur transition-[width] duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-[264px]')}>
        <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
          <Logo collapsed={collapsed} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <NavList collapsed={collapsed} />
        </div>
        <div className={cn('flex items-center gap-1 border-t border-line/70 p-3', collapsed && 'flex-col')}>
          <IconButton icon={collapsed ? PanelLeft : PanelLeftClose} label={collapsed ? 'Déplier le menu' : 'Replier le menu'} onClick={() => setCollapsed(!collapsed)} />
          <IconButton
            icon={LogOut}
            label="Verrouiller"
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' });
              window.location.reload();
            }}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="no-print sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line/60 bg-canvas/80 px-3 backdrop-blur-xl sm:px-6">
          <IconButton icon={MenuIcon} label="Menu" className="lg:hidden" onClick={() => setDrawer(true)} />
          <div className="lg:hidden">
            <Logo collapsed />
          </div>
          <div className="hidden min-w-0 items-center gap-2 text-sm text-muted xl:flex">
            {current && <current.icon className="h-4 w-4" strokeWidth={1.6} />}
            <span className="truncate">{current?.label}</span>
          </div>
          <button onClick={search} className="ml-auto flex h-10 min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-muted transition hover:border-wine/30 sm:w-72 lg:ml-6 lg:mr-auto">
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span className="hidden truncate sm:inline">Rechercher partout…</span>
            <kbd className="ml-auto hidden rounded-md border border-line px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="hidden md:block">
            <FocusPill />
          </div>
          <NotificationsBell />
          <button onClick={quickAdd} className="flex h-10 items-center gap-1.5 rounded-full bg-wine px-3 text-sm font-medium text-onwine shadow-[0_8px_20px_-10px_rgb(var(--wine))] transition hover:bg-wine/90 sm:px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Add</span>
          </button>
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_TABS.slice(0, 2).map((k) => {
            const i = ALL_ITEMS.find((x) => x.key === k)!;
            return <MobileTab key={k} item={i} />;
          })}
          <button onClick={quickAdd} className="flex flex-col items-center justify-center" aria-label="Quick Add">
            <span className="-mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-wine text-onwine shadow-lift">
              <Plus className="h-5 w-5" />
            </span>
          </button>
          {MOBILE_TABS.slice(2).map((k) => {
            const i = ALL_ITEMS.find((x) => x.key === k)!;
            return <MobileTab key={k} item={i} />;
          })}
        </div>
      </nav>

      {/* mobile drawer */}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[84%] max-w-[320px] flex-col bg-surface shadow-lift outline-none data-[state=open]:animate-[fade-up_.25s_ease] lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Tous les modules</Dialog.Description>
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <Dialog.Close asChild>
                <IconButton icon={X} label="Fermer" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
              <NavList onNavigate={() => setDrawer(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Ask Jadou AI floating button + drawer */}
      {!loc.pathname.startsWith('/ai') && (
        <button onClick={() => setAiOpen(true)} className="no-print fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full border border-wine/10 bg-surface/95 py-2.5 pl-3 pr-4 text-sm font-medium text-wine shadow-lift backdrop-blur transition hover:-translate-y-0.5 lg:bottom-6 lg:right-6">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-wine text-onwine">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Ask Jadou AI ♡
        </button>
      )}
      <Dialog.Root open={aiOpen} onOpenChange={setAiOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/15 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 top-[8vh] z-50 flex flex-col overflow-hidden rounded-t-3xl border border-line bg-canvas shadow-lift outline-none data-[state=open]:animate-fade-up sm:inset-y-3 sm:left-auto sm:right-3 sm:top-3 sm:w-[440px] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line/70 bg-surface px-5 py-3">
              <Dialog.Title className="h-display text-xl">
                Jadou <em className="text-wine">AI</em> ♡
              </Dialog.Title>
              <Dialog.Description className="sr-only">Assistante personnelle</Dialog.Description>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Fermer" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">
              <AiChat compact />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function MobileTab({ item }: { item: (typeof ALL_ITEMS)[number] }) {
  return (
    <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-wine' : 'text-muted')}>
      <item.icon className="h-5 w-5" strokeWidth={1.7} />
      {item.label.replace('My ', '')}
    </NavLink>
  );
}

export const askJadou = () => window.dispatchEvent(new Event('jadou:ask'));
