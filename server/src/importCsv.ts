import { Router } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from './db';
import { detectTxCategory, normalize } from '../../shared/parser';

export const importRouter = Router();

/** Rows are mapped client-side; the server validates, categorises and de-duplicates. */
importRouter.post('/transactions', async (req, res, next) => {
  try {
    const accountId = Number(req.body?.accountId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 5000) : [];
    const dryRun = !!req.body?.dryRun;
    if (!(await prisma.bankAccount.findUnique({ where: { id: accountId } }))) return res.status(400).json({ error: 'Compte invalide' });
    let imported = 0;
    let duplicates = 0;
    let invalid = 0;
    const preview: unknown[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const date = String(r.date ?? '');
      const amount = Number(r.amount);
      const label = String(r.label ?? '').trim().slice(0, 200);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount === 0 || !label) {
        invalid++;
        continue;
      }
      const importHash = createHash('sha1').update(`${accountId}|${date}|${amount.toFixed(2)}|${normalize(label)}`).digest('hex');
      if (seen.has(importHash) || (await prisma.transaction.findFirst({ where: { importHash } }))) {
        duplicates++;
        continue;
      }
      seen.add(importHash);
      const data = { accountId, date, label, amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income', category: amount < 0 ? detectTxCategory(label) : /salaire|alternance|pharmacie/i.test(label) ? 'salaire' : 'autre', importHash, sourceType: 'csv' };
      if (dryRun) preview.push(data);
      else await prisma.transaction.create({ data });
      imported++;
    }
    res.json({ imported, duplicates, invalid, preview: preview.slice(0, 20) });
  } catch (e) {
    next(e);
  }
});
