// =====================================================
// CORE TYPES
// =====================================================

export type UUID = string;
export type ISODateTime = string;

// =====================================================
// ORGANIZATIONS
// =====================================================

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  settings: OrganizationSettings;
  eventSourcingLevel: 'full' | 'snapshot' | 'audit';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OrganizationSettings {
  models?: ModelConfig[];
  selfHostedEndpoint?: string;
  selfHostedKey?: string;
  defaultModel?: string;
  agentPolicies?: AgentPolicy[];
}

export interface ModelConfig {
  name: string;
  litellmModel: string;
  apiKey?: string;
  apiBase?: string;
}

export interface AgentPolicy {
  action: string;
  allowed: boolean;
  requiresApproval?: boolean;
}

// =====================================================
// USERS
// =====================================================

export interface User {
  id: UUID;
  cognitoSub: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  settings: UserSettings;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  notifications?: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  slack?: boolean;
}

export type OrgRole = 'owner' | 'admin' | 'member' | 'guest';
export type ProjectRole = 'admin' | 'member' | 'viewer';

export interface OrgMember {
  id: UUID;
  orgId: UUID;
  userId: UUID;
  role: OrgRole;
  user?: User;
  createdAt: ISODateTime;
}

export interface ProjectMember {
  id: UUID;
  projectId: UUID;
  userId: UUID;
  role: ProjectRole;
  user?: User;
  createdAt: ISODateTime;
}

// =====================================================
// PROJECTS
// =====================================================

export interface Project {
  id: UUID;
  orgId: UUID;
  name: string;
  description?: string;
  settings: ProjectSettings;
  workflowStates: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProjectSettings {
  defaultNodeStatus?: string;
  autoAssignAgent?: boolean;
}

// =====================================================
// FILES
// =====================================================

export interface File {
  id: UUID;
  orgId: UUID;
  storageKey: string;
  storageBucket: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  processingStatus: FileProcessingStatus;
  extractedText?: string;
  processingError?: string;
  metadata: Record<string, unknown>;
  createdAt: ISODateTime;
  uploadedBy?: UUID;
}

export type FileProcessingStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface FileUploadRequest {
  filename: string;
  contentType: string;
}

export interface FileUploadResponse {
  fileId: UUID;
  uploadUrl: string;
  expiresAt: ISODateTime;
}

// =====================================================
// NODES (Core Primitive)
// =====================================================

export interface Node {
  id: UUID;
  orgId: UUID;
  projectId: UUID;
  parentId?: UUID;
  title: string;
  description?: string;
  status: string;
  authorType: AuthorType;
  authorUserId?: UUID;
  supervisorUserId?: UUID;
  version: number;
  metadata: NodeMetadata;
  position: NodePosition;
  lockedBy?: UUID;
  lockedAt?: ISODateTime;
  lockExpiresAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;

  // Populated relations
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  children?: Node[];
  author?: User;
  supervisor?: User;
}

export type AuthorType = 'human' | 'agent';

export interface NodeMetadata {
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: ISODateTime;
  [key: string]: unknown;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeVersion {
  id: UUID;
  nodeId: UUID;
  version: number;
  snapshot: Node;
  changeType: NodeChangeType;
  changeSummary?: string;
  changedBy?: UUID;
  createdAt: ISODateTime;
}

export type NodeChangeType =
  | 'created'
  | 'updated'
  | 'status_change'
  | 'inputs_changed'
  | 'outputs_changed';

// =====================================================
// NODE INPUTS
// =====================================================

export interface NodeInput {
  id: UUID;
  nodeId: UUID;
  inputType: NodeInputType;
  fileId?: UUID;
  sourceNodeId?: UUID;
  sourceNodeVersion?: number;
  externalUrl?: string;
  textContent?: string;
  label?: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
  createdAt: ISODateTime;

  // Populated relations
  file?: File;
  sourceNode?: Node;
}

export type NodeInputType = 'file' | 'node_reference' | 'external_link' | 'text';

export interface CreateNodeInputRequest {
  inputType: NodeInputType;
  fileId?: UUID;
  sourceNodeId?: UUID;
  sourceNodeVersion?: number;
  externalUrl?: string;
  textContent?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// NODE OUTPUTS
// =====================================================

export interface NodeOutput {
  id: UUID;
  nodeId: UUID;
  outputType: NodeOutputType;
  fileId?: UUID;
  structuredData?: Record<string, unknown>;
  textContent?: string;
  externalUrl?: string;
  label?: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
  createdAt: ISODateTime;

  // Populated relations
  file?: File;
}

export type NodeOutputType = 'file' | 'structured_data' | 'text' | 'external_link';

export interface CreateNodeOutputRequest {
  outputType: NodeOutputType;
  fileId?: UUID;
  structuredData?: Record<string, unknown>;
  textContent?: string;
  externalUrl?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// NODE DEPENDENCIES
// =====================================================

export interface NodeDependency {
  id: UUID;
  sourceNodeId: UUID;
  targetNodeId: UUID;
  sourceOutputId?: UUID;
  targetInputId?: UUID;
  createdAt: ISODateTime;
}

// =====================================================
// AGENT EXECUTIONS
// =====================================================

export interface AgentExecution {
  id: UUID;
  nodeId: UUID;
  status: AgentExecutionStatus;
  langgraphThreadId?: string;
  traceSummary: TraceEvent[];
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  errorMessage?: string;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number;
  modelId?: string;
  createdAt: ISODateTime;
}

export type AgentExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled';

export interface TraceEvent {
  id: UUID;
  executionId: UUID;
  eventType: TraceEventType;
  eventData: Record<string, unknown>;
  timestamp: ISODateTime;
  durationMs?: number;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  sequenceNumber: number;
}

export type TraceEventType =
  | 'execution_start'
  | 'llm_call'
  | 'tool_call'
  | 'decision'
  | 'human_input_requested'
  | 'human_input_received'
  | 'subnode_created'
  | 'output_added'
  | 'error'
  | 'checkpoint'
  | 'execution_complete';

// =====================================================
// TEMPLATES
// =====================================================

export interface Template {
  id: UUID;
  orgId?: UUID;
  name: string;
  description?: string;
  structure: TemplateStructure;
  agentConfig: AgentConfig;
  isPublic: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy?: UUID;
}

export interface TemplateStructure {
  inputs: TemplateInput[];
  outputs: TemplateOutput[];
  subNodes?: TemplateSubNode[];
  suggestedWorkflowStates?: string[];
}

export interface TemplateInput {
  label: string;
  type: NodeInputType;
  required: boolean;
  description?: string;
}

export interface TemplateOutput {
  label: string;
  type: NodeOutputType;
  description?: string;
}

export interface TemplateSubNode {
  title: string;
  authorType: AuthorType;
  templateId?: UUID;
}

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  tools?: string[];
}

// =====================================================
// NOTIFICATIONS
// =====================================================

export interface Notification {
  id: UUID;
  userId: UUID;
  orgId: UUID;
  type: NotificationType;
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: UUID;
  readAt?: ISODateTime;
  createdAt: ISODateTime;
}

export type NotificationType =
  | 'execution_complete'
  | 'execution_failed'
  | 'human_input_needed'
  | 'node_assigned'
  | 'mention'
  | 'comment';

// =====================================================
// API REQUESTS/RESPONSES
// =====================================================

export interface CreateNodeRequest {
  projectId: UUID;
  parentId?: UUID;
  title: string;
  description?: string;
  status?: string;
  authorType: AuthorType;
  supervisorUserId?: UUID;
  metadata?: NodeMetadata;
  position?: NodePosition;
}

export interface UpdateNodeRequest {
  title?: string;
  description?: string;
  status?: string;
  metadata?: NodeMetadata;
  position?: NodePosition;
}

export interface ExecuteNodeRequest {
  model?: string;
  config?: AgentConfig;
}

export interface SearchRequest {
  query: string;
  types?: ('node' | 'file')[];
  projectId?: UUID;
  limit?: number;
  offset?: number;
}

export interface SemanticSearchRequest {
  query: string;
  projectId?: UUID;
  limit?: number;
  threshold?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// =====================================================
// WEBSOCKET MESSAGES
// =====================================================

export type WSClientMessage =
  | { type: 'subscribe'; payload: { channel: string } }
  | { type: 'unsubscribe'; payload: { channel: string } }
  | { type: 'presence'; payload: { nodeId: UUID; action: PresenceAction } }
  | { type: 'lock_acquire'; payload: { nodeId: UUID }; requestId: string }
  | { type: 'lock_release'; payload: { nodeId: UUID } };

export type WSServerMessage =
  | { type: 'subscribed'; payload: { channel: string } }
  | { type: 'node_updated'; payload: { nodeId: UUID; changes: Partial<Node>; version: number } }
  | { type: 'node_created'; payload: { node: Node } }
  | { type: 'node_deleted'; payload: { nodeId: UUID } }
  | { type: 'presence_update'; payload: { nodeId: UUID; users: PresenceUser[] } }
  | { type: 'lock_acquired'; payload: { nodeId: UUID; lockedBy: UUID } }
  | { type: 'lock_released'; payload: { nodeId: UUID } }
  | { type: 'execution_update'; payload: { nodeId: UUID; status: AgentExecutionStatus; progress?: ExecutionProgress } }
  | { type: 'error'; payload: { code: string; message: string }; requestId?: string };

export type PresenceAction = 'viewing' | 'editing' | 'idle';

export interface PresenceUser {
  userId: UUID;
  name: string;
  avatarUrl?: string;
  action: PresenceAction;
  lastSeen: ISODateTime;
}

export interface ExecutionProgress {
  currentStep?: string;
  stepsCompleted?: number;
  totalSteps?: number;
  tokensUsed?: number;
}
