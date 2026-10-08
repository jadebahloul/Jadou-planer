import { Router } from 'express';
import { delegate } from './db';
import { REGISTRY, type ResourceDef } from '../../shared/registry';

export const searchRouter = Router();

searchRouter.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    const results: { resource: string; id: number; title: string; subtitle: string; date?: string | null }[] = [];
    for (const [name, d] of Object.entries(REGISTRY)) {
      const def = d as ResourceDef;
      if (!def.search.length) continue;
      const rows = await delegate(name).findMany({ where: { OR: def.search.map((f) => ({ [f]: { contains: q } })) }, take: 8 });
      for (const r of rows) {
        const title = String(r[def.titleField] ?? def.label);
        const hit = def.search.map((f) => r[f]).find((v) => typeof v === 'string' && v.toLowerCase().includes(q.toLowerCase())) as string | undefined;
        results.push({ resource: name, id: r.id, title: title.slice(0, 120), subtitle: `${def.label}${hit && hit !== title ? ' · ' + snippet(hit, q) : ''}`, date: def.dateField ? r[def.dateField] : null });
      }
    }
    res.json(results.slice(0, 60));
  } catch (e) {
    next(e);
  }
});

function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  const s = Math.max(0, i - 30);
  return (s > 0 ? '…' : '') + text.slice(s, s + 90).replace(/\s+/g, ' ') + (text.length > s + 90 ? '…' : '');
}
