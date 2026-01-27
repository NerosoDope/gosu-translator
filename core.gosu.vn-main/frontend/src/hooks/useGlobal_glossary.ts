import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { global_glossaryAPI } from '@/lib/api';

export function useGlobal_glossaryList(params?: any) {
  return useQuery(
    ['global-glossary', 'list', params],
    () => global_glossaryAPI.getList(params).then(res => res.data),
    { keepPreviousData: true }
  );
}

export function useGlobal_glossary(id: number) {
  return useQuery(
    ['global-glossary', id],
    () => global_glossaryAPI.get(id),
    { enabled: !!id }
  );
}

export function useCreateGlobal_glossary() {
  const queryClient = useQueryClient();
  return useMutation(
    (data: any) => global_glossaryAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['global-glossary']);
      },
    }
  );
}

export function useUpdateGlobal_glossary() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }: { id: number; data: any }) => global_glossaryAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['global-glossary']);
      },
    }
  );
}

export function useDeleteGlobal_glossary() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: number) => global_glossaryAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['global-glossary']);
      },
    }
  );
}