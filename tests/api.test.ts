/**
 * End-to-end API test: spins up the real server on a temporary database and checks
 * the interconnection rules of the brief ("une seule saisie doit suffire").
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4800 + Math.floor(Math.random() * 500);
const B = `http://127.0.0.1:${PORT}/api`;
let dir = '';
let srv: ChildProcess;
let cookie = '';
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

async function call(path: string, body?: unknown, method?: string) {
  const r = await fetch(B + path, { method: method ?? (body !== undefined ? 'POST' : 'GET'), headers: { 'x-jadou': '1', 'content-type': 'application/json', cookie }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jadou-test-'));
  const env = { ...process.env, JADOU_DATA_DIR: dir, PORT: String(PORT) };
  execSync('npx tsx server/scripts/migrate.ts', { env, stdio: 'ignore' });
  srv = spawn('npx', ['tsx', 'server/src/index.ts'], { env, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${B}/health`)).ok) break;
    } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
});

afterAll(() => {
  srv?.kill();
  rmSync(dir, { recursive: true, force: true });
});

describe('Jadou Planner API', () => {
  it('protects the API and creates the local account', async () => {
    expect((await call('/r/task')).status).toBe(401);
    expect((await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(403); // CSRF header required
    expect((await call('/auth/setup', { name: 'Jade', password: 'secret123' })).status).toBe(200);
    expect((await call('/r/task')).status).toBe(200);
  });

  it('seeds the configuration from the brief (program, services, habits)', async () => {
    expect((await call('/r/workoutTemplate')).data.map((t: any) => t.name)).toEqual(expect.arrayContaining(['Lower Body A', 'Lower Body B', 'Home Workout']));
    expect((await call('/r/lashService')).data).toHaveLength(5);
    expect((await call('/r/transaction')).data).toHaveLength(0); // no fake data
  });

  it('validates forms', async () => {
    const r = await call('/r/transaction', { label: 'x', amount: 'abc', type: 'nope', date: 'hier' });
    expect(r.status).toBe(400);
    expect(Object.keys(r.data.fields)).toEqual(expect.arrayContaining(['amount', 'type', 'date', 'accountId']));
  });

  let acc = 0;
  let sav = 0;
  it('keeps account balances right and ignores internal transfers in income', async () => {
    acc = (await call('/r/bankAccount', { name: 'Courant', type: 'current', initialBalance: 1000 })).data.id;
    sav = (await call('/r/bankAccount', { name: 'Livret A', type: 'savings', initialBalance: 0 })).data.id;
    await call('/r/transaction', { label: 'Courses', type: 'expense', amount: 50, date: today, accountId: acc });
    await call('/r/transaction', { label: 'Épargne', type: 'transfer', amount: 200, date: today, accountId: acc, toAccountId: sav });
    const m = (await call('/stats/money')).data;
    expect(m.accounts.find((a: any) => a.id === acc).balance).toBe(750);
    expect(m.accounts.find((a: any) => a.id === sav).balance).toBe(200);
    expect(m.income).toBe(0);
    expect(m.expense).toBe(50);
  });

  it('turns a cashed lash appointment into revenue, calendar item and client history', async () => {
    const svc = (await call('/r/lashService')).data[2];
    await call(`/r/lashService/${svc.id}`, { price: 80, durationMin: 150 }, 'PATCH');
    const client = (await call('/r/client', { name: 'Sarah' })).data;
    const appt = (await call('/r/lashAppointment', { clientId: client.id, serviceId: svc.id, start: `${today}T14:00`, status: 'done', paymentStatus: 'paid', accountId: acc })).data;
    expect(appt.price).toBe(80); // pre-filled from the service
    const txs = (await call(`/r/transaction?where=${encodeURIComponent(JSON.stringify({ sourceType: 'lashAppointment' }))}`)).data;
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ amount: 80, type: 'income', category: 'cils' });
    expect((await call('/stats/lash')).data.today).toBe(80);
    const cal = (await call(`/calendar?from=${today}&to=${today}`)).data;
    expect(cal.some((i: any) => i.source === 'lashAppointment')).toBe(true);
    // un-cashing removes the revenue
    await call(`/r/lashAppointment/${appt.id}`, { paymentStatus: 'unpaid' }, 'PATCH');
    expect((await call(`/r/transaction?where=${encodeURIComponent(JSON.stringify({ sourceType: 'lashAppointment' }))}`)).data).toHaveLength(0);
  });

  it('mirrors homework into My Tasks and My Calendar, both ways', async () => {
    const hw = (await call('/r/homework', { title: 'Dossier SEO', dueDate: today })).data;
    const task = (await call(`/r/task/${hw.taskId}`)).data;
    expect(task).toMatchObject({ category: 'devoirs', date: today, sourceType: 'homework' });
    await call(`/r/task/${task.id}`, { status: 'done' }, 'PATCH');
    expect((await call(`/r/homework/${hw.id}`)).data.status).toBe('done');
    await call(`/r/homework/${hw.id}`, undefined, 'DELETE');
    expect((await call(`/r/task/${task.id}`)).status).toBe(404);
  });

  it('recreates recurring tasks when completed', async () => {
    const t = (await call('/r/task', { title: 'Vocabulaire TOEIC', date: today, recurrence: 'daily' })).data;
    await call(`/r/task/${t.id}`, { status: 'done' }, 'PATCH');
    const all = (await call(`/r/task?where=${encodeURIComponent(JSON.stringify({ title: 'Vocabulaire TOEIC' }))}`)).data;
    expect(all).toHaveLength(2);
    expect(all.find((x: any) => x.id !== t.id).status).toBe('todo');
  });

  it('creates the Airbnb cleaning task and payout', async () => {
    const l = (await call('/r/airbnbListing', { name: 'Studio' })).data;
    const b = (await call('/r/airbnbBooking', { listingId: l.id, guest: 'Tom', checkIn: today, checkOut: today, amount: 300, fees: 50, status: 'paid', accountId: acc })).data;
    expect((await call(`/r/task?where=${encodeURIComponent(JSON.stringify({ sourceType: 'airbnbBooking', sourceId: b.id }))}`)).data).toHaveLength(1);
    expect((await call(`/r/transaction/${b.transactionId}`)).data.amount).toBe(250);
  });

  it('imports bank CSV rows and detects duplicates', async () => {
    const rows = [{ date: today, label: 'NETFLIX', amount: -13.49 }, { date: today, label: 'Virement salaire', amount: 1100 }];
    expect((await call('/import/transactions', { accountId: acc, rows })).data).toMatchObject({ imported: 2, duplicates: 0 });
    expect((await call('/import/transactions', { accountId: acc, rows })).data).toMatchObject({ imported: 0, duplicates: 2 });
  });

  it('answers with Jadou AI in local mode and executes confirmed actions', async () => {
    const r = (await call('/ai/chat', { message: 'Combien ai-je sur mes comptes ?' })).data;
    expect(r.engine).toBe('local');
    expect(r.reply).toContain('Courant');
    const w = (await call('/ai/chat', { message: 'Ajoute ce parfum à ma wishlist : Libre YSL 120 €' })).data;
    expect(w.actions[0]).toMatchObject({ resource: 'wishlistItem', op: 'create' });
    expect((await call('/r/wishlistItem')).data).toHaveLength(0); // nothing saved before confirmation
    await call('/ai/execute', { action: w.actions[0], messageId: w.id, index: 0 });
    expect((await call('/r/wishlistItem')).data[0]).toMatchObject({ name: 'Libre YSL', price: 120 });
    const appt = (await call('/ai/chat', { message: 'Ajoute un rendez-vous cliente demain 10h avec Léa' })).data;
    await call('/ai/execute', { action: appt.actions[0] });
    expect((await call('/r/client')).data.some((c: any) => c.name === 'Léa')).toBe(true);
  });

  it('searches globally and cascades deletes', async () => {
    const hits = (await call('/search?q=Sarah')).data;
    expect(hits.some((h: any) => h.resource === 'client')).toBe(true);
    const c = (await call('/r/client')).data.find((x: any) => x.name === 'Sarah');
    await call(`/r/client/${c.id}`, undefined, 'DELETE');
    expect((await call(`/r/lashAppointment?where=${encodeURIComponent(JSON.stringify({ clientId: c.id }))}`)).data).toHaveLength(0);
  });

  it('creates and lists backups, exports JSON', async () => {
    expect((await call('/backup', {})).status).toBe(200);
    expect((await call('/backup')).data.length).toBeGreaterThan(0);
    const exp = (await call('/export/json')).data;
    expect(exp.data.bankAccount).toHaveLength(2);
    expect(JSON.stringify(exp.settings)).not.toContain('appSecret');
  });
});
