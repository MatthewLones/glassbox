# GlassBox V2 Frontend API Client

This document covers the REST API client implementation, including all endpoints, error handling, and integration with React Query.

---

## Overview

The API client is a centralized module that handles all communication with the GlassBox backend.

**Location:** `apps/web/src/lib/api.ts`

**Features:**
- Typed endpoints using `@glassbox/shared-types`
- Automatic authentication header injection
- Consistent error handling with `APIError` class
- Base URL configuration via environment variable

---

## Configuration

### Base URL

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
```

### Authentication

All requests include the access token from localStorage:

```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

const token = localStorage.getItem('glassbox_access_token');
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

---

## API Structure

```typescript
export const api = {
  orgs: orgsAPI,           // Organization endpoints
  projects: projectsAPI,    // Project endpoints
  nodes: nodesAPI,          // Node endpoints
  executions: executionsAPI,// Agent execution endpoints
  files: filesAPI,          // File upload endpoints
  search: searchAPI,        // Search endpoints
  users: usersAPI,          // User endpoints
};
```

---

## Endpoint Reference

### Organizations

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/api/v1/orgs` | `orgs.list()` | List user's organizations |
| GET | `/api/v1/orgs/{id}` | `orgs.get(id)` | Get organization by ID |
| POST | `/api/v1/orgs` | `orgs.create(data)` | Create new organization |
| PATCH | `/api/v1/orgs/{id}` | `orgs.update(id, data)` | Update organization |
| DELETE | `/api/v1/orgs/{id}` | `orgs.delete(id)` | Delete organization |

```typescript
// List organizations
const orgs = await api.orgs.list();
// Returns: { data: Organization[] }

// Create organization
const org = await api.orgs.create({
  name: 'My Organization',
  slug: 'my-org',
});
// Returns: Organization

// Update organization
const updated = await api.orgs.update('org-id', {
  name: 'New Name',
});
// Returns: Organization
```

---

### Projects

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/api/v1/orgs/{orgId}/projects` | `projects.list(orgId)` | List org's projects |
| GET | `/api/v1/projects/{id}` | `projects.get(id)` | Get project by ID |
| POST | `/api/v1/orgs/{orgId}/projects` | `projects.create(orgId, data)` | Create project |
| PATCH | `/api/v1/projects/{id}` | `projects.update(id, data)` | Update project |
| DELETE | `/api/v1/projects/{id}` | `projects.delete(id)` | Delete project |

```typescript
// List projects
const projects = await api.projects.list('org-id');
// Returns: { data: Project[] }

// Create project
const project = await api.projects.create('org-id', {
  name: 'Q4 Planning',
  description: 'Q4 strategic planning project',
});
// Returns: Project

// Get single project
const project = await api.projects.get('project-id');
// Returns: Project
```

---

### Nodes

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/api/v1/projects/{projectId}/nodes` | `nodes.list(projectId, params)` | List project's nodes |
| GET | `/api/v1/nodes/{id}` | `nodes.get(id)` | Get node by ID |
| POST | `/api/v1/projects/{projectId}/nodes` | `nodes.create(projectId, data)` | Create node |
| PATCH | `/api/v1/nodes/{id}` | `nodes.update(id, data)` | Update node |
| DELETE | `/api/v1/nodes/{id}` | `nodes.delete(id)` | Delete node |
| GET | `/api/v1/nodes/{id}/children` | `nodes.getChildren(id)` | Get child nodes |
| GET | `/api/v1/nodes/{id}/versions` | `nodes.getVersions(id)` | Get version history |
| POST | `/api/v1/nodes/{id}/lock` | `nodes.acquireLock(id)` | Acquire edit lock |
| DELETE | `/api/v1/nodes/{id}/lock` | `nodes.releaseLock(id)` | Release edit lock |

```typescript
// List nodes with optional filters
const nodes = await api.nodes.list('project-id', {
  parentId: 'parent-node-id',  // Filter by parent
  status: 'in_progress',        // Filter by status
});
// Returns: { data: Node[] }

// Create node
const node = await api.nodes.create('project-id', {
  title: 'Market Research',
  description: 'Analyze competitor landscape',
  parentId: 'parent-node-id',
  authorType: 'agent',
  status: 'draft',
  metadata: {
    tags: ['research', 'analysis'],
    priority: 'high',
  },
});
// Returns: Node

// Update node
const updated = await api.nodes.update('node-id', {
  title: 'Updated Title',
  status: 'in_progress',
});
// Returns: Node

// Get children
const children = await api.nodes.getChildren('node-id');
// Returns: { data: Node[] }

// Lock operations
await api.nodes.acquireLock('node-id');
await api.nodes.releaseLock('node-id');
```

---

### Agent Executions

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/api/v1/nodes/{nodeId}/executions` | `executions.start(nodeId, config)` | Start execution |
| GET | `/api/v1/nodes/{nodeId}/executions/current` | `executions.getCurrent(nodeId)` | Get current execution |
| GET | `/api/v1/executions/{id}` | `executions.get(id)` | Get execution by ID |
| GET | `/api/v1/executions/{id}/trace` | `executions.getTrace(id)` | Get execution trace |
| POST | `/api/v1/nodes/{nodeId}/executions/pause` | `executions.pause(nodeId)` | Pause execution |
| POST | `/api/v1/nodes/{nodeId}/executions/resume` | `executions.resume(nodeId)` | Resume execution |
| POST | `/api/v1/nodes/{nodeId}/executions/cancel` | `executions.cancel(nodeId)` | Cancel execution |

```typescript
// Start execution
const execution = await api.executions.start('node-id', {
  inputs: { query: 'Analyze market trends' },
});
// Returns: AgentExecution

// Get execution trace
const trace = await api.executions.getTrace('execution-id');
// Returns: { data: TraceEvent[] }

// Control execution
await api.executions.pause('node-id');
await api.executions.resume('node-id');
await api.executions.cancel('node-id');
```

**Note:** Execution endpoints are currently **mocked** in the frontend. See [Backend Integration](#backend-integration).

---

### Files

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/api/v1/orgs/{orgId}/files/upload` | `files.getUploadURL(orgId, data)` | Get presigned upload URL |
| POST | `/api/v1/files/{id}/confirm` | `files.confirmUpload(id)` | Confirm upload complete |
| GET | `/api/v1/files/{id}` | `files.get(id)` | Get file metadata |
| DELETE | `/api/v1/files/{id}` | `files.delete(id)` | Delete file |

```typescript
// Get presigned upload URL
const { uploadUrl, fileId, fields } = await api.files.getUploadURL('org-id', {
  filename: 'document.pdf',
  contentType: 'application/pdf',
  size: 1024000,
});

// Upload directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': 'application/pdf' },
});

// Confirm upload
const file = await api.files.confirmUpload(fileId);
// Returns: File
```

---

### Search

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| POST | `/api/v1/orgs/{orgId}/search` | `search.search(orgId, query, types)` | Full-text search |
| POST | `/api/v1/orgs/{orgId}/search/semantic` | `search.semantic(orgId, query, types)` | Semantic search |

```typescript
// Full-text search
const results = await api.search.search('org-id', 'market analysis', ['node']);
// Returns: { data: SearchResult[] }

// Semantic search (AI-powered)
const results = await api.search.semantic('org-id', 'find competitor research');
// Returns: { data: SearchResult[] }
```

---

### Users

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/api/v1/users/me` | `users.me()` | Get current user |
| PATCH | `/api/v1/users/me` | `users.update(data)` | Update current user |

```typescript
// Get current user
const user = await api.users.me();
// Returns: User

// Update profile
const updated = await api.users.update({
  name: 'New Name',
  avatarUrl: 'https://...',
});
// Returns: User
```

---

## Error Handling

### APIError Class

```typescript
class APIError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

### Error Response Format

```typescript
// Backend error response
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Node not found",
    "details": { "nodeId": "abc123" }
  }
}
```

### Handling Errors

```typescript
try {
  const node = await api.nodes.get('invalid-id');
} catch (error) {
  if (error instanceof APIError) {
    switch (error.status) {
      case 401:
        // Redirect to login
        break;
      case 403:
        // Show permission denied
        break;
      case 404:
        // Show not found
        break;
      default:
        // Show generic error
    }
  }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., lock held) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## React Query Integration

### Query Hooks

```typescript
// apps/web/src/hooks/use-nodes.ts

export function useNodes(projectId: string, params?: NodeListParams) {
  return useQuery({
    queryKey: ['nodes', projectId, params],
    queryFn: () => api.nodes.list(projectId, params),
    enabled: !!projectId,
  });
}

export function useNode(nodeId: string) {
  return useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => api.nodes.get(nodeId),
    enabled: !!nodeId,
  });
}
```

### Mutation Hooks

```typescript
export function useCreateNode(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNodeRequest) =>
      api.nodes.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['nodes', projectId]);
    },
  });
}

export function useUpdateNode(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNodeRequest) =>
      api.nodes.update(nodeId, data),
    onSuccess: (node) => {
      queryClient.invalidateQueries(['node', nodeId]);
      queryClient.invalidateQueries(['nodes', node.projectId]);
    },
  });
}

export function useDeleteNode(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.nodes.delete(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries(['nodes']);
    },
  });
}
```

### Usage in Components

```tsx
function NodeList({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useNodes(projectId);
  const createNode = useCreateNode(projectId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  const handleCreate = async () => {
    await createNode.mutateAsync({
      title: 'New Node',
      status: 'draft',
      authorType: 'human',
    });
  };

  return (
    <div>
      {data?.data.map(node => (
        <NodeCard key={node.id} node={node} />
      ))}
      <button onClick={handleCreate}>Add Node</button>
    </div>
  );
}
```

---

## Request/Response Types

### Type Imports

```typescript
import type {
  Node,
  Project,
  Organization,
  User,
  File,
  AgentExecution,
  TraceEvent,
  CreateNodeRequest,
  UpdateNodeRequest,
  PaginatedResponse,
} from '@glassbox/shared-types';
```

### Common Patterns

```typescript
// Paginated response
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// List response (without pagination)
interface ListResponse<T> {
  data: T[];
}

// Single item response
type ItemResponse<T> = T;
```

---

## Backend Integration

### Current Status

| Endpoint Group | Status | Notes |
|----------------|--------|-------|
| Organizations | ✅ Ready | Full CRUD |
| Projects | ✅ Ready | Full CRUD |
| Nodes | ✅ Ready | Full CRUD + locks |
| Files | ✅ Ready | S3 presigned URLs |
| Search | ✅ Ready | Full-text + semantic |
| Users | ✅ Ready | Profile management |
| Executions | ⚠️ Mocked | Frontend simulation only |

### Mocked Endpoints

The following execution endpoints are **mocked** in `useExecution` hook:

```typescript
// Currently simulated, not calling real API:
api.executions.start(nodeId, config)
api.executions.pause(nodeId)
api.executions.resume(nodeId)
api.executions.cancel(nodeId)
```

### Backend Requirements

To fully enable agent execution:

1. **Implement execution endpoints** in Go backend
2. **Send WebSocket updates** for execution progress
3. **Handle HITL responses** via API

See [Backend API Documentation](../v1/API.md) for endpoint specifications.

---

## Best Practices

### 1. Always Use Hooks

```typescript
// Good - uses React Query hooks
const { data } = useNodes(projectId);

// Avoid - direct API calls in components
const data = await api.nodes.list(projectId);
```

### 2. Handle Loading and Error States

```typescript
const { data, isLoading, error } = useNodes(projectId);

if (isLoading) return <Skeleton />;
if (error) return <Error error={error} />;
return <NodeList nodes={data.data} />;
```

### 3. Use Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: api.nodes.update,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['node', nodeId]);
    const previous = queryClient.getQueryData(['node', nodeId]);
    queryClient.setQueryData(['node', nodeId], (old) => ({
      ...old,
      ...newData,
    }));
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['node', nodeId], context.previous);
  },
});
```

### 4. Invalidate Related Queries

```typescript
onSuccess: (node) => {
  // Invalidate specific node
  queryClient.invalidateQueries(['node', node.id]);
  // Invalidate parent's children list
  queryClient.invalidateQueries(['nodes', node.projectId]);
  // Invalidate project stats
  queryClient.invalidateQueries(['project', node.projectId]);
};
```
