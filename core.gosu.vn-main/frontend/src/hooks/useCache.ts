import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { cacheAPI } from '@/lib/api';

export function useCacheList(params?: any) {
  return useQuery(['cache', 'list', params], () => cacheAPI.getList(params), { keepPreviousData: true });
}

export function useCacheItem(id: number) {
  return useQuery(['cache', id], () => cacheAPI.get(id), { enabled: !!id });
}

export function useCreateCache() {
  const queryClient = useQueryClient();
  return useMutation(cacheAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['cache', 'list'])
  });
}

export function useUpdateCache() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => cacheAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['cache', 'list'])
  });
}

export function useDeleteCache() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => cacheAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['cache', 'list'])
  });
}
