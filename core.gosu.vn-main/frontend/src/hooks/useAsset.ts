import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { assetAPI } from '@/lib/api';

export function useAssetList(params?: any) {
  return useQuery(
    ['asset', 'list', params],
    () => assetAPI.getList(params),
    { keepPreviousData: true }
  );
}

export function useAsset(id: number) {
  return useQuery(
    ['asset', id],
    () => assetAPI.get(id),
    { enabled: !!id }
  );
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation(
    (data: any) => assetAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['asset']);
      },
    }
  );
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }: { id: number; data: any }) => assetAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['asset']);
      },
    }
  );
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: number) => assetAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['asset']);
      },
    }
  );
}
