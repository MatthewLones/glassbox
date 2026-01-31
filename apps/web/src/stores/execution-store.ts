import { create } from 'zustand';
import type {
  AgentExecution,
  AgentExecutionStatus,
  TraceEvent,
  ExecutionProgress,
  UUID,
} from '@glassbox/shared-types';

// HITL intervention types
export type HITLRequestType = 'input' | 'approval';

export interface HITLRequest {
  id: string;
  executionId: string;
  nodeId: string;
  type: HITLRequestType;
  prompt: string;
  options?: string[];
  timestamp: string;
}

interface ExecutionState {
  // Active executions by node ID
  executions: Map<UUID, AgentExecution>;

  // Progress updates (real-time from WebSocket)
  progressUpdates: Map<UUID, ExecutionProgress>;

  // Pending HITL requests
  hitlRequests: HITLRequest[];

  // Currently viewing execution (for trace panel)
  activeExecutionId: string | null;

  // Actions
  setExecution: (nodeId: UUID, execution: AgentExecution) => void;
  updateExecutionStatus: (nodeId: UUID, status: AgentExecutionStatus, progress?: ExecutionProgress) => void;
  addTraceEvent: (nodeId: UUID, event: TraceEvent) => void;
  removeExecution: (nodeId: UUID) => void;

  // HITL actions
  addHITLRequest: (request: HITLRequest) => void;
  removeHITLRequest: (requestId: string) => void;

  // UI actions
  setActiveExecutionId: (executionId: string | null) => void;

  // Getters (computed in selectors, but these are convenience functions)
  getExecution: (nodeId: UUID) => AgentExecution | undefined;
  getProgress: (nodeId: UUID) => ExecutionProgress | undefined;
  isNodeExecuting: (nodeId: UUID) => boolean;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: new Map(),
  progressUpdates: new Map(),
  hitlRequests: [],
  activeExecutionId: null,

  setExecution: (nodeId, execution) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      newExecutions.set(nodeId, execution);
      return { executions: newExecutions };
    }),

  updateExecutionStatus: (nodeId, status, progress) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      const execution = newExecutions.get(nodeId);
      if (execution) {
        newExecutions.set(nodeId, { ...execution, status });
      }

      const newProgress = new Map(state.progressUpdates);
      if (progress) {
        newProgress.set(nodeId, progress);
      }

      return { executions: newExecutions, progressUpdates: newProgress };
    }),

  addTraceEvent: (nodeId, event) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      const execution = newExecutions.get(nodeId);
      if (execution) {
        newExecutions.set(nodeId, {
          ...execution,
          traceSummary: [...execution.traceSummary, event],
        });
      }
      return { executions: newExecutions };
    }),

  removeExecution: (nodeId) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      newExecutions.delete(nodeId);
      const newProgress = new Map(state.progressUpdates);
      newProgress.delete(nodeId);
      return { executions: newExecutions, progressUpdates: newProgress };
    }),

  addHITLRequest: (request) =>
    set((state) => ({
      hitlRequests: [...state.hitlRequests, request],
    })),

  removeHITLRequest: (requestId) =>
    set((state) => ({
      hitlRequests: state.hitlRequests.filter((r) => r.id !== requestId),
    })),

  setActiveExecutionId: (executionId) =>
    set({ activeExecutionId: executionId }),

  getExecution: (nodeId) => get().executions.get(nodeId),
  getProgress: (nodeId) => get().progressUpdates.get(nodeId),
  isNodeExecuting: (nodeId) => {
    const execution = get().executions.get(nodeId);
    return execution?.status === 'running' || execution?.status === 'paused';
  },
}));

// Selectors for common queries
export const selectActiveExecution = (state: ExecutionState) => {
  if (!state.activeExecutionId) return null;
  const executions = Array.from(state.executions.values());
  return executions.find((exec) => exec.id === state.activeExecutionId) || null;
};

export const selectRunningExecutions = (state: ExecutionState) =>
  Array.from(state.executions.values()).filter(
    (e) => e.status === 'running' || e.status === 'paused'
  );

export const selectPendingHITLCount = (state: ExecutionState) =>
  state.hitlRequests.length;
