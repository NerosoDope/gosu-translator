import { useQuery, useMutation, useQueryClient } from 'react-query';
import { jobAPI } from '@/lib/api';

export function useJobsList(params?: any) {
  return useQuery(['jobs', 'list', params], () => jobAPI.getList(params), { keepPreviousData: true });
}

export function useJob(id: number) {
  return useQuery(['job', id], () => jobAPI.get(id), { enabled: !!id });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation(jobAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['jobs', 'list'])
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => jobAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['jobs', 'list'])
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => jobAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['jobs', 'list'])
  });
}
