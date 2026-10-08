import { Router } from 'express';
import { prisma } from '../db';
import { localAnswer, LOCAL_HELP, type AiAction, type AiReply } from './local';
import { ollamaChat, ollamaStatus } from './ollama';
import { buildContext } from './context';
import { validateInput, ValidationError } from '../validate';
import { createRecord, updateRecord } from '../records';
import { parseCapture } from '../../../shared/parser';
import { getResource } from '../../../shared/registry';

export const aiRouter = Router();

aiRouter.get('/status', async (_req, res) => res.json(await ollamaStatus()));

aiRouter.get('/history', async (_req, res) => {
  const rows = await prisma.chatMessage.findMany({ orderBy: { id: 'desc' }, take: 60 });
  res.json(rows.reverse().map((r) => ({ ...r, actions: r.actions ? JSON.parse(r.actions) : [] })));
});

aiRouter.delete('/history', async (_req, res) => {
  await prisma.chatMessage.deleteMany();
  res.json({ ok: true });
});

/** Drop actions that would not pass validation, so every proposal shown can really be saved. */
function checkActions(actions: AiAction[]): AiAction[] {
  const ok: AiAction[] = [];
  for (const a of actions) {
    if (!a || !getResource(a.resource) || !['create', 'update'].includes(a.op)) continue;
    if (a.op === 'update' && !Number.isInteger(a.id)) continue;
    try {
      const data = { ...(a.data ?? {}) };
      if (a.resource === 'lashAppointment' && !data.clientId) data.clientId = 0; // resolved from hints at execution
      validateInput(a.resource, data, a.op === 'update');
      ok.push({ ...a, summary: String(a.summary ?? '').slice(0, 200) });
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
    }
  }
  return ok.slice(0, 12);
}

aiRouter.post('/chat', async (req, res, next) => {
  try {
    const message = String(req.body?.message ?? '').trim().slice(0, 4000);
    if (!message) return res.status(400).json({ error: 'Message vide' });
    await prisma.chatMessage.create({ data: { role: 'user', content: message } });
    const status = await ollamaStatus();
    let out: AiReply | null = await localAnswer(message);
    const useLLM = status.available && status.modelInstalled && (!out || out.creative);
    if (useLLM) {
      try {
        const history = (await prisma.chatMessage.findMany({ orderBy: { id: 'desc' }, take: 12 })).reverse().slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
        const r = await ollamaChat(message, history, await buildContext());
        out = { reply: r.reply, actions: r.actions, engine: 'ollama' };
      } catch (e) {
        console.error('Ollama error', e);
        if (!out) out = { reply: `Je n’ai pas pu joindre le modèle local (${(e as Error).message}).\n\n${LOCAL_HELP}`, actions: [], engine: 'local' };
      }
    }
    if (!out) out = { reply: LOCAL_HELP, actions: [], engine: 'local' };
    out.actions = checkActions(out.actions);
    const saved = await prisma.chatMessage.create({ data: { role: 'assistant', content: out.reply, actions: JSON.stringify(out.actions.map((a) => ({ ...a, state: 'pending' }))) } });
    res.json({ id: saved.id, ...out, aiAvailable: !!useLLM });
  } catch (e) {
    next(e);
  }
});

async function resolveHints(a: AiAction) {
  const data = { ...a.data };
  if (a.resource === 'lashAppointment') {
    const name = a.hints?.clientName?.trim();
    if (!data.clientId) {
      if (!name) throw Object.assign(new Error('Indique le nom de la cliente'), { status: 400 });
      const found = (await prisma.client.findMany()).find((c) => c.name?.toLowerCase().includes(name.toLowerCase()));
      data.clientId = found ? found.id : (await createRecord('client', { name })).id;
    }
    if (!data.serviceId && a.hints?.serviceName) {
      const svc = (await prisma.lashService.findMany()).find((s) => s.name?.toLowerCase() === a.hints!.serviceName.toLowerCase());
      if (svc) {
        data.serviceId = svc.id;
        if (data.price == null) data.price = svc.price;
        if (svc.durationMin) data.durationMin = svc.durationMin;
      }
    }
  }
  return data;
}

/** Execute one confirmed action. */
aiRouter.post('/execute', async (req, res, next) => {
  try {
    const a = req.body?.action as AiAction;
    const messageId = Number(req.body?.messageId);
    const index = Number(req.body?.index);
    if (!a || !getResource(a.resource)) return res.status(400).json({ error: 'Action invalide' });
    const data = await resolveHints(a);
    const row = a.op === 'update' ? await updateRecord(a.resource, Number(a.id), data) : await createRecord(a.resource, data);
    if (messageId) await markAction(messageId, index, 'done');
    res.json({ ok: true, row });
  } catch (e) {
    next(e);
  }
});

aiRouter.post('/dismiss', async (req, res) => {
  await markAction(Number(req.body?.messageId), Number(req.body?.index), 'dismissed');
  res.json({ ok: true });
});

async function markAction(messageId: number, index: number, state: string) {
  const m = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!m?.actions) return;
  const arr = JSON.parse(m.actions);
  if (arr[index]) arr[index].state = state;
  await prisma.chatMessage.update({ where: { id: messageId }, data: { actions: JSON.stringify(arr) } });
}

/** Quick Capture: free sentence → proposed record (always local & deterministic). */
aiRouter.post('/capture', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Texte vide' });
  res.json(parseCapture(text));
});

aiRouter.post('/capture/save', async (req, res, next) => {
  try {
    const a: AiAction = { op: 'create', resource: req.body?.resource, data: req.body?.data ?? {}, summary: '', hints: req.body?.hints };
    if (!getResource(a.resource)) return res.status(400).json({ error: 'Ressource invalide' });
    res.json(await createRecord(a.resource, await resolveHints(a)));
  } catch (e) {
    next(e);
  }
});
