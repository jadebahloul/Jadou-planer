// Small at-rest encryption for integration secrets (tokens), key kept in data/secret.key (never committed).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths';

const KEY_FILE = join(DATA_DIR, 'secret.key');
function key() {
  if (!existsSync(KEY_FILE)) writeFileSync(KEY_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
  return Buffer.from(readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
}
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv.toString('hex'), c.getAuthTag().toString('hex'), enc.toString('hex')].join('.');
}
export function unseal(sealed: string | undefined | null): string | null {
  if (!sealed) return null;
  try {
    const [iv, tag, data] = sealed.split('.');
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
    d.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
