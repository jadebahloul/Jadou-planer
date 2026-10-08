import { REGISTRY, getResource, type FieldDef, type ResourceDef } from '../../shared/registry';

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Validation failed: ' + Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join(', '));
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function coerce(f: FieldDef, v: unknown, key: string, errors: Record<string, string>): unknown {
  if (v === undefined) return undefined;
  if (v === null || v === '') {
    if (f.type === 'json') return JSON.stringify(f.default ?? null);
    if (f.type === 'tags') return '[]';
    if (f.type === 'boolean') return false;
    return null;
  }
  switch (f.type) {
    case 'string':
    case 'text': {
      const s = String(v);
      if (s.length > (f.type === 'text' ? 50000 : 500)) errors[key] = 'Trop long';
      return s;
    }
    case 'url':
    case 'image': {
      const s = String(v).trim();
      if (!/^(https?:\/\/|\/api\/files\/)/.test(s)) errors[key] = 'Lien invalide (http/https)';
      return s;
    }
    case 'number':
    case 'money': {
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
      if (!Number.isFinite(n)) errors[key] = 'Nombre invalide';
      else {
        if (f.min !== undefined && n < f.min) errors[key] = `Minimum ${f.min}`;
        if (f.max !== undefined && n > f.max) errors[key] = `Maximum ${f.max}`;
      }
      return f.type === 'money' ? Math.round(n * 100) / 100 : n;
    }
    case 'int':
    case 'rating':
    case 'ref': {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (!Number.isInteger(n)) errors[key] = 'Entier invalide';
      else {
        if (f.min !== undefined && n < f.min) errors[key] = `Minimum ${f.min}`;
        if (f.max !== undefined && n > f.max) errors[key] = `Maximum ${f.max}`;
      }
      return n;
    }
    case 'boolean':
      return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
    case 'date': {
      const s = String(v).slice(0, 10);
      if (!DATE_RE.test(s)) errors[key] = 'Date invalide';
      return s;
    }
    case 'datetime': {
      const s = String(v).slice(0, 16);
      if (!DATETIME_RE.test(s)) errors[key] = 'Date/heure invalide';
      return s;
    }
    case 'time': {
      const s = String(v).slice(0, 5);
      if (!TIME_RE.test(s)) errors[key] = 'Heure invalide';
      return s;
    }
    case 'color': {
      const s = String(v);
      if (!COLOR_RE.test(s)) errors[key] = 'Couleur invalide';
      return s;
    }
    case 'enum': {
      const s = String(v);
      if (f.options && !f.options.some((o) => o.value === s)) errors[key] = 'Valeur non autorisée';
      return s;
    }
    case 'json':
      return JSON.stringify(v);
    case 'tags': {
      const arr = Array.isArray(v) ? v : String(v).split(',');
      return JSON.stringify(arr.map((t) => String(t).trim()).filter(Boolean).slice(0, 50));
    }
  }
}

/** Validate & coerce an input payload for create (partial=false) or update (partial=true). */
export function validateInput(resource: string, input: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const def = getResource(resource);
  if (!def) throw new ValidationError({ _: 'Ressource inconnue' });
  const errors: Record<string, string> = {};
  const out: Record<string, unknown> = {};
  for (const [key, f] of Object.entries(def.fields)) {
    let v = input[key];
    if (v === undefined && !partial && f.default !== undefined) v = f.default;
    const c = coerce(f, v, key, errors);
    if (c !== undefined) out[key] = c;
    if (f.required && (partial ? key in input && (c === null || c === '') : c === null || c === undefined || c === '')) {
      errors[key] = 'Obligatoire';
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}

/** Parse JSON/tags columns for API output. */
export function serialize(resource: string, row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return row;
  const def = getResource(resource) as ResourceDef;
  const out: Record<string, unknown> = { ...row };
  for (const [key, f] of Object.entries(def.fields)) {
    if ((f.type === 'json' || f.type === 'tags') && typeof out[key] === 'string') {
      try {
        out[key] = JSON.parse(out[key] as string);
      } catch {
        out[key] = f.type === 'tags' ? [] : null;
      }
    }
  }
  return out;
}

const OPS = new Set(['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'endsWith']);

/** Sanitize a client "where" object: only known fields & simple operators. */
export function sanitizeWhere(resource: string, where: unknown): Record<string, unknown> {
  const def = getResource(resource);
  if (!def || !where || typeof where !== 'object') return {};
  const allowed = new Set([...Object.keys(def.fields), 'id', 'createdAt', 'updatedAt']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(where as Record<string, unknown>)) {
    if (k === 'OR' || k === 'AND') {
      if (Array.isArray(v)) out[k] = v.map((w) => sanitizeWhere(resource, w));
      continue;
    }
    if (!allowed.has(k)) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const ops: Record<string, unknown> = {};
      for (const [op, ov] of Object.entries(v as Record<string, unknown>)) if (OPS.has(op)) ops[op] = ov;
      out[k] = ops;
    } else out[k] = v;
  }
  return out;
}

export const RESOURCES = REGISTRY;
