import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { gameGlossaryAPI } from '@/lib/api';

export function useGameGlossaryList(params?: any) {
  return useQuery(['game-glossary', 'list', params], () => gameGlossaryAPI.getList(params), { keepPreviousData: true });
}

export function useGameGlossaryItem(id: number) {
  return useQuery(['game-glossary', id], () => gameGlossaryAPI.get(id), { enabled: !!id });
}

export function useCreateGameGlossary() {
  const queryClient = useQueryClient();
  return useMutation(gameGlossaryAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['game-glossary', 'list'])
  });
}

export function useUpdateGameGlossary() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => gameGlossaryAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['game-glossary', 'list'])
  });
}

export function useDeleteGameGlossary() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => gameGlossaryAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['game-glossary', 'list'])
  });
}
