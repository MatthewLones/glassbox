import { useCallback } from 'react';
import { useExecutionStore, type HITLRequest } from '@/stores/execution-store';
import type {
  AgentExecution,
  AgentExecutionStatus,
  ExecutionProgress,
  TraceEvent,
  UUID,
} from '@glassbox/shared-types';
// import { api } from '@/lib/api'; // Uncomment when API is ready

// Mock execution for development
function createMockExecution(nodeId: UUID): AgentExecution {
  return {
    id: `exec-${Date.now()}`,
    nodeId,
    status: 'running',
    langgraphThreadId: `thread-${Date.now()}`,
    traceSummary: [
      {
        id: `evt-${Date.now()}-1`,
        executionId: `exec-${Date.now()}`,
        eventType: 'execution_start',
        eventData: {},
        timestamp: new Date().toISOString(),
        sequenceNumber: 1,
      },
    ],
    totalTokensIn: 0,
    totalTokensOut: 0,
    estimatedCostUsd: 0,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
}

// Simulate execution progress for development
function simulateExecution(
  nodeId: UUID,
  updateStatus: (nodeId: UUID, status: AgentExecutionStatus, progress?: ExecutionProgress) => void,
  addTraceEvent: (nodeId: UUID, event: TraceEvent) => void,
  addHITLRequest: (request: HITLRequest) => void
) {
  const executionId = `exec-${Date.now()}`;
  let sequence = 2;

  const steps = [
    { type: 'llm_call' as const, data: { prompt: 'Analyzing task requirements...', response: 'I will break this down into subtasks.' }, tokens: { in: 150, out: 50 } },
    { type: 'tool_call' as const, data: { tool: 'create_subnode', args: { title: 'Data Collection' } } },
    { type: 'llm_call' as const, data: { prompt: 'Processing collected data...', response: 'Data analysis complete.' }, tokens: { in: 200, out: 100 } },
    { type: 'human_input_requested' as const, data: { prompt: 'Should I proceed with generating the final report?' } },
    { type: 'tool_call' as const, data: { tool: 'add_output', args: { label: 'Analysis Report', type: 'text' } } },
    { type: 'execution_complete' as const, data: {} },
  ];

  let currentStep = 0;
  const totalSteps = steps.length;

  const runNextStep = () => {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    const event: TraceEvent = {
      id: `evt-${Date.now()}-${sequence}`,
      executionId,
      eventType: step.type,
      eventData: step.data,
      timestamp: new Date().toISOString(),
      sequenceNumber: sequence++,
      tokensIn: step.tokens?.in,
      tokensOut: step.tokens?.out,
      durationMs: Math.floor(Math.random() * 2000) + 500,
      model: step.type === 'llm_call' ? 'gpt-4' : undefined,
    };

    addTraceEvent(nodeId, event);

    // Update progress
    currentStep++;
    const progress: ExecutionProgress = {
      currentStep: step.type === 'llm_call' ? 'Processing...' : `Running ${step.data?.tool || step.type}`,
      stepsCompleted: currentStep,
      totalSteps,
      tokensUsed: (step.tokens?.in || 0) + (step.tokens?.out || 0),
    };

    if (step.type === 'execution_complete') {
      updateStatus(nodeId, 'complete', progress);
    } else if (step.type === 'human_input_requested') {
      updateStatus(nodeId, 'paused', progress);
      // Add HITL request
      addHITLRequest({
        id: `hitl-${Date.now()}`,
        executionId,
        nodeId,
        type: 'approval',
        prompt: step.data.prompt as string,
        timestamp: new Date().toISOString(),
      });
    } else {
      updateStatus(nodeId, 'running', progress);
      // Continue to next step
      setTimeout(runNextStep, 1500 + Math.random() * 1000);
    }
  };

  // Start simulation
  setTimeout(runNextStep, 500);
}

export function useExecution() {
  const {
    executions,
    progressUpdates,
    hitlRequests,
    setExecution,
    updateExecutionStatus,
    addTraceEvent,
    removeExecution,
    addHITLRequest,
    removeHITLRequest,
    setActiveExecutionId,
    getExecution,
    isNodeExecuting,
  } = useExecutionStore();

  // Start execution for a node
  const startExecution = useCallback(
    async (nodeId: UUID) => {
      // TODO: Replace with actual API call
      // const response = await api.executeNode(nodeId, {});
      // setExecution(nodeId, response);

      // For now, create mock execution
      const mockExecution = createMockExecution(nodeId);
      setExecution(nodeId, mockExecution);
      setActiveExecutionId(mockExecution.id);

      // Simulate execution
      simulateExecution(nodeId, updateExecutionStatus, addTraceEvent, addHITLRequest);

      return mockExecution;
    },
    [setExecution, setActiveExecutionId, updateExecutionStatus, addTraceEvent, addHITLRequest]
  );

  // Pause execution
  const pauseExecution = useCallback(
    async (nodeId: UUID) => {
      // TODO: API call to pause
      updateExecutionStatus(nodeId, 'paused');
    },
    [updateExecutionStatus]
  );

  // Resume execution
  const resumeExecution = useCallback(
    async (nodeId: UUID) => {
      // TODO: API call to resume
      updateExecutionStatus(nodeId, 'running');
    },
    [updateExecutionStatus]
  );

  // Cancel execution
  const cancelExecution = useCallback(
    async (nodeId: UUID) => {
      // TODO: API call to cancel
      updateExecutionStatus(nodeId, 'cancelled');
    },
    [updateExecutionStatus]
  );

  // Respond to HITL request
  const respondToHITL = useCallback(
    async (requestId: string, response: string | boolean) => {
      // TODO: API call to send response
      console.log('HITL Response:', { requestId, response });

      // Find the request to get the nodeId
      const request = hitlRequests.find(r => r.id === requestId);
      if (request) {
        // Resume execution after response
        updateExecutionStatus(request.nodeId, 'running');

        // Add trace event for the response
        addTraceEvent(request.nodeId, {
          id: `evt-${Date.now()}`,
          executionId: request.executionId,
          eventType: 'human_input_received',
          eventData: { input: response },
          timestamp: new Date().toISOString(),
          sequenceNumber: Date.now(),
        });

        // Simulate continuation
        setTimeout(() => {
          addTraceEvent(request.nodeId, {
            id: `evt-${Date.now()}-complete`,
            executionId: request.executionId,
            eventType: 'execution_complete',
            eventData: {},
            timestamp: new Date().toISOString(),
            sequenceNumber: Date.now(),
          });
          updateExecutionStatus(request.nodeId, 'complete', {
            stepsCompleted: 6,
            totalSteps: 6,
          });
        }, 2000);
      }

      removeHITLRequest(requestId);
    },
    [hitlRequests, updateExecutionStatus, addTraceEvent, removeHITLRequest]
  );

  return {
    // State
    executions,
    progressUpdates,
    hitlRequests,

    // Actions
    startExecution,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    respondToHITL,

    // Utilities
    getExecution,
    isNodeExecuting,
    setActiveExecutionId,
  };
}
