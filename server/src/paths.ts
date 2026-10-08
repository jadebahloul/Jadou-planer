import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '../..');
export const DATA_DIR = process.env.JADOU_DATA_DIR ? resolve(process.env.JADOU_DATA_DIR) : join(ROOT, 'data');
export const DB_FILE = join(DATA_DIR, 'jadou.db');
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
export const VAULT_DIR = join(DATA_DIR, 'vault');
export const BACKUP_DIR = join(DATA_DIR, 'backups');
export const WEB_DIST = join(ROOT, 'web', 'dist');
