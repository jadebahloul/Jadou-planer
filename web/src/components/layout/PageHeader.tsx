import * as React from 'react';
import { ImagePlus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useSaveSetting, useSettings } from '@/lib/hooks';
import { uploadFiles } from '@/lib/api';
import { toast } from 'sonner';

/** Refined generative cover (no stock image): layered gradients, fine arcs and paper grain. */
export function CoverArt({ variant = 0, className }: { variant?: number; className?: string }) {
  const palettes = [
    ['rgb(var(--blush))', 'rgb(var(--sand))', 'rgb(var(--petal))'],
    ['rgb(var(--sand))', 'rgb(var(--blush))', 'rgb(var(--surface))'],
    ['rgb(var(--petal))', 'rgb(var(--wine) / .35)', 'rgb(var(--sand))'],
  ];
  const [a, b, c] = palettes[variant % palettes.length];
  return (
    <div className={cn('grain absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 140% at 85% 10%, ${a} 0%, transparent 55%), radial-gradient(90% 120% at 10% 100%, ${b} 0%, transparent 60%), linear-gradient(135deg, ${c}, rgb(var(--canvas)))` }} />
      <svg className="absolute -right-10 -top-16 h-[160%] opacity-50" viewBox="0 0 400 400" fill="none">
        {[60, 90, 120, 150, 180].map((r, i) => (
          <circle key={r} cx="260" cy="160" r={r} stroke="rgb(var(--wine))" strokeOpacity={0.12 - i * 0.015} strokeWidth="0.8" />
        ))}
      </svg>
      <svg className="absolute bottom-5 right-8 h-5 w-5 text-wine/40" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" />
      </svg>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  subtitle,
  actions,
  coverKey,
  variant = 0,
  children,
  compact,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  coverKey?: string;
  variant?: number;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const photo: string | undefined = coverKey ? settings?.theme?.covers?.[coverKey] : undefined;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const setCover = async (url: string | null) => {
    const theme = { ...(settings?.theme ?? {}), covers: { ...(settings?.theme?.covers ?? {}), [coverKey!]: url } };
    await save.mutateAsync({ key: 'theme', value: theme });
  };

  return (
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }} className={cn('relative mb-6 overflow-hidden rounded-3xl border border-line/70', compact ? 'min-h-[120px]' : 'min-h-[168px]')}>
      {photo ? (
        <>
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 to-canvas/10" />
        </>
      ) : (
        <CoverArt variant={variant} />
      )}
      <div className={cn('relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between', compact ? 'sm:p-6' : 'sm:p-8')}>
        <div className="max-w-2xl">
          {eyebrow && <div className="eyebrow mb-2 text-wine/80">{eyebrow}</div>}
          <h1 className="h-display text-[34px] leading-[1.05] sm:text-[44px]">
            {title} {accent && <em className="font-display italic text-wine">{accent}</em>}
          </h1>
          {subtitle && <div className="mt-2 text-sm text-muted sm:text-[15px]">{subtitle}</div>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {coverKey && (
        <div className="no-print absolute right-3 top-3 flex gap-1 opacity-60 transition hover:opacity-100">
          <button onClick={() => inputRef.current?.click()} className="grid h-8 w-8 place-items-center rounded-full bg-surface/80 text-muted backdrop-blur hover:text-wine" title="Ajouter ma photo de couverture">
            <ImagePlus className="h-4 w-4" strokeWidth={1.6} />
          </button>
          {photo && (
            <button onClick={() => setCover(null)} className="grid h-8 w-8 place-items-center rounded-full bg-surface/80 text-muted backdrop-blur hover:text-bad" title="Retirer la photo">
              <X className="h-4 w-4" />
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files?.length) return;
              try {
                const [f] = await uploadFiles(e.target.files);
                await setCover(f.url);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
        </div>
      )}
    </motion.header>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6', className)}>{children}</div>;
}
