import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { game_glossaryAPI } from '@/lib/api';

export function useGame_glossaryList(params?: any) {
  return useQuery(
    ['game_glossary', 'list', params],
    () => game_glossaryAPI.getList(params),
    { keepPreviousData: true }
  );
}

export function useGame_glossary(id: number) {
  return useQuery(
    ['game_glossary', id],
    () => game_glossaryAPI.get(id),
    { enabled: !!id }
  );
}

export function useCreateGame_glossary() {
  const queryClient = useQueryClient();
  return useMutation(
    (data: any) => game_glossaryAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['game_glossary']);
      },
    }
  );
}

export function useUpdateGame_glossary() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }: { id: number; data: any }) => game_glossaryAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['game_glossary']);
      },
    }
  );
}

export function useDeleteGame_glossary() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: number) => game_glossaryAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['game_glossary']);
      },
    }
  );
}
