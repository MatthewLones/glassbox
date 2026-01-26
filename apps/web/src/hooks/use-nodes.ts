import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesAPI } from '@/lib/api';
import type { CreateNodeRequest, UpdateNodeRequest } from '@glassbox/shared-types';

export function useNodes(projectId: string, parentId?: string) {
  return useQuery({
    queryKey: ['nodes', projectId, parentId],
    queryFn: () => nodesAPI.list(projectId, { parentId }),
    enabled: !!projectId,
  });
}

export function useNode(nodeId: string) {
  return useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => nodesAPI.get(nodeId),
    enabled: !!nodeId,
  });
}

export function useNodeChildren(nodeId: string) {
  return useQuery({
    queryKey: ['node-children', nodeId],
    queryFn: () => nodesAPI.getChildren(nodeId),
    enabled: !!nodeId,
  });
}

export function useCreateNode(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNodeRequest) => nodesAPI.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes', projectId] });
    },
  });
}

export function useUpdateNode(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNodeRequest) => nodesAPI.update(nodeId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['node', nodeId], data);
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}

export function useDeleteNode(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => nodesAPI.delete(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.removeQueries({ queryKey: ['node', nodeId] });
    },
  });
}

export function useNodeLock(nodeId: string) {
  const queryClient = useQueryClient();

  const acquireLock = useMutation({
    mutationFn: () => nodesAPI.acquireLock(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['node', nodeId] });
    },
  });

  const releaseLock = useMutation({
    mutationFn: () => nodesAPI.releaseLock(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['node', nodeId] });
    },
  });

  return { acquireLock, releaseLock };
}
