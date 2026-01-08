import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { dictionaryAPI } from '@/lib/api';

export function useDictionaryList(params?: any) {
  return useQuery(['dictionary', 'list', params], () => dictionaryAPI.getList(params), { keepPreviousData: true });
}

export function useDictionaryItem(id: number) {
  return useQuery(['dictionary', id], () => dictionaryAPI.get(id), { enabled: !!id });
}

export function useCreateDictionary() {
  const queryClient = useQueryClient();
  return useMutation(dictionaryAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['dictionary', 'list'])
  });
}

export function useUpdateDictionary() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => dictionaryAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['dictionary', 'list'])
  });
}

export function useDeleteDictionary() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => dictionaryAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['dictionary', 'list'])
  });
}
