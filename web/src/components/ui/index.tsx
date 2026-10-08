import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DM from '@radix-ui/react-dropdown-menu';
import * as RSwitch from '@radix-ui/react-switch';
import { X, Star, Loader2, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------- Button
type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean }
>(({ className, variant = 'primary', size = 'md', icon: Icon, loading, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
      size === 'sm' && 'h-8 px-3 text-xs',
      size === 'md' && 'h-10 px-4 text-sm',
      size === 'lg' && 'h-12 px-6 text-sm',
      variant === 'primary' && 'bg-wine text-onwine shadow-[0_8px_20px_-10px_rgb(var(--wine)/.8)] hover:bg-wine/90',
      variant === 'soft' && 'bg-petal text-wine hover:bg-blush/60',
      variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
      variant === 'outline' && 'border border-line bg-surface text-ink hover:border-wine/30',
      variant === 'danger' && 'bg-bad/10 text-bad hover:bg-bad/15',
      className,
    )}
    {...props}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.8} /> : null}
    {children}
  </button>
));
Button.displayName = 'Button';

export function IconButton({ icon: Icon, label, className, active, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button aria-label={label} title={label} className={cn('grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink', active && 'bg-petal text-wine', className)} {...p}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
    </button>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ className, children, hover, ...p }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, eyebrow, icon: Icon, action, className }: { title: React.ReactNode; eyebrow?: string; icon?: LucideIcon; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-petal text-wine">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
          <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Badge
export function Badge({ children, color, className, dot }: { children: React.ReactNode; color?: string; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium', !color && 'bg-sunken text-muted', className)}
      style={color ? { backgroundColor: `${color}1F`, color: 'rgb(var(--ink))' } : undefined}
    >
      {(dot || color) && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color ?? 'rgb(var(--muted))' }} />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Progress
export function Progress({ value, className, color, height = 6 }: { value: number; className?: string; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-sunken', className)} style={{ height }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: color ?? 'rgb(var(--wine))' }} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, color, children, track }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? 'rgb(var(--sunken))'} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? 'rgb(var(--wine))'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (v / 100) * c }} transition={{ duration: 1, ease: [0.2, 0.7, 0.2, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Empty / Stat / Skeleton
export function Empty({ icon: Icon, title, text, action, className }: { icon?: LucideIcon; title: string; text?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {Icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-petal text-wine">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
      )}
      <div className="font-display text-xl text-ink">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, accent, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon; accent?: boolean; className?: string }) {
  return (
    <Card className={cn('p-4 sm:p-5', accent && 'border-transparent bg-wine text-onwine', className)}>
      <div className="flex items-center justify-between">
        <span className={cn('eyebrow', accent && 'text-onwine/70')}>{label}</span>
        {Icon && <Icon className={cn('h-4 w-4 text-muted', accent && 'text-onwine/70')} strokeWidth={1.7} />}
      </div>
      <div className={cn('num mt-2 font-display text-[28px] font-medium leading-none sm:text-[32px]', accent ? 'text-onwine' : 'text-ink')}>{value}</div>
      {sub && <div className={cn('mt-1.5 text-xs text-muted', accent && 'text-onwine/70')}>{sub}</div>}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgb(var(--sunken)),rgb(var(--petal)),rgb(var(--sunken)))] bg-[length:200%_100%]', className)} />;
}

// ---------------------------------------------------------------- Modal
export function Modal({ open, onOpenChange, title, description, children, size = 'md', footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; footer?: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[3px] data-[state=open]:animate-[fade-up_.2s_ease]" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-line bg-surface shadow-lift outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
            'data-[state=open]:animate-fade-up',
            size === 'sm' && 'sm:max-w-md',
            size === 'md' && 'sm:max-w-xl',
            size === 'lg' && 'sm:max-w-3xl',
            size === 'xl' && 'sm:max-w-5xl',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line/70 px-6 pb-4 pt-5">
            <div>
              <Dialog.Title className="h-display text-2xl">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{String(title)}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Fermer" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line/70 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------- Tabs (segmented)
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; icon?: LucideIcon }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-surface p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium transition', size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-[13px]', value === o.value ? 'text-onwine' : 'text-muted hover:text-ink')}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-full bg-wine" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />}
          <span className="relative inline-flex items-center gap-1.5">
            {o.icon && <o.icon className="h-3.5 w-3.5" strokeWidth={1.8} />}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Switch / Rating / Menu
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm">
      <RSwitch.Root checked={checked} onCheckedChange={onChange} className={cn('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-wine' : 'bg-line')}>
        <RSwitch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-surface shadow transition data-[state=checked]:translate-x-[22px]" />
      </RSwitch.Root>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Rating({ value, onChange, max = 5, size = 18 }: { value: number | null | undefined; onChange?: (v: number) => void; max?: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i + 1 === value ? 0 : i + 1)} className="disabled:cursor-default" aria-label={`${i + 1}/${max}`}>
          <Star style={{ width: size, height: size }} className={cn('transition', (value ?? 0) > i ? 'fill-wine text-wine' : 'text-line')} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

export function Menu({ items, trigger }: { items: { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean }[]; trigger?: React.ReactNode }) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger ?? <IconButton icon={MoreHorizontal} label="Actions" onClick={(e) => e.stopPropagation()} />}</DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-[60] min-w-[180px] rounded-2xl border border-line bg-surface p-1.5 shadow-lift data-[state=open]:animate-fade-up">
          {items.map((it) => (
            <DM.Item
              key={it.label}
              onSelect={it.onSelect}
              onClick={(e) => e.stopPropagation()}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-sunken', it.danger ? 'text-bad' : 'text-ink')}
            >
              {it.icon && <it.icon className="h-4 w-4" strokeWidth={1.7} />}
              {it.label}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

// ---------------------------------------------------------------- Form bits
export function Label({ children, className, htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-xs font-medium text-muted', className)}>
      {children}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn('field', className)} {...p} />);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn('field min-h-[90px] resize-y', className)} {...p} />);
Textarea.displayName = 'Textarea';

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('field appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%238B8185%27 stroke-width=%272%27%3E%3Cpath d=%27M2 4l4 4 4-4%27/%3E%3C/svg%3E")] bg-[right_0.9rem_center] bg-no-repeat pr-9', className)} {...p}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------- Confirm
type ConfirmOpts = { title: string; text?: string; confirm?: string; danger?: boolean };
const ConfirmCtx = React.createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => React.useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = React.useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal
        open={!!state}
        onOpenChange={(o) => !o && close(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Annuler
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirm ?? 'Confirmer'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{state?.text}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ---------------------------------------------------------------- Section
export function Section({ title, eyebrow, action, children, className }: { title: React.ReactNode; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h2 className="h-display text-[26px] leading-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Small markdown subset used by Jadou AI replies: **bold**, line breaks, bullets. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('prose-jadou space-y-1 text-sm leading-relaxed', className)}>
      {text.split('\n').map((line, i) =>
        line.trim() === '' ? (
          <div key={i} className="h-2" />
        ) : (
          <p key={i} className={cn(/^[•☐🏆-]/.test(line.trim()) && 'pl-1')}>
            {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <React.Fragment key={j}>{part}</React.Fragment>))}
          </p>
        ),
      )}
    </div>
  );
}
