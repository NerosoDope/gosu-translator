import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { jobAPI } from '@/lib/api';

export function useJobList(params?: any) {
  return useQuery(
    ['job', 'list', params],
    () => jobAPI.getList(params),
    { keepPreviousData: true }
  );
}

export function useJob(id: number) {
  return useQuery(
    ['job', id],
    () => jobAPI.get(id),
    { enabled: !!id }
  );
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation(
    (data: any) => jobAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['job']);
      },
    }
  );
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }: { id: number; data: any }) => jobAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['job']);
      },
    }
  );
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: number) => jobAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['job']);
      },
    }
  );
}
