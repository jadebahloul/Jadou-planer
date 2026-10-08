import { prisma } from './db';

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  profile: { name: 'Jade', nickname: 'Jadou', school: 'INSEEC Grande École — Master Marketing', job: 'Alternance marketing digital & événementiel — Grande Pharmacie La Varenne' },
  theme: { palette: 'rose', density: 'comfortable', headerPhoto: null, radius: 'soft' },
  dashboard: {
    widgets: ['focus', 'week', 'overview', 'water', 'quickActions', 'progress', 'habits', 'upcoming'],
    hidden: [],
  },
  hiddenModules: [],
  notifications: { enabled: true, browser: false, homeworkDays: 2, appointmentMinutes: 60, waterReminder: true, overdueTasks: true },
  ai: { enabled: true, url: 'http://127.0.0.1:11434', model: 'llama3.1:8b', shareHealthData: false },
  weather: { enabled: false, city: 'Paris', lat: 48.8566, lon: 2.3522 },
  goals: { waterMl: 2000, workoutsPerWeek: 3, kcal: 2000, protein: 110, carbs: 220, fat: 65, toeicTarget: 600, focusMinutesPerDay: 120 },
  toeicPlan: {
    '1': { focus: 'Vocabulaire', minutes: 30 },
    '2': { focus: 'Listening', minutes: 30 },
    '3': { focus: 'Grammaire', minutes: 30 },
    '4': { focus: 'Reading', minutes: 30 },
    '5': { focus: 'Exercices chronométrés', minutes: 40 },
    '6': { focus: 'Mini-test', minutes: 45 },
    '0': { focus: 'Correction & erreurs', minutes: 30 },
  },
  instagram: { appId: '', redirectUri: 'https://localhost:4317/api/instagram/callback', connected: false, username: null },
  backup: { auto: true, keep: 14 },
};

export async function getSetting<T = any>(key: string): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const def = DEFAULT_SETTINGS[key];
  if (!row) return structuredClone(def) as T;
  try {
    const v = JSON.parse(row.value);
    if (def && typeof def === 'object' && !Array.isArray(def) && v && typeof v === 'object' && !Array.isArray(v)) return { ...(def as object), ...v } as T;
    return v as T;
  } catch {
    return def as T;
  }
}

export async function setSetting(key: string, value: unknown) {
  const v = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

export async function getAllSettings() {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = await getSetting(k);
  // never expose secrets to the client
  const ig = out.instagram as Record<string, unknown>;
  delete ig.appSecret;
  delete ig.token;
  return out;
}
