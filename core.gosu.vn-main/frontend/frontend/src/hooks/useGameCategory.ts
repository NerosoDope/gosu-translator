import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { gameCategoryAPI } from '@/lib/api';

export function useGameCategoryList(params?: any) {
  return useQuery(['game-category', 'list', params], () => gameCategoryAPI.getList(params), { keepPreviousData: true });
}

export function useGameCategoryItem(id: number) {
  return useQuery(['game-category', id], () => gameCategoryAPI.get(id), { enabled: !!id });
}

export function useCreateGameCategory() {
  const queryClient = useQueryClient();
  return useMutation(gameCategoryAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['game-category', 'list'])
  });
}

export function useUpdateGameCategory() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => gameCategoryAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['game-category', 'list'])
  });
}

export function useDeleteGameCategory() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => gameCategoryAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['game-category', 'list'])
  });
}
