import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { DATA_DIR, DB_FILE } from './paths';

mkdirSync(DATA_DIR, { recursive: true });
process.env.DATABASE_URL = `file:${DB_FILE}`;

export let prisma = new PrismaClient();

export async function reconnect() {
  await prisma.$disconnect();
  prisma = new PrismaClient();
  await prisma.$connect();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Delegate = any;

export function delegate(name: string): Delegate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (prisma as any)[name];
  if (!d) throw new Error(`Unknown model ${name}`);
  return d;
}
