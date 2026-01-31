import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsAPI } from '@/lib/api';
import type { Organization } from '@glassbox/shared-types';

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgsAPI.list(),
  });
}

export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: () => orgsAPI.get(orgId),
    enabled: !!orgId,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Organization>) => orgsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Organization>) => orgsAPI.update(orgId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['organization', orgId], data);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useDeleteOrganization(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => orgsAPI.delete(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.removeQueries({ queryKey: ['organization', orgId] });
    },
  });
}
