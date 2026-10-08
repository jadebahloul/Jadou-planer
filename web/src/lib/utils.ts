import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const nf = (n: number | null | undefined, digits = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n || 0);
export const pct = (a: number, b: number) => (b ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
export const uid = () => Math.random().toString(36).slice(2, 10);

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function subtitleFor(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Let’s make today count.';
  if (h < 18) return 'Keep going — you’re doing beautifully.';
  return 'Time to slow down & reflect on your day.';
}

export const CHART = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
