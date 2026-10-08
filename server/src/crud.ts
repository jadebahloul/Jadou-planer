import { Router } from 'express';
import { delegate } from './db';
import { getResource } from '../../shared/registry';
import { sanitizeWhere, serialize, ValidationError } from './validate';
import { createRecord, deleteRecord, updateRecord, getRecord } from './records';

export const crud = Router();

crud.param('resource', (req, res, next, name) => {
  if (!getResource(name)) return res.status(404).json({ error: 'Ressource inconnue' });
  next();
});

crud.get('/:resource', async (req, res, next) => {
  try {
    const { resource } = req.params;
    const def = getResource(resource)!;
    let where = {};
    if (typeof req.query.where === 'string') where = sanitizeWhere(resource, JSON.parse(req.query.where));
    const orderField = typeof req.query.orderBy === 'string' && (req.query.orderBy in def.fields || ['createdAt', 'id', 'updatedAt'].includes(req.query.orderBy)) ? req.query.orderBy : def.orderBy.field;
    const dir = req.query.dir === 'asc' || req.query.dir === 'desc' ? req.query.dir : def.orderBy.dir;
    const take = Math.min(Number(req.query.take) || 5000, 5000);
    const rows = await delegate(resource).findMany({ where, orderBy: [{ [orderField]: dir }, { id: 'asc' }], take });
    res.json(rows.map((r: any) => serialize(resource, r)));
  } catch (e) {
    next(e);
  }
});

crud.get('/:resource/:id', async (req, res, next) => {
  try {
    const row = await getRecord(req.params.resource, Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Introuvable' });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

crud.post('/:resource', async (req, res, next) => {
  try {
    res.status(201).json(await createRecord(req.params.resource, req.body ?? {}));
  } catch (e) {
    next(e);
  }
});

crud.patch('/:resource/:id', async (req, res, next) => {
  try {
    res.json(await updateRecord(req.params.resource, Number(req.params.id), req.body ?? {}));
  } catch (e) {
    next(e);
  }
});

crud.delete('/:resource/:id', async (req, res, next) => {
  try {
    await deleteRecord(req.params.resource, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export function errorHandler(err: any, _req: any, res: any, _next: any) {
  if (err instanceof ValidationError) return res.status(400).json({ error: 'Formulaire invalide', fields: err.fields });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Requête invalide' });
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erreur interne' : err.message });
}
