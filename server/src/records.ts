/**
 * Record service: every write in the app (UI, Quick Capture, Jadou AI) goes through here,
 * so the interconnection rules ("une seule saisie doit suffire") always apply.
 */
import { delegate, prisma } from './db';
import { REGISTRY, getResource, type FieldDef } from '../../shared/registry';
import { serialize, validateInput } from './validate';
import { nextOccurrence, today } from '../../shared/dates';

type Row = Record<string, any>;

export async function getRecord(resource: string, id: number): Promise<Row | null> {
  return serialize(resource, await delegate(resource).findUnique({ where: { id } })) as Row | null;
}

export async function createRecord(resource: string, input: Row): Promise<Row> {
  const data = validateInput(resource, input, false);
  await beforeSave(resource, data, null);
  const row = await delegate(resource).create({ data });
  await afterSave(resource, row, null);
  return (await getRecord(resource, row.id))!;
}

export async function updateRecord(resource: string, id: number, input: Row): Promise<Row> {
  const prev = await delegate(resource).findUnique({ where: { id } });
  if (!prev) throw Object.assign(new Error('Introuvable'), { status: 404 });
  const data = validateInput(resource, input, true);
  await beforeSave(resource, data, prev);
  const row = await delegate(resource).update({ where: { id }, data });
  await afterSave(resource, row, prev);
  return (await getRecord(resource, id))!;
}

export async function deleteRecord(resource: string, id: number, depth = 0): Promise<void> {
  const prev = await delegate(resource).findUnique({ where: { id } });
  if (!prev) return;
  await delegate(resource).delete({ where: { id } });
  if (depth > 4) return;
  // generic cascade / nullify on referencing rows
  for (const [name, def] of Object.entries(REGISTRY)) {
    for (const [fname, f] of Object.entries(def.fields as Record<string, FieldDef>)) {
      if (f.type !== 'ref' || f.ref !== resource) continue;
      if (f.onDelete === 'cascade') {
        const children = await delegate(name).findMany({ where: { [fname]: id }, select: { id: true } });
        for (const c of children) await deleteRecord(name, c.id, depth + 1);
      } else {
        await delegate(name).updateMany({ where: { [fname]: id }, data: { [fname]: null } });
      }
    }
  }
  // generated rows linked through sourceType/sourceId
  await prisma.task.deleteMany({ where: { sourceType: resource, sourceId: id } });
  await prisma.transaction.deleteMany({ where: { sourceType: resource, sourceId: id } });
  if (resource === 'homework' && prev.taskId) await prisma.task.deleteMany({ where: { id: prev.taskId } });
}

// ------------------------------------------------------------------ hooks

async function beforeSave(resource: string, data: Row, prev: Row | null) {
  const merged = { ...(prev ?? {}), ...data };
  if (resource === 'task') {
    if (data.status === 'done' && prev?.status !== 'done') data.completedAt = new Date().toISOString();
    if (data.status && data.status !== 'done') data.completedAt = null;
  }
  if (resource === 'lashAppointment' && merged.serviceId) {
    const svc = await prisma.lashService.findUnique({ where: { id: merged.serviceId } });
    if (svc) {
      if (merged.price == null && svc.price != null) data.price = svc.price;
      if (!prev && input0(data.durationMin) && svc.durationMin) data.durationMin = svc.durationMin;
    }
  }
  if (resource === 'toeicExam' && merged.listening != null && merged.reading != null && (data.listening !== undefined || data.reading !== undefined)) data.total = merged.listening + merged.reading;
  if (resource === 'wishlistItem' && data.status === 'purchased' && !merged.purchasedAt) data.purchasedAt = today();
  if (resource === 'goal' && Array.isArray(safeJson(merged.steps)) && safeJson(merged.steps).length) {
    const steps = safeJson(merged.steps) as { done?: boolean }[];
    data.progress = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  }
  if (resource === 'airbnbBooking' && merged.checkIn && merged.checkOut && merged.checkOut < merged.checkIn) {
    throw Object.assign(new Error('Le départ doit être après l’arrivée'), { status: 400 });
  }
}

const input0 = (v: unknown) => v == null || v === 120;
const safeJson = (v: unknown) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

async function upsertLinkedTx(sourceType: string, sourceId: number, tx: Row | null) {
  const existing = await prisma.transaction.findFirst({ where: { sourceType, sourceId } });
  if (!tx) {
    if (existing) await prisma.transaction.delete({ where: { id: existing.id } });
    return null;
  }
  const data = { ...tx, sourceType, sourceId };
  if (existing) return prisma.transaction.update({ where: { id: existing.id }, data });
  return prisma.transaction.create({ data });
}

async function upsertLinkedTask(sourceType: string, sourceId: number, task: Row | null) {
  const existing = await prisma.task.findFirst({ where: { sourceType, sourceId } });
  if (!task) {
    if (existing) await prisma.task.delete({ where: { id: existing.id } });
    return null;
  }
  if (existing) return prisma.task.update({ where: { id: existing.id }, data: task });
  return prisma.task.create({ data: { status: 'todo', subtasks: '[]', focusMinutes: 0, recurrence: 'none', focus: false, ...task, sourceType, sourceId } });
}

async function afterSave(resource: string, row: Row, prev: Row | null) {
  switch (resource) {
    case 'homework': {
      const course = row.courseId ? await prisma.course.findUnique({ where: { id: row.courseId } }) : null;
      const t = await upsertLinkedTask('homework', row.id, {
        title: `${row.title}${course ? ` · ${course.name}` : ''}`,
        category: 'devoirs',
        date: row.dueDate,
        time: row.dueTime,
        priority: row.priority,
        status: row.status,
        description: row.instructions,
        subtasks: row.subtasks ?? '[]',
      });
      if (t && row.taskId !== t.id) await prisma.homework.update({ where: { id: row.id }, data: { taskId: t.id } });
      break;
    }
    case 'task': {
      // mirror status back to the homework
      if (row.sourceType === 'homework' && row.sourceId && prev && (prev.status !== row.status || prev.date !== row.date)) {
        await prisma.homework.updateMany({ where: { id: row.sourceId }, data: { status: row.status, dueDate: row.date ?? undefined } });
      }
      // recurring tasks: spawn next occurrence when completed
      if (row.status === 'done' && prev?.status !== 'done' && row.recurrence && row.recurrence !== 'none' && row.date) {
        const next = nextOccurrence(row.date, row.recurrence);
        if (next) {
          const exists = await prisma.task.findFirst({ where: { title: row.title, date: next, recurrence: row.recurrence } });
          if (!exists) {
            const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _d, ...rest } = row;
            const subtasks = (safeJson(row.subtasks) as { done?: boolean }[] | null) ?? [];
            await prisma.task.create({
              data: { ...rest, date: next, status: 'todo', focusMinutes: 0, completedAt: null, subtasks: JSON.stringify(subtasks.map((s) => ({ ...s, done: false }))) },
            });
          }
        }
      }
      break;
    }
    case 'lashAppointment': {
      const client = await prisma.client.findUnique({ where: { id: row.clientId } });
      const svc = row.serviceId ? await prisma.lashService.findUnique({ where: { id: row.serviceId } }) : null;
      const label = `Cils · ${client?.name ?? 'Cliente'}${svc ? ` · ${svc.name}` : ''}`;
      let tx: Row | null = null;
      const day = row.start.slice(0, 10);
      if (row.accountId) {
        const lost = row.status === 'cancelled' || row.status === 'no_show';
        if (!lost && row.paymentStatus === 'paid' && row.price) tx = { label, amount: row.price, type: 'income', category: 'cils', date: day, accountId: row.accountId };
        else if (row.paymentStatus !== 'unpaid' && row.deposit) tx = { label: `${label} (acompte)`, amount: row.deposit, type: 'income', category: 'cils', date: day, accountId: row.accountId };
      }
      const t = await upsertLinkedTx('lashAppointment', row.id, tx);
      if ((t?.id ?? null) !== row.transactionId) await prisma.lashAppointment.update({ where: { id: row.id }, data: { transactionId: t?.id ?? null } });
      break;
    }
    case 'airbnbBooking': {
      const listing = await prisma.airbnbListing.findUnique({ where: { id: row.listingId } });
      const net = (row.amount || 0) - (row.fees || 0);
      const tx =
        row.status === 'paid' && row.accountId && net > 0
          ? { label: `Airbnb · ${row.guest}${listing ? ` · ${listing.name}` : ''}`, amount: net, type: 'income', category: 'airbnb', date: row.checkIn, accountId: row.accountId }
          : null;
      const t = await upsertLinkedTx('airbnbBooking', row.id, tx);
      if ((t?.id ?? null) !== row.transactionId) await prisma.airbnbBooking.update({ where: { id: row.id }, data: { transactionId: t?.id ?? null } });
      const active = row.status !== 'cancelled' && row.status !== 'inquiry';
      await upsertLinkedTask(
        'airbnbBooking',
        row.id,
        active
          ? { title: `Ménage & préparation · ${listing?.name ?? 'Airbnb'} (départ ${row.guest})`, category: 'airbnb', date: row.checkOut, priority: 'high', description: 'Ménage, linge, réassort, vérifications.', subtasks: JSON.stringify(['Ménage', 'Linge', 'Réassort consommables', 'Vérifications & photos'].map((t, i) => ({ id: `s${i}`, title: t, done: false }))) }
          : null,
      );
      break;
    }
    case 'wishlistItem': {
      const tx =
        row.status === 'purchased' && row.accountId && row.price
          ? { label: `${row.name}${row.brand ? ` · ${row.brand}` : ''}`, amount: row.price, type: 'expense', category: ['beauty', 'perfume', 'haircare', 'skincare'].includes(row.category) ? 'beaute' : row.category === 'travel' ? 'voyages' : 'shopping', date: row.purchasedAt ?? today(), accountId: row.accountId }
          : null;
      const t = await upsertLinkedTx('wishlistItem', row.id, tx);
      if ((t?.id ?? null) !== row.transactionId) await prisma.wishlistItem.update({ where: { id: row.id }, data: { transactionId: t?.id ?? null } });
      break;
    }
  }
}

export function isResource(name: string) {
  return !!getResource(name);
}
