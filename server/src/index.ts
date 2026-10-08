import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from './db';
import { WEB_DIST } from './paths';
import { hasUser, setup, login, logout, changePassword, requireAuth, requireAppHeader } from './auth';
import { crud, errorHandler } from './crud';
import { calendarRouter } from './calendar';
import { searchRouter } from './search';
import { notificationsRouter } from './notifications';
import { filesRouter } from './files';
import { vaultRouter } from './vault';
import { backupRouter, exportRouter, autoBackup } from './backup';
import { importRouter } from './importCsv';
import { instagramRouter } from './instagram';
import { weatherRouter } from './weather';
import { aiRouter } from './ai/router';
import { getAllSettings, setSetting, DEFAULT_SETTINGS } from './settings';
import { seedIfNeeded } from './seed';
import * as stats from './stats';
import { today } from '../../shared/dates';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use('/api', requireAppHeader);

// ---------------------------------------------------------------- public
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/auth/status', async (req, res) => {
  const configured = await hasUser();
  let authenticated = false;
  const sid = req.cookies?.jadou_session;
  if (sid) {
    const s = await prisma.session.findUnique({ where: { id: sid } });
    authenticated = !!s && s.expiresAt > new Date();
  }
  res.json({ configured, authenticated });
});
app.post('/api/auth/setup', async (req, res, next) => {
  try {
    await setup(req, res);
  } catch (e) {
    next(e);
  }
});
app.post('/api/auth/login', login);
// OAuth redirect from Meta is a cross-site navigation (strict cookie not sent) — protected by the OAuth state.
app.get('/api/instagram/callback', (req, res, next) => instagramRouter(req, res, next));

// ---------------------------------------------------------------- private
app.use('/api', requireAuth);
app.post('/api/auth/logout', logout);
app.post('/api/auth/password', changePassword);

app.get('/api/settings', async (_req, res) => res.json(await getAllSettings()));
app.put('/api/settings/:key', async (req, res) => {
  const key = req.params.key;
  if (!(key in DEFAULT_SETTINGS) || key === 'instagram') return res.status(400).json({ error: 'Réglage inconnu' });
  await setSetting(key, req.body?.value);
  res.json({ ok: true });
});

app.use('/api/r', crud);
app.use('/api/calendar', calendarRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/files', filesRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/backup', backupRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/instagram', instagramRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/ai', aiRouter);

const ref = (q: unknown) => (typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today());
app.get('/api/stats/dashboard', async (req, res, next) => {
  try {
    const d = ref(req.query.date);
    const [money, lash, fitness, water, studies, toeic, tasks, habits, goals, airbnb] = await Promise.all([stats.moneySummary(d), stats.lashSummary(d), stats.fitnessSummary(d), stats.waterToday(d), stats.studiesSummary(d), stats.toeicSummary(d), stats.tasksSummary(d), stats.habitsToday(d), stats.goalsSummary(), stats.airbnbSummary(d)]);
    res.json({ money, lash, fitness, water, studies, toeic, tasks, habits, goals, airbnb });
  } catch (e) {
    next(e);
  }
});
app.get('/api/stats/money', async (req, res, next) => {
  try {
    res.json(await stats.moneySummary(ref(req.query.date)));
  } catch (e) {
    next(e);
  }
});
app.get('/api/stats/money-series', async (req, res, next) => {
  try {
    res.json(await stats.moneySeries(Math.min(36, Number(req.query.months) || 6), ref(req.query.date)));
  } catch (e) {
    next(e);
  }
});
for (const [name, fn] of Object.entries({ lash: stats.lashSummary, fitness: stats.fitnessSummary, studies: stats.studiesSummary, toeic: stats.toeicSummary, airbnb: stats.airbnbSummary, water: stats.waterToday })) {
  app.get(`/api/stats/${name}`, async (req, res, next) => {
    try {
      res.json(await fn(ref(req.query.date)));
    } catch (e) {
      next(e);
    }
  });
}
app.get('/api/stats/period', async (req, res, next) => {
  try {
    const from = ref(req.query.from);
    const to = ref(req.query.to);
    res.json(await stats.periodSummary(from, to));
  } catch (e) {
    next(e);
  }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// ---------------------------------------------------------------- web app (production)
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(join(WEB_DIST, 'index.html')));
}

const PORT = Number(process.env.PORT) || 4317;
const HOST = process.env.JADOU_ALLOW_LAN === '1' ? process.env.HOST || '0.0.0.0' : '127.0.0.1';

app.listen(PORT, HOST, async () => {
  console.log(`\n  Jadou Planner ♡  →  http://localhost:${PORT}${existsSync(WEB_DIST) ? '' : '  (API — interface : http://localhost:5173)'}`);
  console.log(`  Données locales uniquement · serveur lié à ${HOST}\n`);
  if (await hasUser()) await seedIfNeeded();
  await autoBackup().catch((e) => console.error('Sauvegarde auto impossible', e));
  setInterval(() => autoBackup().catch(() => {}), 3600 * 1000);
});
