import type {
  Organization,
  Project,
  Node,
  File,
  User,
  AgentExecution,
  PaginatedResponse,
  CreateNodeRequest,
  UpdateNodeRequest,
  FileUploadRequest,
  FileUploadResponse,
} from '@glassbox/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new APIError(response.status, error.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Organizations
export const orgsAPI = {
  list: () => fetchAPI<{ data: Organization[] }>('/api/v1/orgs'),
  get: (id: string) => fetchAPI<Organization>(`/api/v1/orgs/${id}`),
  create: (data: Partial<Organization>) =>
    fetchAPI<Organization>('/api/v1/orgs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Organization>) =>
    fetchAPI<Organization>(`/api/v1/orgs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/api/v1/orgs/${id}`, { method: 'DELETE' }),
};

// Projects
export const projectsAPI = {
  list: (orgId: string) =>
    fetchAPI<{ data: Project[] }>(`/api/v1/orgs/${orgId}/projects`),
  get: (id: string) => fetchAPI<Project>(`/api/v1/projects/${id}`),
  create: (orgId: string, data: Partial<Project>) =>
    fetchAPI<Project>(`/api/v1/orgs/${orgId}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Project>) =>
    fetchAPI<Project>(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
};

// Nodes
export const nodesAPI = {
  list: (projectId: string, params?: { parentId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.parentId) searchParams.set('parentId', params.parentId);
    const query = searchParams.toString();
    return fetchAPI<PaginatedResponse<Node>>(
      `/api/v1/projects/${projectId}/nodes${query ? `?${query}` : ''}`
    );
  },
  get: (id: string) => fetchAPI<Node>(`/api/v1/nodes/${id}`),
  create: (projectId: string, data: CreateNodeRequest) =>
    fetchAPI<Node>(`/api/v1/projects/${projectId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateNodeRequest) =>
    fetchAPI<Node>(`/api/v1/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/api/v1/nodes/${id}`, { method: 'DELETE' }),
  getChildren: (id: string) =>
    fetchAPI<{ data: Node[] }>(`/api/v1/nodes/${id}/children`),
  getVersions: (id: string) =>
    fetchAPI<{ data: Node[] }>(`/api/v1/nodes/${id}/versions`),
  acquireLock: (id: string) =>
    fetchAPI<void>(`/api/v1/nodes/${id}/lock`, { method: 'POST' }),
  releaseLock: (id: string) =>
    fetchAPI<void>(`/api/v1/nodes/${id}/lock`, { method: 'DELETE' }),
};

// Agent Executions
export const executionsAPI = {
  start: (nodeId: string, config?: Record<string, unknown>) =>
    fetchAPI<AgentExecution>(`/api/v1/nodes/${nodeId}/execute`, {
      method: 'POST',
      body: JSON.stringify(config || {}),
    }),
  getCurrent: (nodeId: string) =>
    fetchAPI<AgentExecution>(`/api/v1/nodes/${nodeId}/execution`),
  get: (id: string) => fetchAPI<AgentExecution>(`/api/v1/executions/${id}`),
  getTrace: (id: string) =>
    fetchAPI<{ data: unknown[] }>(`/api/v1/executions/${id}/trace`),
  pause: (nodeId: string) =>
    fetchAPI<void>(`/api/v1/nodes/${nodeId}/execution/pause`, { method: 'POST' }),
  resume: (nodeId: string) =>
    fetchAPI<void>(`/api/v1/nodes/${nodeId}/execution/resume`, { method: 'POST' }),
  cancel: (nodeId: string) =>
    fetchAPI<void>(`/api/v1/nodes/${nodeId}/execution/cancel`, { method: 'POST' }),
};

// Files
export const filesAPI = {
  getUploadURL: (orgId: string, data: FileUploadRequest) =>
    fetchAPI<FileUploadResponse>(`/api/v1/orgs/${orgId}/files/upload`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirmUpload: (id: string) =>
    fetchAPI<File>(`/api/v1/files/${id}/confirm`, { method: 'POST' }),
  get: (id: string) => fetchAPI<File>(`/api/v1/files/${id}`),
  delete: (id: string) =>
    fetchAPI<void>(`/api/v1/files/${id}`, { method: 'DELETE' }),
};

// Search
export const searchAPI = {
  search: (orgId: string, query: string, types?: string[]) =>
    fetchAPI<{ data: unknown[] }>(`/api/v1/orgs/${orgId}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, types }),
    }),
  semantic: (orgId: string, query: string) =>
    fetchAPI<{ data: unknown[] }>(`/api/v1/orgs/${orgId}/search/semantic`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
};

// Users
export const usersAPI = {
  me: () => fetchAPI<User>('/api/v1/users/me'),
  update: (data: Partial<User>) =>
    fetchAPI<User>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Unified API object for convenient imports
export const api = {
  orgs: orgsAPI,
  projects: projectsAPI,
  nodes: nodesAPI,
  executions: executionsAPI,
  files: filesAPI,
  search: searchAPI,
  users: usersAPI,
};

export { APIError };
