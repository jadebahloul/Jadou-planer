import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from './api';
import type { ResourceName } from '@shared/registry';

export type Row = Record<string, any> & { id: number };

export interface ListParams {
  where?: Record<string, unknown>;
  orderBy?: string;
  dir?: 'asc' | 'desc';
  take?: number;
}

export function listPath(resource: string, p: ListParams = {}) {
  const q = new URLSearchParams();
  if (p.where) q.set('where', JSON.stringify(p.where));
  if (p.orderBy) q.set('orderBy', p.orderBy);
  if (p.dir) q.set('dir', p.dir);
  if (p.take) q.set('take', String(p.take));
  const s = q.toString();
  return `/r/${resource}${s ? `?${s}` : ''}`;
}

export function useList<T extends Row = Row>(resource: ResourceName, params: ListParams = {}, opts: Partial<UseQueryOptions<T[]>> = {}) {
  return useQuery<T[]>({ queryKey: ['r', resource, params], queryFn: () => api<T[]>(listPath(resource, params)), ...opts });
}

export function useApi<T = any>(path: string | null, opts: Partial<UseQueryOptions<T>> = {}) {
  return useQuery<T>({ queryKey: ['api', path], queryFn: () => api<T>(path!), enabled: !!path, ...opts });
}

/** Any write may update other modules (linked records), so refresh everything. */
export function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useSave(resource: ResourceName, { silent = false } = {}) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: Record<string, unknown> }) =>
      id ? api<Row>(`/r/${resource}/${id}`, { method: 'PATCH', body: data }) : api<Row>(`/r/${resource}`, { method: 'POST', body: data }),
    onSuccess: () => {
      invalidate();
      if (!silent) toast.success('Enregistré ♡');
    },
    onError: (e: ApiError) => toast.error(e.message + (e.fields ? ' — ' + Object.entries(e.fields).map(([k, v]) => `${k} : ${v}`).join(', ') : '')),
  });
}

export function useRemove(resource: ResourceName) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api(`/r/${resource}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast('Supprimé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSettings() {
  return useQuery<Record<string, any>>({ queryKey: ['settings'], queryFn: () => api('/settings'), staleTime: 60_000 });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api(`/settings/${key}`, { method: 'PUT', body: { value } }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });
}
