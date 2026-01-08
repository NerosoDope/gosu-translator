import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { promptsAPI } from '@/lib/api';

export function usePromptsList(params?: any) {
  return useQuery(['prompts', 'list', params], () => promptsAPI.getList(params), { keepPreviousData: true });
}

export function usePrompt(id: number) {
  return useQuery(['prompts', id], () => promptsAPI.get(id), { enabled: !!id });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();
  return useMutation(promptsAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['prompts', 'list'])
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => promptsAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['prompts', 'list'])
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => promptsAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['prompts', 'list'])
  });
}
