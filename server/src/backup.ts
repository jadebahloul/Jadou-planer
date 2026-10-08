import { Router } from 'express';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import Papa from 'papaparse';
import { prisma, reconnect, delegate } from './db';
import { BACKUP_DIR, DB_FILE, UPLOAD_DIR } from './paths';
import { getSetting, getAllSettings } from './settings';
import { REGISTRY } from '../../shared/registry';
import { serialize } from './validate';

mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export async function createBackup(reason = 'manual') {
  const dir = join(BACKUP_DIR, `${stamp()}_${reason}`);
  mkdirSync(dir, { recursive: true });
  await prisma.$executeRawUnsafe(`VACUUM INTO '${join(dir, 'jadou.db').replace(/'/g, "''")}'`);
  if (existsSync(UPLOAD_DIR)) cpSync(UPLOAD_DIR, join(dir, 'uploads'), { recursive: true });
  await prune();
  return basename(dir);
}

export function listBackups() {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((d) => existsSync(join(BACKUP_DIR, d, 'jadou.db')))
    .map((d) => ({ name: d, size: statSync(join(BACKUP_DIR, d, 'jadou.db')).size, createdAt: statSync(join(BACKUP_DIR, d, 'jadou.db')).mtime.toISOString() }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

async function prune() {
  const { keep } = await getSetting('backup');
  const autos = listBackups().filter((b) => b.name.endsWith('_auto'));
  for (const b of autos.slice(keep ?? 14)) rmSync(join(BACKUP_DIR, b.name), { recursive: true, force: true });
}

export async function autoBackup() {
  const cfg = await getSetting('backup');
  if (!cfg.auto) return;
  const last = listBackups().find((b) => b.name.endsWith('_auto'));
  if (!last || Date.now() - new Date(last.createdAt).getTime() > 20 * 3600 * 1000) {
    const name = await createBackup('auto');
    console.log(`  ♡ sauvegarde automatique : ${name}`);
  }
}

export async function restoreBackup(name: string) {
  const dir = join(BACKUP_DIR, basename(name));
  if (!existsSync(join(dir, 'jadou.db'))) throw Object.assign(new Error('Sauvegarde introuvable'), { status: 404 });
  await createBackup('before-restore');
  await prisma.$disconnect();
  for (const ext of ['-wal', '-shm', '-journal']) if (existsSync(DB_FILE + ext)) rmSync(DB_FILE + ext);
  copyFileSync(join(dir, 'jadou.db'), DB_FILE);
  if (existsSync(join(dir, 'uploads'))) cpSync(join(dir, 'uploads'), UPLOAD_DIR, { recursive: true });
  await reconnect();
}

export async function exportAll() {
  const data: Record<string, unknown> = {};
  for (const name of Object.keys(REGISTRY)) data[name] = (await delegate(name).findMany()).map((r: any) => serialize(name, r));
  return { app: 'Jadou Planner', version: 1, exportedAt: new Date().toISOString(), settings: await getAllSettings(), data };
}

export const backupRouter = Router();
backupRouter.get('/', (_req, res) => res.json(listBackups()));
backupRouter.post('/', async (_req, res, next) => {
  try {
    res.json({ name: await createBackup('manual') });
  } catch (e) {
    next(e);
  }
});
backupRouter.post('/restore', async (req, res, next) => {
  try {
    await restoreBackup(String(req.body?.name ?? ''));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
backupRouter.get('/download/:name', (req, res) => {
  const p = join(BACKUP_DIR, basename(req.params.name), 'jadou.db');
  if (!existsSync(p)) return res.status(404).end();
  res.download(p, `jadou-${basename(req.params.name)}.db`);
});

export const exportRouter = Router();
exportRouter.get('/json', async (_req, res, next) => {
  try {
    res.setHeader('Content-Disposition', `attachment; filename="jadou-planner-${stamp()}.json"`);
    res.json(await exportAll());
  } catch (e) {
    next(e);
  }
});
exportRouter.get('/csv/:resource', async (req, res, next) => {
  try {
    if (!(req.params.resource in REGISTRY)) return res.status(404).end();
    const rows = (await delegate(req.params.resource).findMany()).map((r: any) => {
      const s = serialize(req.params.resource, r)!;
      for (const k of Object.keys(s)) if (s[k] && typeof s[k] === 'object') s[k] = JSON.stringify(s[k]);
      return s;
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jadou-${req.params.resource}.csv"`);
    res.send('﻿' + Papa.unparse(rows, { delimiter: ';' }));
  } catch (e) {
    next(e);
  }
});
