// Safe schema sync before each start: backup the DB, then `prisma db push` (refuses destructive changes).
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BACKUP_DIR, DB_FILE, DATA_DIR, ROOT } from '../src/paths';

mkdirSync(DATA_DIR, { recursive: true });
const schema = join(ROOT, 'server/prisma/schema.prisma');
execSync(`npx tsx ${join(ROOT, 'server/scripts/gen-prisma.ts')}`, { stdio: 'inherit', cwd: ROOT });
execSync(`npx prisma generate --schema ${schema}`, { stdio: 'ignore', cwd: ROOT });
if (existsSync(DB_FILE)) {
  const dir = join(BACKUP_DIR, 'pre-migrate');
  mkdirSync(dir, { recursive: true });
  copyFileSync(DB_FILE, join(dir, 'jadou.db'));
}
execSync(`npx prisma db push --schema ${schema} --skip-generate`, { stdio: 'inherit', cwd: ROOT, env: { ...process.env, DATABASE_URL: `file:${DB_FILE}` } });
