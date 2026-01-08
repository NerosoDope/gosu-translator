import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { jobsAPI } from '@/lib/api';

export function useJobsList(params?: any) {
  return useQuery(['jobs', 'list', params], () => jobsAPI.getList(params), { keepPreviousData: true });
}

export function useJob(id: number) {
  return useQuery(['job', id], () => jobsAPI.get(id), { enabled: !!id });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation(jobsAPI.create, {
    onSuccess: () => queryClient.invalidateQueries(['jobs', 'list'])
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation(({ id, data }: { id: number, data: any }) => jobsAPI.update(id, data), {
    onSuccess: () => queryClient.invalidateQueries(['jobs', 'list'])
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation((id: number) => jobsAPI.delete(id), {
    onSuccess: () => queryClient.invalidateQueries(['jobs', 'list'])
  });
}
