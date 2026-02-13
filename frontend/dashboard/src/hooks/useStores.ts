import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '../api';
import { CreateStoreRequest } from '../types';

// Query keys
export const storeKeys = {
  all: ['stores'] as const,
  lists: () => [...storeKeys.all, 'list'] as const,
  list: (filters: { page?: number; limit?: number; status?: string; engine?: string }) =>
    [...storeKeys.lists(), filters] as const,
  details: () => [...storeKeys.all, 'detail'] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
};

// Hook to fetch all stores
export function useStores(params?: { page?: number; limit?: number; status?: string; engine?: string }) {
  return useQuery({
    queryKey: storeKeys.list(params || {}),
    queryFn: () => storeApi.list(params),
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

// Hook to fetch a single store
export function useStore(id: string) {
  return useQuery({
    queryKey: storeKeys.detail(id),
    queryFn: () => storeApi.get(id),
    enabled: !!id,
  });
}

// Hook to create a store
export function useCreateStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateStoreRequest) => storeApi.create(data),
    onSuccess: () => {
      // Invalidate and refetch stores list
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
    },
  });
}

// Hook to delete a store
export function useDeleteStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => storeApi.delete(id),
    onSuccess: () => {
      // Invalidate and refetch stores list
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
    },
  });
}
