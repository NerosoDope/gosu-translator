import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { gameAPI } from '@/lib/api';

export function useGameList(params?: any) {
  return useQuery(
    ['game', 'list', params],
    () => gameAPI.getList(params),
    { keepPreviousData: true }
  );
}

export function useGame(id: number) {
  return useQuery(
    ['game', id],
    () => gameAPI.get(id),
    { enabled: !!id }
  );
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  return useMutation(
    (data: any) => gameAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['game']);
      },
    }
  );
}

export function useUpdateGame() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }: { id: number; data: any }) => gameAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['game']);
      },
    }
  );
}

export function useDeleteGame() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: number) => gameAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['game']);
      },
    }
  );
}
