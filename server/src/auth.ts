import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from './db';
import { seedIfNeeded } from './seed';

const COOKIE = 'jadou_session';
const SESSION_DAYS = 30;
const attempts = new Map<string, { n: number; until: number }>();

export async function hasUser() {
  return (await prisma.user.count()) > 0;
}

export async function createSession(res: Response, userId: number) {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  res.cookie(COOKIE, id, { httpOnly: true, sameSite: 'strict', secure: false, expires: expiresAt, path: '/' });
}

export async function setup(req: Request, res: Response) {
  if (await hasUser()) return res.status(409).json({ error: 'Déjà configuré' });
  const { name, password } = req.body ?? {};
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  const user = await prisma.user.create({ data: { name: String(name || 'Jadou').slice(0, 60), passwordHash: await bcrypt.hash(password, 12) } });
  await seedIfNeeded();
  await createSession(res, user.id);
  res.json({ ok: true });
}

export async function login(req: Request, res: Response) {
  const ip = req.ip ?? 'local';
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) return res.status(429).json({ error: 'Trop de tentatives, réessayez dans une minute.' });
  const user = await prisma.user.findFirst();
  const ok = user && typeof req.body?.password === 'string' && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(ip, { n, until: n >= 5 ? Date.now() + 60000 : 0 });
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  attempts.delete(ip);
  await createSession(res, user!.id);
  res.json({ ok: true });
}

export async function logout(req: Request, res: Response) {
  const sid = req.cookies?.[COOKIE];
  if (sid) await prisma.session.deleteMany({ where: { id: sid } });
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}

export async function changePassword(req: Request, res: Response) {
  const user = await prisma.user.findFirst();
  const { current, next } = req.body ?? {};
  if (!user || !(await bcrypt.compare(String(current ?? ''), user.passwordHash))) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  if (typeof next !== 'string' || next.length < 6) return res.status(400).json({ error: '6 caractères minimum' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await prisma.session.deleteMany({ where: { NOT: { id: req.cookies?.[COOKIE] } } });
  res.json({ ok: true });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sid = req.cookies?.[COOKIE];
  if (!sid) return res.status(401).json({ error: 'auth' });
  const s = await prisma.session.findUnique({ where: { id: sid } });
  if (!s || s.expiresAt < new Date()) return res.status(401).json({ error: 'auth' });
  next();
}

/** CSRF defence: mutating requests must carry a custom header (cannot be sent cross-site without CORS). */
export function requireAppHeader(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-jadou') !== '1') return res.status(403).json({ error: 'Requête refusée' });
  next();
}
