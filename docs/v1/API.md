# GlassBox API Reference v1

Complete REST API reference for the GlassBox platform.

## Base URLs

| Environment | URL |
|-------------|-----|
| Staging | `http://glassbox-staging-1042377516.us-east-1.elb.amazonaws.com` |
| Local Dev | `http://localhost:8080` |

## Authentication

All endpoints (except `/health` and `/api/v1/auth/dev-token`) require Bearer token authentication.

```
Authorization: Bearer <jwt_token>
```

### Token Types

| Type | Expiration | Use Case |
|------|------------|----------|
| JWT Token | 24 hours | API authentication |
| WS Token | 5 minutes | WebSocket connections |

---

## Endpoints Summary

| Group | Count | Base Path |
|-------|-------|-----------|
| Health | 1 | `/health` |
| Auth | 2 | `/api/v1/auth` |
| Organizations | 5 | `/api/v1/orgs` |
| Projects | 5 | `/api/v1/projects` |
| Nodes | 17 | `/api/v1/nodes` |
| Files | 4 | `/api/v1/files` |
| Executions | 8 | `/api/v1/executions` |
| Search | 3 | `/api/v1/orgs/:orgId/search` |
| Users | 4 | `/api/v1/users` |
| Templates | 3 | `/api/v1/templates` |
| **Total** | **52** | |

---

## Health

### GET /health

Check API service health.

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "service": "glassbox-api"
}
```

---

## Authentication

### POST /api/v1/auth/dev-token

Generate a development JWT token. **Only available in development mode.**

**Authentication:** None required

**Request Body:**
```json
{
  "userId": "uuid-string",
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-16T10:00:00Z"
}
```

### POST /api/v1/auth/ws-token

Exchange JWT for a short-lived WebSocket token.

**Authentication:** Required

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-15T10:05:00Z"
}
```

---

## Organizations

### GET /api/v1/orgs

List organizations the current user belongs to.

**Authentication:** Required

**Response (200):**
```json
{
  "organizations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "owner",
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ]
}
```

### POST /api/v1/orgs

Create a new organization.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "New Organization",
  "slug": "new-org",
  "settings": {
    "defaultModel": "gpt-4",
    "allowedModels": ["gpt-4", "claude-3"]
  }
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "New Organization",
  "slug": "new-org",
  "settings": {...},
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### GET /api/v1/orgs/:orgId

Get organization by ID.

**Authentication:** Required (must be member)

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "settings": {...},
  "eventSourcingLevel": "snapshot",
  "createdAt": "2024-01-15T09:00:00Z",
  "updatedAt": "2024-01-15T09:00:00Z"
}
```

### PATCH /api/v1/orgs/:orgId

Update organization. Requires admin or owner role.

**Authentication:** Required (admin/owner)

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "settings": {
    "defaultModel": "claude-3"
  }
}
```

**Response (200):** Updated organization object

### DELETE /api/v1/orgs/:orgId

Delete organization. Requires owner role.

**Authentication:** Required (owner only)

**Response (204):** No content

---

## Projects

### GET /api/v1/orgs/:orgId/projects

List projects in an organization.

**Authentication:** Required (org member)

**Response (200):**
```json
{
  "projects": [
    {
      "id": "project-uuid",
      "name": "Q1 Planning",
      "description": "Quarterly planning project",
      "workflowStates": ["draft", "review", "approved"],
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ]
}
```

### POST /api/v1/orgs/:orgId/projects

Create a new project.

**Authentication:** Required (org member)

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Project description",
  "workflowStates": ["draft", "in_progress", "complete"],
  "settings": {}
}
```

**Response (201):** Created project object

### GET /api/v1/projects/:projectId

Get project by ID.

**Authentication:** Required (org member)

**Response (200):** Project object

### PATCH /api/v1/projects/:projectId

Update project.

**Authentication:** Required (project admin)

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "New description"
}
```

**Response (200):** Updated project object

### DELETE /api/v1/projects/:projectId

Delete project. Cascades to all nodes.

**Authentication:** Required (project admin)

**Response (204):** No content

---

## Nodes

### GET /api/v1/projects/:projectId/nodes

List nodes in a project.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (draft, in_progress, etc.) |
| authorType | string | Filter by author type (human, agent) |
| parentId | string | Filter by parent ID (use "null" for root nodes) |
| limit | int | Max results (default 100) |
| offset | int | Pagination offset |

**Response (200):**
```json
{
  "nodes": [
    {
      "id": "node-uuid",
      "title": "Analysis Task",
      "status": "draft",
      "authorType": "human",
      "version": 1,
      "parentId": null,
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ],
  "total": 25
}
```

### POST /api/v1/projects/:projectId/nodes

Create a new node.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "New Task",
  "description": "Task description",
  "authorType": "human",
  "status": "draft",
  "parentId": "parent-node-uuid",
  "metadata": {
    "priority": "high",
    "tags": ["research"]
  },
  "position": {"x": 100, "y": 200}
}
```

**Response (201):**
```json
{
  "id": "new-node-uuid",
  "title": "New Task",
  "description": "Task description",
  "authorType": "human",
  "authorUserId": "user-uuid",
  "status": "draft",
  "version": 1,
  "parentId": "parent-node-uuid",
  "metadata": {...},
  "position": {"x": 100, "y": 200},
  "inputs": [],
  "outputs": [],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### GET /api/v1/nodes/:nodeId

Get node with inputs and outputs.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "node-uuid",
  "title": "Analysis Task",
  "description": "...",
  "authorType": "human",
  "authorUserId": "user-uuid",
  "status": "in_progress",
  "version": 3,
  "parentId": null,
  "metadata": {...},
  "position": {"x": 0, "y": 0},
  "inputs": [
    {
      "id": "input-uuid",
      "inputType": "file",
      "fileId": "file-uuid",
      "label": "Source Data"
    }
  ],
  "outputs": [
    {
      "id": "output-uuid",
      "outputType": "structured_data",
      "structuredData": {...},
      "label": "Analysis Results"
    }
  ],
  "lockedBy": null,
  "lockedAt": null,
  "createdAt": "2024-01-15T09:00:00Z",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

### PATCH /api/v1/nodes/:nodeId

Update node. Creates a new version automatically.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Updated Title",
  "status": "in_progress",
  "description": "Updated description",
  "metadata": {...}
}
```

**Response (200):** Updated node with new version number

### DELETE /api/v1/nodes/:nodeId

Soft delete node (sets deleted_at).

**Authentication:** Required

**Response (204):** No content

### GET /api/v1/nodes/:nodeId/versions

Get version history for a node.

**Authentication:** Required

**Response (200):**
```json
{
  "versions": [
    {
      "id": "version-uuid",
      "nodeId": "node-uuid",
      "version": 3,
      "changeType": "updated",
      "changeSummary": "Title updated",
      "changedBy": "user-uuid",
      "createdAt": "2024-01-15T11:00:00Z"
    },
    {
      "id": "version-uuid-2",
      "nodeId": "node-uuid",
      "version": 2,
      "changeType": "status_change",
      "changeSummary": "Status changed to in_progress",
      "changedBy": "user-uuid",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /api/v1/nodes/:nodeId/versions/:version

Get specific version snapshot.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "version-uuid",
  "nodeId": "node-uuid",
  "version": 2,
  "snapshot": {
    "title": "Original Title",
    "description": "...",
    "status": "draft"
  },
  "changeType": "updated",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/v1/nodes/:nodeId/rollback/:version

Rollback node to a previous version.

**Authentication:** Required

**Response (200):** Node restored to specified version

### POST /api/v1/nodes/:nodeId/inputs

Add input to node.

**Authentication:** Required

**Request Body (file input):**
```json
{
  "inputType": "file",
  "fileId": "file-uuid",
  "label": "Source Document"
}
```

**Request Body (node reference):**
```json
{
  "inputType": "node_reference",
  "sourceNodeId": "other-node-uuid",
  "sourceNodeVersion": 5,
  "label": "Previous Analysis"
}
```

**Request Body (text):**
```json
{
  "inputType": "text",
  "textContent": "Additional instructions...",
  "label": "Instructions"
}
```

**Response (201):** Created input object

### DELETE /api/v1/nodes/:nodeId/inputs/:inputId

Remove input from node.

**Authentication:** Required

**Response (204):** No content

### POST /api/v1/nodes/:nodeId/outputs

Add output to node.

**Authentication:** Required

**Request Body (structured data):**
```json
{
  "outputType": "structured_data",
  "structuredData": {
    "findings": [...],
    "recommendations": [...]
  },
  "label": "Analysis Results"
}
```

**Request Body (text):**
```json
{
  "outputType": "text",
  "textContent": "Summary of findings...",
  "label": "Summary"
}
```

**Response (201):** Created output object

### DELETE /api/v1/nodes/:nodeId/outputs/:outputId

Remove output from node.

**Authentication:** Required

**Response (204):** No content

### GET /api/v1/nodes/:nodeId/children

Get child nodes.

**Authentication:** Required

**Response (200):**
```json
{
  "children": [
    {
      "id": "child-node-uuid",
      "title": "Sub-task 1",
      "status": "complete"
    }
  ]
}
```

### GET /api/v1/nodes/:nodeId/dependencies

Get nodes this node depends on (via inputs).

**Authentication:** Required

**Response (200):**
```json
{
  "dependencies": [
    {
      "nodeId": "source-node-uuid",
      "nodeTitle": "Data Collection",
      "inputId": "input-uuid",
      "inputLabel": "Source Data"
    }
  ]
}
```

### POST /api/v1/nodes/:nodeId/lock

Acquire edit lock on node. Lock expires after 5 minutes.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "lockedBy": "user-uuid",
  "lockedAt": "2024-01-15T10:00:00Z",
  "expiresAt": "2024-01-15T10:05:00Z"
}
```

**Response (409 Conflict):**
```json
{
  "error": "Node is locked by another user",
  "lockedBy": "other-user-uuid",
  "lockedByEmail": "other@example.com"
}
```

### DELETE /api/v1/nodes/:nodeId/lock

Release edit lock.

**Authentication:** Required (must be lock holder)

**Response (200):**
```json
{
  "success": true
}
```

### GET /api/v1/nodes/:nodeId/context

Get node context for RAG (includes inputs, outputs, parent chain).

**Authentication:** Required

**Response (200):**
```json
{
  "node": {
    "id": "node-uuid",
    "title": "Analysis Task",
    "description": "...",
    "status": "in_progress"
  },
  "inputs": [
    {
      "id": "input-uuid",
      "type": "file",
      "content": "Extracted text from file..."
    }
  ],
  "outputs": [...],
  "parentChain": [
    {"id": "parent-uuid", "title": "Parent Task"}
  ],
  "siblings": [
    {"id": "sibling-uuid", "title": "Related Task"}
  ]
}
```

---

## Executions

### POST /api/v1/nodes/:nodeId/execute

Start agent execution on a node.

**Authentication:** Required

**Response (201):**
```json
{
  "execution": {
    "id": "execution-uuid",
    "nodeId": "node-uuid",
    "status": "pending",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

**Response (409 Conflict):** Active execution already exists

### GET /api/v1/nodes/:nodeId/execution

Get current execution for a node.

**Authentication:** Required

**Response (200):**
```json
{
  "execution": {
    "id": "execution-uuid",
    "nodeId": "node-uuid",
    "status": "running",
    "startedAt": "2024-01-15T10:00:05Z",
    "tokensIn": 1523,
    "tokensOut": 456,
    "estimatedCostUsd": 0.0234
  }
}
```

**Response (404):** No active execution

### POST /api/v1/nodes/:nodeId/execution/pause

Pause running execution.

**Authentication:** Required

**Response (200):**
```json
{
  "execution": {
    "id": "execution-uuid",
    "status": "paused"
  }
}
```

### POST /api/v1/nodes/:nodeId/execution/resume

Resume paused execution.

**Authentication:** Required

**Response (200):**
```json
{
  "execution": {
    "id": "execution-uuid",
    "status": "running"
  }
}
```

### POST /api/v1/nodes/:nodeId/execution/cancel

Cancel active execution.

**Authentication:** Required

**Response (200):**
```json
{
  "execution": {
    "id": "execution-uuid",
    "status": "cancelled"
  }
}
```

### GET /api/v1/executions/:executionId

Get execution details by ID.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "execution-uuid",
  "nodeId": "node-uuid",
  "status": "complete",
  "langgraphThreadId": "thread-123",
  "traceSummary": [...],
  "startedAt": "2024-01-15T10:00:05Z",
  "completedAt": "2024-01-15T10:02:30Z",
  "tokensIn": 5234,
  "tokensOut": 1823,
  "estimatedCostUsd": 0.0892,
  "modelId": "gpt-4"
}
```

### GET /api/v1/executions/:executionId/trace

Get full execution trace.

**Authentication:** Required

**Response (200):**
```json
{
  "events": [
    {
      "id": "event-uuid",
      "eventType": "llm_call",
      "eventData": {
        "prompt": "...",
        "response": "..."
      },
      "model": "gpt-4",
      "tokensIn": 234,
      "tokensOut": 156,
      "durationMs": 2345,
      "timestamp": "2024-01-15T10:00:10Z",
      "sequenceNumber": 1
    },
    {
      "id": "event-uuid-2",
      "eventType": "tool_call",
      "eventData": {
        "tool": "create_subnode",
        "args": {...},
        "result": {...}
      },
      "durationMs": 123,
      "timestamp": "2024-01-15T10:00:15Z",
      "sequenceNumber": 2
    }
  ]
}
```

### POST /api/v1/executions/:executionId/input

Provide human input for HITL (Human-in-the-Loop).

**Authentication:** Required

**Request Body:**
```json
{
  "input": {
    "decision": "approved",
    "notes": "Proceed with the analysis"
  }
}
```

**Response (200):**
```json
{
  "execution": {
    "id": "execution-uuid",
    "status": "running"
  }
}
```

---

## Files

### POST /api/v1/orgs/:orgId/files/upload

Get presigned URL for file upload.

**Authentication:** Required

**Request Body:**
```json
{
  "filename": "report.pdf",
  "contentType": "application/pdf"
}
```

**Response (200):**
```json
{
  "fileId": "file-uuid",
  "uploadUrl": "https://s3.amazonaws.com/bucket/key?signature=...",
  "expiresIn": 900
}
```

### POST /api/v1/files/:fileId/confirm

Confirm file upload completed. Triggers file processing.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "file-uuid",
  "filename": "report.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 1234567,
  "processingStatus": "pending"
}
```

### GET /api/v1/files/:fileId

Get file metadata and download URL.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "file-uuid",
  "filename": "report.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 1234567,
  "processingStatus": "complete",
  "extractedText": "Document content...",
  "downloadUrl": "https://s3.amazonaws.com/bucket/key?signature=...",
  "createdAt": "2024-01-15T09:00:00Z"
}
```

### DELETE /api/v1/files/:fileId

Delete file from S3 and database.

**Authentication:** Required

**Response (204):** No content

---

## Search

### POST /api/v1/orgs/:orgId/search

Text search across nodes and files.

**Authentication:** Required

**Request Body:**
```json
{
  "query": "quarterly analysis",
  "types": ["nodes", "files"],
  "projectId": "project-uuid",
  "status": "complete",
  "authorType": "human",
  "limit": 20,
  "offset": 0
}
```

**Response (200):**
```json
{
  "results": [
    {
      "type": "node",
      "id": "node-uuid",
      "title": "Quarterly Analysis",
      "description": "...",
      "score": 0.95
    },
    {
      "type": "file",
      "id": "file-uuid",
      "filename": "Q4-analysis.pdf",
      "excerpt": "...matching text...",
      "score": 0.82
    }
  ],
  "total": 45
}
```

### POST /api/v1/orgs/:orgId/search/semantic

Semantic search using vector embeddings.

**Authentication:** Required

**Request Body:**
```json
{
  "query": "financial projections for next year",
  "types": ["files"],
  "threshold": 0.7,
  "limit": 10
}
```

**Response (200):**
```json
{
  "results": [
    {
      "type": "file",
      "id": "file-uuid",
      "filename": "2024-forecast.pdf",
      "similarity": 0.89,
      "excerpt": "..."
    }
  ]
}
```

---

## Users

### GET /api/v1/users/me

Get current user profile.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "settings": {...},
  "createdAt": "2024-01-15T09:00:00Z"
}
```

### PATCH /api/v1/users/me

Update current user profile.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Smith",
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}
```

**Response (200):** Updated user object

### GET /api/v1/users/me/notifications

List user notifications.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | bool | Filter to unread only |
| limit | int | Max results (default 50) |

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "notification-uuid",
      "type": "execution_complete",
      "title": "Execution Complete",
      "body": "Your analysis task has completed",
      "resourceType": "node",
      "resourceId": "node-uuid",
      "readAt": null,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/v1/users/me/notifications/:notificationId/read

Mark notification as read.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "notification-uuid",
  "readAt": "2024-01-15T10:05:00Z"
}
```

---

## Templates

### GET /api/v1/templates

List available templates.

**Authentication:** Required

**Response (200):**
```json
{
  "templates": [
    {
      "id": "template-uuid",
      "name": "Research Analysis",
      "description": "Template for research tasks",
      "isPublic": true,
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ]
}
```

### GET /api/v1/templates/:templateId

Get template details.

**Authentication:** Required

**Response (200):**
```json
{
  "id": "template-uuid",
  "name": "Research Analysis",
  "description": "...",
  "structure": {
    "inputs": [...],
    "outputs": [...],
    "subnodes": [...]
  },
  "agentConfig": {
    "model": "gpt-4",
    "temperature": 0.7
  }
}
```

### POST /api/v1/templates/:templateId/apply

Apply template to create nodes.

**Authentication:** Required

**Request Body:**
```json
{
  "projectId": "project-uuid",
  "parentId": "parent-node-uuid",
  "title": "My Research Task"
}
```

**Response (201):**
```json
{
  "nodes": [
    {
      "id": "created-node-uuid",
      "title": "My Research Task"
    }
  ]
}
```

---

## Error Responses

All endpoints use standard HTTP status codes and return JSON error bodies:

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource conflict (e.g., locked) |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

**Error Response Format:**
```json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Standard API | 100 requests/minute |
| Search | 30 requests/minute |
| Agent Execution | 10 requests/minute |
| File Upload | 20 requests/minute |
