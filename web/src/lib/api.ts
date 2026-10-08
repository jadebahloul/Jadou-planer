export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
    headers: { 'x-jadou': '1', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: 'same-origin',
  });
  if (res.status === 401 && !path.startsWith('/auth')) {
    window.dispatchEvent(new Event('jadou:logout'));
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Erreur ${res.status}`, data?.fields);
  return data as T;
}

export async function uploadFiles(files: File[] | FileList): Promise<{ id: number; url: string; name: string; mime: string }[]> {
  const fd = new FormData();
  for (const f of Array.from(files)) fd.append('files', f);
  return api('/files', { form: fd });
}
