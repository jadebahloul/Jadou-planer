import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, basename } from 'node:path';
import { prisma } from './db';
import { UPLOAD_DIR } from './paths';

mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = /^(image\/(png|jpe?g|webp|gif|avif|heic)|application\/pdf|audio\/.+|video\/(mp4|webm|quicktime)|text\/(plain|csv|markdown)|application\/(msword|vnd\.openxmlformats-officedocument\..+|vnd\.ms-excel|vnd\.oasis\.opendocument\..+))$/;
const INLINE = /^(image\/(png|jpe?g|webp|gif|avif)|application\/pdf|audio\/.+|video\/.+)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, randomBytes(16).toString('hex') + extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8)),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.test(file.mimetype)),
});

export const filesRouter = Router();

filesRouter.post('/', upload.array('files', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ error: 'Type de fichier non autorisé ou fichier manquant' });
    const out = [];
    for (const f of files) {
      const row = await prisma.fileAsset.create({ data: { storedName: f.filename, originalName: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 200), mime: f.mimetype, size: f.size } });
      out.push({ id: row.id, url: `/api/files/${row.storedName}`, name: row.originalName, mime: row.mime, size: row.size });
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
});

filesRouter.get('/', async (_req, res) => {
  const rows = await prisma.fileAsset.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(rows.map((r) => ({ ...r, url: `/api/files/${r.storedName}` })));
});

filesRouter.get('/:name', async (req, res) => {
  const name = basename(req.params.name);
  const row = await prisma.fileAsset.findUnique({ where: { storedName: name } });
  const p = join(UPLOAD_DIR, name);
  if (!row || !existsSync(p)) return res.status(404).end();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  const disp = INLINE.test(row.mime) && req.query.download !== '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(row.originalName)}`);
  res.sendFile(p);
});

filesRouter.delete('/:name', async (req, res) => {
  const name = basename(req.params.name);
  await prisma.fileAsset.deleteMany({ where: { storedName: name } });
  const p = join(UPLOAD_DIR, name);
  if (existsSync(p)) unlinkSync(p);
  res.json({ ok: true });
});
