/**
 * Document Vault — files encrypted at rest with AES-256-GCM.
 * The key is derived (scrypt) from a vault passphrase that is never stored.
 */
import { Router } from 'express';
import multer from 'multer';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from './db';
import { VAULT_DIR } from './paths';
import { getSetting, setSetting } from './settings';

mkdirSync(VAULT_DIR, { recursive: true });
let unlocked: { key: Buffer; until: number } | null = null;
const TTL = 10 * 60 * 1000;

const derive = (pass: string, salt: string) => scryptSync(pass, Buffer.from(salt, 'hex'), 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

function key(): Buffer {
  if (!unlocked || unlocked.until < Date.now()) {
    unlocked = null;
    throw Object.assign(new Error('Coffre verrouillé'), { status: 423 });
  }
  unlocked.until = Date.now() + TTL;
  return unlocked.key;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
export const vaultRouter = Router();

vaultRouter.get('/status', async (_req, res) => {
  const v = await getSetting<{ salt?: string } | undefined>('vault');
  res.json({ configured: !!v?.salt, unlocked: !!unlocked && unlocked.until > Date.now() });
});

vaultRouter.post('/setup', async (req, res) => {
  const v = await getSetting<{ salt?: string } | undefined>('vault');
  if (v?.salt) return res.status(409).json({ error: 'Coffre déjà configuré' });
  const pass = String(req.body?.passphrase ?? '');
  if (pass.length < 8) return res.status(400).json({ error: 'Phrase secrète : 8 caractères minimum' });
  const salt = randomBytes(16).toString('hex');
  const k = derive(pass, salt);
  const check = scryptSync(k, 'jadou-vault-check', 32).toString('hex');
  await setSetting('vault', { salt, check });
  unlocked = { key: k, until: Date.now() + TTL };
  res.json({ ok: true });
});

vaultRouter.post('/unlock', async (req, res) => {
  const v = await getSetting<{ salt?: string; check?: string } | undefined>('vault');
  if (!v?.salt || !v.check) return res.status(400).json({ error: 'Coffre non configuré' });
  const k = derive(String(req.body?.passphrase ?? ''), v.salt);
  const check = scryptSync(k, 'jadou-vault-check', 32);
  if (!timingSafeEqual(check, Buffer.from(v.check, 'hex'))) return res.status(401).json({ error: 'Phrase secrète incorrecte' });
  unlocked = { key: k, until: Date.now() + TTL };
  res.json({ ok: true });
});

vaultRouter.post('/lock', (_req, res) => {
  unlocked = null;
  res.json({ ok: true });
});

vaultRouter.get('/files', async (_req, res, next) => {
  try {
    key();
    res.json(await prisma.vaultFile.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, originalName: true, mime: true, size: true, note: true, createdAt: true } }));
  } catch (e) {
    next(e);
  }
});

vaultRouter.post('/files', upload.single('file'), async (req, res, next) => {
  try {
    const k = key();
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', k, iv);
    const enc = Buffer.concat([cipher.update(req.file.buffer), cipher.final()]);
    const storedName = randomBytes(16).toString('hex') + '.enc';
    writeFileSync(join(VAULT_DIR, storedName), enc);
    const row = await prisma.vaultFile.create({ data: { storedName, originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200), mime: req.file.mimetype, size: req.file.size, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), note: req.body?.note ? String(req.body.note).slice(0, 500) : null } });
    res.json({ id: row.id });
  } catch (e) {
    next(e);
  }
});

vaultRouter.get('/files/:id', async (req, res, next) => {
  try {
    const k = key();
    const row = await prisma.vaultFile.findUnique({ where: { id: Number(req.params.id) } });
    if (!row) return res.status(404).end();
    const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(row.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(row.tag, 'hex'));
    const data = Buffer.concat([decipher.update(readFileSync(join(VAULT_DIR, row.storedName))), decipher.final()]);
    res.setHeader('Content-Type', row.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.originalName)}`);
    res.send(data);
  } catch (e) {
    next(e);
  }
});

vaultRouter.delete('/files/:id', async (req, res, next) => {
  try {
    key();
    const row = await prisma.vaultFile.findUnique({ where: { id: Number(req.params.id) } });
    if (row) {
      const p = join(VAULT_DIR, row.storedName);
      if (existsSync(p)) unlinkSync(p);
      await prisma.vaultFile.delete({ where: { id: row.id } });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
