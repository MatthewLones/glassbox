# GlassBox - Technical Implementation Document

## Overview

This document outlines the technical architecture, stack choices, and implementation details for GlassBox. It's designed as a living document that will evolve as the platform matures.

**Design Philosophy:** Start simple, architect for scale. Every decision prioritizes operational simplicity for a small team while keeping doors open for enterprise features.

---

## Tech Stack Summary

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14+ (React) | Full-stack React, excellent DX, built-in API routes |
| **Sync Backend** | Go | HTTP/WebSocket handling, high performance, simple concurrency |
| **Async Backend** | Python | Agent orchestration, LangGraph, ML ecosystem |
| **Primary Database** | PostgreSQL | Reliable, JSONB flexibility, pgvector for embeddings |
| **Cache/Pub-Sub** | Redis | Session cache, rate limiting, real-time pub/sub |
| **File Storage** | S3 + CloudFront | Scalable storage with CDN for fast delivery |
| **Authentication** | AWS Cognito | Managed auth, enterprise SSO, cost-effective |
| **Container Orchestration** | ECS Fargate | Serverless containers, simple ops |
| **Infrastructure** | AWS CDK | TypeScript IaC, type-safe, AWS-native |
| **CI/CD** | GitHub Actions | Native to GitHub, simple setup |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENTS                                      │
│                    (Web Browser, Mobile, External APIs)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EDGE LAYER                                      │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │ CloudFront  │    │   AWS WAF   │    │   Route 53  │                      │
│  │    (CDN)    │    │ (Protection)│    │    (DNS)    │                      │
│  └─────────────┘    └─────────────┘    └─────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         NEXT.JS (ECS Fargate)                          │ │
│  │  • Server-side rendering            • API routes (BFF pattern)         │ │
│  │  • Static asset serving             • Auth session management          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                    ┌─────────────────┴─────────────────┐                    │
│                    ▼                                   ▼                    │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐      │
│  │      GO API SERVICE          │    │     GO WEBSOCKET SERVICE     │      │
│  │      (ECS Fargate)           │    │       (ECS Fargate)          │      │
│  │                              │    │                              │      │
│  │  • REST API endpoints        │    │  • Real-time connections     │      │
│  │  • Request validation        │    │  • Presence tracking         │      │
│  │  • Rate limiting (app-level) │    │  • Lock management           │      │
│  │  • gRPC client to Python     │    │  • Event broadcasting        │      │
│  └──────────────────────────────┘    └──────────────────────────────┘      │
│                    │                                   │                    │
└────────────────────┼───────────────────────────────────┼────────────────────┘
                     │                                   │
                     ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MESSAGING LAYER                                     │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │    Amazon SQS       │    │       Redis         │                         │
│  │   (Job Queues)      │    │   (Pub/Sub + Cache) │                         │
│  │                     │    │                     │                         │
│  │  • Agent job queue  │    │  • WebSocket pub/sub│                         │
│  │  • File processing  │    │  • Session cache    │                         │
│  │  • Notifications    │    │  • Rate limit state │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WORKER LAYER (Python)                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    PYTHON WORKERS (ECS Fargate)                        │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │ │
│  │  │  Agent Worker   │  │   RAG Worker    │  │  File Processor │        │ │
│  │  │                 │  │                 │  │                 │        │ │
│  │  │ • LangGraph     │  │ • Embeddings    │  │ • Document      │        │ │
│  │  │ • LiteLLM       │  │ • Vector search │  │   extraction    │        │ │
│  │  │ • Tool execution│  │ • Context build │  │ • OCR/Textract  │        │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────┐      │ │
│  │  │                    gRPC Server                               │      │ │
│  │  │  • Status streaming to Go services                           │      │ │
│  │  │  • Agent state queries                                       │      │ │
│  │  └─────────────────────────────────────────────────────────────┘      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                 │
│  │      PostgreSQL         │    │       Amazon S3         │                 │
│  │      (RDS Aurora)       │    │    (File Storage)       │                 │
│  │                         │    │                         │                 │
│  │  • Core data models     │    │  • User uploads         │                 │
│  │  • Node relationships   │    │  • Agent outputs        │                 │
│  │  • pgvector embeddings  │    │  • Document storage     │                 │
│  │  • Event sourcing       │    │  • Backup/archive       │                 │
│  │  • Row-level security   │    │                         │                 │
│  └─────────────────────────┘    └─────────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Responsibilities

### Go Services (Synchronous Operations)

**API Service:**
- All REST endpoints for CRUD operations
- Request validation and sanitization
- Application-level rate limiting (Redis-backed)
- Authentication/authorization checks
- gRPC client for communicating with Python workers
- Database queries and writes

**WebSocket Service:**
- Persistent WebSocket connections
- Token exchange authentication (short-lived WS tokens)
- Real-time event broadcasting via Redis pub/sub
- Presence tracking (who's viewing/editing what)
- Lock acquisition and management
- Connection state management

### Python Services (Asynchronous Operations)

**Agent Worker:**
- LangGraph execution engine
- LiteLLM integration for model routing
- Tool execution (create_subnode, access_node, etc.)
- Full execution trace logging
- gRPC server for status streaming

**RAG Worker:**
- Document embedding generation (pgvector)
- Vector similarity search
- Context assembly for agent inputs
- Search query processing

**File Processor:**
- Document text extraction
- Format-specific handlers:
  - AWS Textract for scanned documents/images
  - Unstructured.io for PDFs, Office docs
  - Custom parsers for structured formats
- Thumbnail generation
- Metadata extraction

### Communication Patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE COMMUNICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Go → Python (Job Dispatch):                                     │
│  ┌──────────┐         ┌─────────┐         ┌──────────┐          │
│  │ Go API   │ ──────► │   SQS   │ ──────► │ Python   │          │
│  │ Service  │  enqueue│  Queue  │ consume │ Worker   │          │
│  └──────────┘         └─────────┘         └──────────┘          │
│                                                                  │
│  Python → Go (Status Updates):                                   │
│  ┌──────────┐         ┌─────────┐         ┌──────────┐          │
│  │ Python   │ ──────► │  gRPC   │ ──────► │ Go API   │          │
│  │ Worker   │ stream  │ Server  │ call    │ Service  │          │
│  └──────────┘         └─────────┘         └──────────┘          │
│                                                                  │
│  Real-time Broadcast:                                            │
│  ┌──────────┐         ┌─────────┐         ┌──────────┐          │
│  │ Any      │ ──────► │  Redis  │ ──────► │    WS    │          │
│  │ Service  │ publish │  Pub/Sub│ subscribe│ Service  │          │
│  └──────────┘         └─────────┘         └──────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Core Schema (PostgreSQL)

```sql
-- Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',

    -- Event sourcing config (org-configurable)
    event_sourcing_level VARCHAR(20) DEFAULT 'snapshot', -- 'full', 'snapshot', 'audit'

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',

    -- Custom workflow states for this project
    workflow_states JSONB DEFAULT '["draft", "in_progress", "complete"]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nodes (Core Primitive)
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    parent_id UUID REFERENCES nodes(id),

    -- Core fields (normalized)
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',

    -- Author info
    author_type VARCHAR(20) NOT NULL, -- 'human', 'agent'
    author_user_id UUID REFERENCES users(id),
    supervisor_user_id UUID REFERENCES users(id), -- For agent-authored nodes

    -- Version tracking
    version INTEGER DEFAULT 1,

    -- Flexible fields (JSONB)
    metadata JSONB DEFAULT '{}',

    -- Canvas positioning (for canvas view)
    position JSONB DEFAULT '{"x": 0, "y": 0}',

    -- Lock state
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    lock_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete
    deleted_at TIMESTAMPTZ
);

-- Node Versions (for full history)
CREATE TABLE node_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id),
    version INTEGER NOT NULL,

    -- Snapshot of node state at this version
    snapshot JSONB NOT NULL,

    -- What changed
    change_type VARCHAR(50), -- 'created', 'updated', 'status_change', etc.
    change_summary TEXT,
    changed_by UUID REFERENCES users(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(node_id, version)
);

-- Node Inputs
CREATE TABLE node_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id),

    -- Input type
    input_type VARCHAR(50) NOT NULL, -- 'file', 'node_reference', 'external_link', 'text'

    -- For file inputs
    file_id UUID REFERENCES files(id),

    -- For node reference inputs
    source_node_id UUID REFERENCES nodes(id),
    source_node_version INTEGER, -- NULL = latest

    -- For external links
    external_url TEXT,

    -- For text/instructions
    text_content TEXT,

    -- Metadata
    label VARCHAR(255),
    metadata JSONB DEFAULT '{}',

    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node Outputs
CREATE TABLE node_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id),

    -- Output type
    output_type VARCHAR(50) NOT NULL, -- 'file', 'structured_data', 'text', 'external_link'

    -- For file outputs
    file_id UUID REFERENCES files(id),

    -- For structured data
    structured_data JSONB,

    -- For text outputs
    text_content TEXT,

    -- Metadata
    label VARCHAR(255),
    metadata JSONB DEFAULT '{}',

    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node Dependencies (DAG edges beyond parent-child)
CREATE TABLE node_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source node's output feeds into target node's input
    source_node_id UUID NOT NULL REFERENCES nodes(id),
    target_node_id UUID NOT NULL REFERENCES nodes(id),

    -- Which specific output/input are connected
    source_output_id UUID REFERENCES node_outputs(id),
    target_input_id UUID REFERENCES node_inputs(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_node_id, target_node_id, source_output_id, target_input_id)
);

-- Files
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),

    -- Storage info
    storage_key VARCHAR(500) NOT NULL, -- S3 key
    storage_bucket VARCHAR(255) NOT NULL,

    -- File metadata
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(255),
    size_bytes BIGINT,

    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'complete', 'failed'
    extracted_text TEXT,

    -- Embeddings (pgvector)
    embedding vector(1536), -- OpenAI ada-002 dimension, adjust as needed

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES users(id)
);

-- Agent Executions (Evidence)
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id),

    -- Execution status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'paused', 'complete', 'failed', 'cancelled'

    -- LangGraph state
    langgraph_thread_id VARCHAR(255),

    -- Full execution trace (stored as JSONB array)
    trace JSONB DEFAULT '[]',

    -- Summary
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Cost tracking
    total_tokens_in INTEGER DEFAULT 0,
    total_tokens_out INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 6) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Trace Events (for detailed logging)
CREATE TABLE agent_trace_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES agent_executions(id),

    -- Event info
    event_type VARCHAR(50) NOT NULL, -- 'llm_call', 'tool_call', 'decision', 'human_input', 'error'
    event_data JSONB NOT NULL,

    -- Timing
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER,

    -- For LLM calls
    model VARCHAR(100),
    tokens_in INTEGER,
    tokens_out INTEGER
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,

    settings JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member', 'guest'

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(org_id, user_id)
);

-- Project Members
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member', 'viewer'

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, user_id)
);

-- Templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id), -- NULL = system template

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Template structure
    structure JSONB NOT NULL, -- Defines inputs, outputs, sub-nodes, etc.

    -- Agent config
    agent_config JSONB DEFAULT '{}',

    is_public BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),

    -- Who
    user_id UUID REFERENCES users(id),
    agent_execution_id UUID REFERENCES agent_executions(id),

    -- What
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,

    -- Details
    details JSONB DEFAULT '{}',

    -- When
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- IP/metadata for compliance
    ip_address INET,
    user_agent TEXT
);

-- Row Level Security Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
-- ... enable RLS on all tenant-scoped tables

-- Example RLS Policy
CREATE POLICY org_isolation ON nodes
    USING (org_id = current_setting('app.current_org_id')::UUID);
```

### Indexes

```sql
-- Node queries
CREATE INDEX idx_nodes_org_project ON nodes(org_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_parent ON nodes(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_author ON nodes(author_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_status ON nodes(org_id, status) WHERE deleted_at IS NULL;

-- Node versions
CREATE INDEX idx_node_versions_node ON node_versions(node_id, version DESC);

-- Files
CREATE INDEX idx_files_org ON files(org_id);
CREATE INDEX idx_files_embedding ON files USING ivfflat (embedding vector_cosine_ops);

-- Agent executions
CREATE INDEX idx_agent_executions_node ON agent_executions(node_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status) WHERE status IN ('pending', 'running');

-- Audit log (time-series)
CREATE INDEX idx_audit_log_org_time ON audit_log(org_id, created_at DESC);
```

---

## API Design

### REST Endpoints (Go API Service)

```
Base URL: /api/v1

Authentication:
  All endpoints require Authorization: Bearer <token>
  Token is Cognito JWT in production, dev JWT for local development

  Dev-only endpoints:
  POST   /auth/dev-token               Generate JWT for local development ✅

Organizations: ✅ IMPLEMENTED
  GET    /orgs                          List user's organizations
  POST   /orgs                          Create organization
  GET    /orgs/:orgId                   Get organization details
  PATCH  /orgs/:orgId                   Update organization
  DELETE /orgs/:orgId                   Delete organization

Projects: ✅ IMPLEMENTED
  GET    /orgs/:orgId/projects          List projects
  POST   /orgs/:orgId/projects          Create project
  GET    /projects/:projectId           Get project
  PATCH  /projects/:projectId           Update project
  DELETE /projects/:projectId           Delete project

Nodes: ✅ IMPLEMENTED
  GET    /projects/:projectId/nodes     List nodes (with filters)
  POST   /projects/:projectId/nodes     Create node
  GET    /nodes/:nodeId                 Get node with inputs/outputs
  PATCH  /nodes/:nodeId                 Update node
  DELETE /nodes/:nodeId                 Soft delete node

  GET    /nodes/:nodeId/versions        Get version history
  GET    /nodes/:nodeId/versions/:v     Get specific version
  POST   /nodes/:nodeId/rollback/:v     Rollback to version

  POST   /nodes/:nodeId/inputs          Add input
  DELETE /nodes/:nodeId/inputs/:inputId Remove input

  POST   /nodes/:nodeId/outputs         Add output
  DELETE /nodes/:nodeId/outputs/:outputId Remove output

  GET    /nodes/:nodeId/children        Get child nodes
  GET    /nodes/:nodeId/dependencies    Get dependency graph

  POST   /nodes/:nodeId/lock            Acquire lock
  DELETE /nodes/:nodeId/lock            Release lock

Agent Operations:
  POST   /nodes/:nodeId/execute         Start agent execution
  GET    /nodes/:nodeId/execution       Get current execution status
  POST   /nodes/:nodeId/execution/pause Pause execution
  POST   /nodes/:nodeId/execution/resume Resume execution
  POST   /nodes/:nodeId/execution/cancel Cancel execution

  GET    /executions/:executionId       Get execution details
  GET    /executions/:executionId/trace Get full trace

Files:
  POST   /orgs/:orgId/files/upload      Get presigned upload URL
  POST   /files/:fileId/confirm         Confirm upload complete
  GET    /files/:fileId                 Get file metadata + download URL
  DELETE /files/:fileId                 Delete file

Search:
  POST   /orgs/:orgId/search            Search nodes, files, content
  POST   /orgs/:orgId/search/semantic   Semantic search (RAG)

Templates:
  GET    /templates                     List available templates
  GET    /orgs/:orgId/templates         List org templates
  POST   /orgs/:orgId/templates         Create template
  GET    /templates/:templateId         Get template
  POST   /templates/:templateId/apply   Apply template to create nodes

Users: ✅ IMPLEMENTED
  GET    /users/me                      Get current user
  PATCH  /users/me                      Update current user
  GET    /users/me/notifications        Get notifications
```

### WebSocket Protocol

```
Connection URL: wss://api.glassbox.io/ws?token=<ws_token>

Token Exchange:
  1. Client calls POST /auth/ws-token with Cognito JWT
  2. Server returns short-lived WS token (5 min expiry)
  3. Client connects to WebSocket with WS token

Message Format:
  {
    "type": "message_type",
    "payload": { ... },
    "requestId": "optional-for-request-response"
  }

Client → Server Messages:

  subscribe:
    { "type": "subscribe", "payload": { "channel": "project:uuid" } }
    { "type": "subscribe", "payload": { "channel": "node:uuid" } }

  unsubscribe:
    { "type": "unsubscribe", "payload": { "channel": "project:uuid" } }

  presence:
    { "type": "presence", "payload": { "nodeId": "uuid", "action": "viewing|editing|idle" } }

  lock_acquire:
    { "type": "lock_acquire", "payload": { "nodeId": "uuid" }, "requestId": "123" }

  lock_release:
    { "type": "lock_release", "payload": { "nodeId": "uuid" } }

Server → Client Messages:

  subscribed:
    { "type": "subscribed", "payload": { "channel": "project:uuid" } }

  node_updated:
    { "type": "node_updated", "payload": { "nodeId": "uuid", "changes": {...}, "version": 5 } }

  node_created:
    { "type": "node_created", "payload": { "node": {...} } }

  node_deleted:
    { "type": "node_deleted", "payload": { "nodeId": "uuid" } }

  presence_update:
    { "type": "presence_update", "payload": { "nodeId": "uuid", "users": [...] } }

  lock_acquired:
    { "type": "lock_acquired", "payload": { "nodeId": "uuid", "lockedBy": "user_uuid" } }

  lock_released:
    { "type": "lock_released", "payload": { "nodeId": "uuid" } }

  execution_update:
    { "type": "execution_update", "payload": { "nodeId": "uuid", "status": "running", "progress": {...} } }

  error:
    { "type": "error", "payload": { "code": "LOCK_HELD", "message": "..." }, "requestId": "123" }
```

---

## Agent Architecture

### LangGraph Structure

Each node execution creates a single LangGraph instance:

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from typing import TypedDict, List, Optional
from litellm import completion

class AgentState(TypedDict):
    node_id: str
    inputs: List[dict]
    outputs: List[dict]
    messages: List[dict]
    current_step: str
    sub_nodes_created: List[str]
    human_input_needed: bool
    human_input_request: Optional[dict]
    error: Optional[str]

class GlassBoxAgent:
    def __init__(self, node_id: str, org_config: dict):
        self.node_id = node_id
        self.org_config = org_config
        self.tools = self._build_tools()
        self.graph = self._build_graph()

    def _build_tools(self) -> List[dict]:
        return [
            {
                "name": "create_subnode",
                "description": "Create a sub-node to decompose this task",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "author_type": {"type": "string", "enum": ["agent", "human"]},
                        "inputs": {"type": "array", "items": {"type": "object"}}
                    },
                    "required": ["title", "author_type"]
                }
            },
            {
                "name": "request_human_input",
                "description": "Request input or approval from human supervisor",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "options": {"type": "array", "items": {"type": "string"}},
                        "context": {"type": "string"}
                    },
                    "required": ["question"]
                }
            },
            {
                "name": "add_output",
                "description": "Add an output to this node",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": ["file", "text", "structured_data"]},
                        "content": {"type": "object"},
                        "label": {"type": "string"}
                    },
                    "required": ["type", "content"]
                }
            },
            {
                "name": "access_node",
                "description": "Read inputs or outputs from another node",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "node_id": {"type": "string"},
                        "access_type": {"type": "string", "enum": ["inputs", "outputs", "both"]}
                    },
                    "required": ["node_id"]
                }
            }
        ]

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(AgentState)

        # Add nodes
        graph.add_node("analyze", self.analyze_inputs)
        graph.add_node("plan", self.plan_execution)
        graph.add_node("execute", self.execute_step)
        graph.add_node("handle_tool", self.handle_tool_call)
        graph.add_node("wait_human", self.wait_for_human)
        graph.add_node("finalize", self.finalize_outputs)

        # Add edges
        graph.set_entry_point("analyze")
        graph.add_edge("analyze", "plan")
        graph.add_conditional_edges(
            "plan",
            self.should_create_subnodes,
            {
                "create_subnodes": "handle_tool",
                "execute_directly": "execute"
            }
        )
        graph.add_conditional_edges(
            "execute",
            self.check_execution_result,
            {
                "tool_call": "handle_tool",
                "human_needed": "wait_human",
                "continue": "execute",
                "done": "finalize"
            }
        )
        graph.add_edge("handle_tool", "execute")
        graph.add_edge("wait_human", "execute")
        graph.add_edge("finalize", END)

        return graph.compile(
            checkpointer=PostgresSaver.from_conn_string(DATABASE_URL)
        )

    async def analyze_inputs(self, state: AgentState) -> AgentState:
        """Analyze the node's inputs and build context."""
        # Fetch and process all inputs
        # Log trace event
        return state

    async def plan_execution(self, state: AgentState) -> AgentState:
        """Determine how to accomplish the task."""
        # Use LLM to create execution plan
        # Decide if sub-nodes are needed
        return state

    async def execute_step(self, state: AgentState) -> AgentState:
        """Execute a step of the plan using LLM."""
        response = await completion(
            model=self.org_config.get("model", "gpt-4"),
            messages=state["messages"],
            tools=self.tools,
            api_base=self.org_config.get("api_base"),  # For custom endpoints
            api_key=self.org_config.get("api_key")
        )
        # Process response, log trace
        return state

    # ... other methods
```

### LiteLLM Configuration

```python
# config/litellm_config.py

from litellm import Router

def get_litellm_router(org_config: dict) -> Router:
    """Build LiteLLM router based on org configuration."""

    model_list = []

    # Add org-configured models
    for model_config in org_config.get("models", []):
        model_list.append({
            "model_name": model_config["name"],
            "litellm_params": {
                "model": model_config["litellm_model"],
                "api_key": model_config.get("api_key"),
                "api_base": model_config.get("api_base"),
            }
        })

    # Add self-hosted models if configured
    if org_config.get("self_hosted_endpoint"):
        model_list.append({
            "model_name": "self-hosted",
            "litellm_params": {
                "model": "openai/custom",
                "api_base": org_config["self_hosted_endpoint"],
                "api_key": org_config.get("self_hosted_key", "dummy"),
            }
        })

    return Router(
        model_list=model_list,
        fallbacks=[{"gpt-4": ["gpt-3.5-turbo"]}],
        set_verbose=False
    )

# Example org config in database:
# {
#   "models": [
#     {
#       "name": "primary",
#       "litellm_model": "gpt-4-turbo",
#       "api_key": "sk-..."
#     },
#     {
#       "name": "anthropic",
#       "litellm_model": "claude-3-opus",
#       "api_key": "sk-ant-..."
#     }
#   ],
#   "self_hosted_endpoint": "http://internal-vllm:8000/v1",
#   "default_model": "primary"
# }
```

### Execution Trace Format

```json
{
  "execution_id": "uuid",
  "node_id": "uuid",
  "trace": [
    {
      "event_type": "execution_start",
      "timestamp": "2024-01-15T10:00:00Z",
      "data": {
        "inputs_count": 3,
        "model": "gpt-4-turbo"
      }
    },
    {
      "event_type": "llm_call",
      "timestamp": "2024-01-15T10:00:01Z",
      "duration_ms": 2500,
      "data": {
        "model": "gpt-4-turbo",
        "tokens_in": 1500,
        "tokens_out": 500,
        "prompt_summary": "Analyzing sales data for Q4...",
        "response_summary": "I'll break this into 3 sub-tasks..."
      }
    },
    {
      "event_type": "tool_call",
      "timestamp": "2024-01-15T10:00:04Z",
      "data": {
        "tool": "create_subnode",
        "arguments": {
          "title": "Data Cleaning",
          "author_type": "agent"
        },
        "result": {
          "subnode_id": "uuid"
        }
      }
    },
    {
      "event_type": "human_input_requested",
      "timestamp": "2024-01-15T10:00:10Z",
      "data": {
        "question": "Should I include competitor analysis?",
        "options": ["Yes", "No", "Limited scope"]
      }
    },
    {
      "event_type": "human_input_received",
      "timestamp": "2024-01-15T10:05:00Z",
      "data": {
        "response": "Yes",
        "user_id": "uuid"
      }
    },
    {
      "event_type": "execution_complete",
      "timestamp": "2024-01-15T10:10:00Z",
      "data": {
        "status": "complete",
        "outputs_created": 2,
        "total_tokens": 5000,
        "estimated_cost_usd": 0.15
      }
    }
  ]
}
```

---

## File Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Client requests upload URL                                   │
│     POST /api/v1/orgs/:orgId/files/upload                       │
│     { "filename": "report.pdf", "contentType": "application/pdf" }
│                                                                  │
│  2. Server creates file record, returns presigned URL            │
│     {                                                            │
│       "fileId": "uuid",                                          │
│       "uploadUrl": "https://s3...?signature=...",               │
│       "expiresAt": "2024-01-15T10:05:00Z"                       │
│     }                                                            │
│                                                                  │
│  3. Client uploads directly to S3                                │
│     PUT {uploadUrl} with file body                               │
│                                                                  │
│  4. Client confirms upload                                       │
│     POST /api/v1/files/:fileId/confirm                          │
│                                                                  │
│  5. Server enqueues file processing job                          │
│     SQS message: { "fileId": "uuid", "action": "process" }      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  FILE PROCESSING WORKER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  def process_file(file_id: str):                                │
│      file = db.get_file(file_id)                                │
│      content_type = file.content_type                           │
│                                                                  │
│      # Route to appropriate extractor                            │
│      if is_scanned_document(file):                              │
│          text = extract_with_textract(file)                     │
│      elif content_type in ['application/pdf', 'docx', ...]:     │
│          text = extract_with_unstructured(file)                 │
│      elif is_image(content_type):                               │
│          text = extract_with_textract(file)  # OCR              │
│      else:                                                       │
│          text = extract_plaintext(file)                         │
│                                                                  │
│      # Generate embedding                                        │
│      embedding = generate_embedding(text)                        │
│                                                                  │
│      # Update file record                                        │
│      db.update_file(file_id, {                                  │
│          'extracted_text': text,                                │
│          'embedding': embedding,                                 │
│          'processing_status': 'complete'                        │
│      })                                                          │
│                                                                  │
│      # Notify via Redis pub/sub                                  │
│      redis.publish(f'file:{file_id}', 'processing_complete')    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure (AWS CDK)

### Project Structure

```
infrastructure/
├── bin/
│   └── glassbox.ts              # CDK app entry point
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts     # VPC, subnets, security groups
│   │   ├── database-stack.ts    # RDS, ElastiCache
│   │   ├── storage-stack.ts     # S3, CloudFront
│   │   ├── auth-stack.ts        # Cognito
│   │   ├── compute-stack.ts     # ECS, Fargate services
│   │   ├── messaging-stack.ts   # SQS queues
│   │   └── monitoring-stack.ts  # CloudWatch, alarms
│   └── constructs/
│       ├── fargate-service.ts   # Reusable Fargate construct
│       └── ...
├── config/
│   ├── dev.ts
│   ├── staging.ts
│   └── prod.ts
└── cdk.json
```

### Example Stack (Compute)

```typescript
// lib/stacks/compute-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'GlassBoxCluster', {
      vpc: props.vpc,
      containerInsights: true,
    });

    // Go API Service
    const apiService = new ecs.FargateService(this, 'ApiService', {
      cluster,
      taskDefinition: this.createGoApiTask(),
      desiredCount: 2,
      assignPublicIp: false,
    });

    // Go WebSocket Service
    const wsService = new ecs.FargateService(this, 'WsService', {
      cluster,
      taskDefinition: this.createGoWsTask(),
      desiredCount: 2,
      assignPublicIp: false,
    });

    // Python Agent Worker
    const agentWorker = new ecs.FargateService(this, 'AgentWorker', {
      cluster,
      taskDefinition: this.createPythonAgentTask(),
      desiredCount: 2,
      assignPublicIp: false,
    });

    // Auto-scaling for agent workers
    const scaling = agentWorker.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnMetric('QueueDepthScaling', {
      metric: props.agentQueue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { upper: 0, change: -1 },
        { lower: 10, change: +1 },
        { lower: 50, change: +3 },
      ],
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
    });

    // ... listener configuration, target groups, etc.
  }
}
```

### Environment Configuration

```typescript
// config/prod.ts
export const prodConfig = {
  // Database
  database: {
    instanceClass: ec2.InstanceClass.R6G,
    instanceSize: ec2.InstanceSize.LARGE,
    multiAz: true,
    backupRetention: cdk.Duration.days(30),
  },

  // Cache
  cache: {
    nodeType: 'cache.r6g.large',
    numNodes: 2,
  },

  // Compute
  compute: {
    api: {
      cpu: 1024,
      memory: 2048,
      desiredCount: 3,
    },
    websocket: {
      cpu: 512,
      memory: 1024,
      desiredCount: 2,
    },
    agentWorker: {
      cpu: 2048,
      memory: 4096,
      minCount: 2,
      maxCount: 20,
    },
  },

  // Feature flags
  features: {
    dedicatedDbPerOrg: true,
    selfHostedAgents: true,
  },
};
```

---

## Repository Structure

```
glassbox/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/             # App router pages
│   │   │   ├── components/      # React components
│   │   │   ├── hooks/           # Custom hooks
│   │   │   ├── lib/             # Utilities
│   │   │   └── styles/          # CSS/Tailwind
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   ├── api/                      # Go API service
│   │   ├── cmd/
│   │   │   └── api/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── handlers/        # HTTP handlers
│   │   │   ├── services/        # Business logic
│   │   │   ├── models/          # Data models
│   │   │   ├── middleware/      # Auth, rate limiting
│   │   │   └── database/        # DB queries
│   │   ├── pkg/                 # Shared packages
│   │   └── go.mod
│   │
│   ├── websocket/               # Go WebSocket service
│   │   ├── cmd/
│   │   │   └── ws/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── hub/            # Connection management
│   │   │   ├── handlers/       # Message handlers
│   │   │   └── pubsub/         # Redis pub/sub
│   │   └── go.mod
│   │
│   └── workers/                 # Python workers
│       ├── agent/
│       │   ├── agent_worker.py
│       │   ├── langgraph_agent.py
│       │   ├── tools/
│       │   └── requirements.txt
│       ├── rag/
│       │   ├── rag_worker.py
│       │   ├── embeddings.py
│       │   └── requirements.txt
│       ├── file_processor/
│       │   ├── processor.py
│       │   ├── extractors/
│       │   └── requirements.txt
│       ├── shared/
│       │   ├── db.py
│       │   ├── sqs.py
│       │   ├── grpc_server.py
│       │   └── tracing.py
│       └── pyproject.toml
│
├── packages/
│   ├── shared-types/            # TypeScript types shared between services
│   ├── db-schema/               # Database migrations
│   │   └── migrations/
│   └── proto/                   # gRPC protobuf definitions
│       └── agent.proto
│
├── infrastructure/              # AWS CDK
│   ├── lib/
│   └── bin/
│
├── scripts/
│   ├── dev-setup.sh
│   ├── migrate.sh
│   └── seed.sh
│
├── docker/
│   ├── docker-compose.yml       # Local dev dependencies
│   ├── Dockerfile.api
│   ├── Dockerfile.ws
│   └── Dockerfile.worker
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-prod.yml
│
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Go 1.22+
- Python 3.11+
- Docker & Docker Compose
- pnpm 8+
- AWS CLI (configured)

### Setup Script

```bash
#!/bin/bash
# scripts/dev-setup.sh

# Start dependencies
docker compose up -d postgres redis

# Wait for postgres
until pg_isready -h localhost -p 5432; do
  sleep 1
done

# Run migrations
pnpm run db:migrate

# Seed development data
pnpm run db:seed

# Install all dependencies
pnpm install

# Setup Python environments
cd apps/workers
python -m venv .venv
source .venv/bin/activate
pip install -r agent/requirements.txt
pip install -r rag/requirements.txt
pip install -r file_processor/requirements.txt

echo "Development environment ready!"
echo "Run 'pnpm dev' to start all services"
```

### Docker Compose (Dependencies Only)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: glassbox
      POSTGRES_PASSWORD: glassbox_dev
      POSTGRES_DB: glassbox
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,sqs,secretsmanager
      - DEFAULT_REGION=us-east-1
    volumes:
      - localstack_data:/var/lib/localstack

volumes:
  postgres_data:
  redis_data:
  localstack_data:
```

### Running Services

```bash
# Terminal 1: Next.js frontend
cd apps/web && pnpm dev

# Terminal 2: Go API
cd apps/api && go run cmd/api/main.go

# Terminal 3: Go WebSocket
cd apps/websocket && go run cmd/ws/main.go

# Terminal 4: Python agent worker
cd apps/workers && source .venv/bin/activate && python -m agent.agent_worker

# Or use the unified dev command
pnpm dev  # Runs all with concurrently
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter web test

  test-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: cd apps/api && go test ./...
      - run: cd apps/websocket && go test ./...

  test-python:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: |
          cd apps/workers
          pip install pytest pytest-asyncio
          pip install -r agent/requirements.txt
          pytest

  build-images:
    needs: [lint-and-type-check, test-frontend, test-go, test-python]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -f docker/Dockerfile.api -t $ECR_REGISTRY/glassbox-api:$GITHUB_SHA .
          docker build -f docker/Dockerfile.ws -t $ECR_REGISTRY/glassbox-ws:$GITHUB_SHA .
          docker build -f docker/Dockerfile.worker -t $ECR_REGISTRY/glassbox-worker:$GITHUB_SHA .
          docker push --all-tags $ECR_REGISTRY
```

### Deploy Workflow

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy infrastructure
        run: |
          cd infrastructure
          npm ci
          npx cdk deploy --all --require-approval never

      - name: Update ECS services
        run: |
          aws ecs update-service --cluster glassbox-staging --service api --force-new-deployment
          aws ecs update-service --cluster glassbox-staging --service websocket --force-new-deployment
          aws ecs update-service --cluster glassbox-staging --service agent-worker --force-new-deployment
```

---

## MVP Scope Definition

### Phase 1: Core Node CRUD + Basic Agents (MVP)

**Frontend:**
- [ ] Authentication flow (Cognito)
- [ ] Organization/project creation
- [ ] Node list view (tree view only)
- [ ] Node detail view (inputs, outputs, evidence)
- [ ] Node create/edit forms
- [ ] File upload
- [ ] Basic agent execution trigger
- [ ] Execution status display

**Backend:**
- [ ] Core REST API endpoints
- [ ] PostgreSQL schema + migrations
- [ ] File upload to S3
- [ ] Basic SQS job queue
- [ ] Simple agent worker (single LangGraph)
- [ ] OpenAI/Anthropic support via LiteLLM

**Infrastructure:**
- [ ] Basic AWS CDK setup
- [ ] Single environment (staging)
- [ ] GitHub Actions CI

### Phase 2: Real-Time + Collaboration

- [ ] WebSocket service
- [ ] Presence tracking
- [ ] Lock management
- [ ] Real-time node updates
- [ ] Canvas view
- [ ] Graph view

### Phase 3: Enterprise Features

- [ ] Custom workflow states
- [ ] Templates
- [ ] Full audit logging
- [ ] SSO integration
- [ ] Cost tracking
- [ ] Dedicated database option
- [ ] Self-hosted agent support

### Phase 4: Advanced RAG + Scale

- [ ] Neo4j integration
- [ ] Advanced semantic search
- [ ] Graph RAG
- [ ] Multi-region deployment
- [ ] Performance optimization

---

## Security Considerations

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User clicks "Sign In"                                        │
│  2. Redirect to Cognito Hosted UI                               │
│  3. User authenticates (email/password, SSO, etc.)              │
│  4. Cognito redirects back with authorization code              │
│  5. Next.js exchanges code for tokens                           │
│  6. Store tokens in HTTP-only cookies                           │
│  7. API requests include token in Authorization header          │
│  8. Go services validate JWT with Cognito public keys           │
│                                                                  │
│  For WebSocket:                                                  │
│  9. Client requests WS token: POST /api/v1/auth/ws-token        │
│  10. Server validates JWT, returns short-lived WS token         │
│  11. Client connects to WebSocket with WS token                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Rate Limiting Strategy

```
Layer 1: AWS WAF (Edge)
  - DDoS protection
  - IP-based rate limits (10,000 req/min per IP)
  - Geographic restrictions (if needed)
  - Known bad actor blocking

Layer 2: Application (Go service)
  - Token bucket per user (Redis-backed)
  - Different limits per endpoint:
    - Standard API: 100 req/min
    - Search: 30 req/min
    - Agent execution: 10 req/min
  - Graceful degradation headers
```

### Data Encryption

```
At Rest:
  - RDS: AWS-managed encryption (AES-256)
  - S3: Server-side encryption (SSE-S3 or SSE-KMS)
  - Redis: In-transit encryption

In Transit:
  - TLS 1.3 everywhere
  - Certificate management via ACM

Application Level (Enterprise):
  - Customer-managed KMS keys option
  - Field-level encryption for sensitive data
  - Zero-knowledge option (encrypt before storage)
```

---

## Monitoring & Observability

### CloudWatch Setup

```
Metrics:
  - ECS: CPU, Memory, Task count
  - RDS: Connections, IOPS, Latency
  - ElastiCache: Memory, Connections, Hit rate
  - SQS: Queue depth, Message age
  - Custom: Request latency, Error rates, Agent execution time

Alarms:
  - High error rate (>1% 5xx responses)
  - High latency (p99 > 2s)
  - Queue backup (>100 messages, >5 min old)
  - Low disk space
  - High CPU/Memory utilization

Dashboards:
  - Service health overview
  - Agent execution metrics
  - Cost tracking
  - User activity
```

### Logging Strategy

```
Format: Structured JSON

{
  "timestamp": "2024-01-15T10:00:00Z",
  "level": "info",
  "service": "api",
  "trace_id": "abc123",
  "user_id": "uuid",
  "org_id": "uuid",
  "method": "POST",
  "path": "/api/v1/nodes",
  "status": 201,
  "duration_ms": 45,
  "message": "Node created"
}

Retention:
  - Application logs: 30 days
  - Audit logs: 1 year (compliance)
  - Agent traces: Configurable per org
```

---

## Cost Estimation (MVP)

| Service | Configuration | Est. Monthly Cost |
|---------|--------------|-------------------|
| ECS Fargate | 3x API (0.5 vCPU, 1GB), 2x WS (0.25 vCPU, 0.5GB), 2x Worker (1 vCPU, 2GB) | ~$150 |
| RDS Aurora | db.r6g.large, single-AZ | ~$180 |
| ElastiCache | cache.t4g.small, single node | ~$25 |
| S3 | 100GB storage + transfers | ~$10 |
| CloudFront | 100GB transfer | ~$15 |
| Cognito | 1,000 MAU | Free tier |
| SQS | 1M requests | ~$1 |
| CloudWatch | Logs + metrics | ~$30 |
| **Total** | | **~$410/month** |

*Note: LLM API costs are separate and depend on usage. Estimate $0.01-0.10 per agent execution.*

---

## Implementation Status

### Completed

| Component | Status | Notes |
|-----------|--------|-------|
| Repository structure | ✅ Complete | pnpm monorepo with apps/, packages/ |
| Database schema | ✅ Complete | 16 tables, pgvector, RLS ready |
| Docker local dev | ✅ Complete | Postgres, Redis, LocalStack |
| Go API skeleton | ✅ Complete | All routes defined in Gin |
| Auth (dev mode) | ✅ Complete | JWT generation + validation middleware |
| Organization endpoints | ✅ Complete | Full CRUD with role-based access |
| User endpoints | ✅ Complete | Profile + notifications |
| Project endpoints | ✅ Complete | Full CRUD under organizations |
| Node endpoints | ✅ Complete | Full CRUD with inputs/outputs |
| Node versioning | ✅ Complete | Auto-version on update, rollback support |
| Node relationships | ✅ Complete | Children + dependencies queries |
| Node locking | ✅ Complete | Redis + DB distributed locks |
| Python agent worker | 🔶 Partial | LangGraph structure, needs SQS integration |

### In Progress (Phase 4)

- File handling (S3 presigned URLs)
- SQS job dispatch

### Not Started

- Agent execution endpoints
- WebSocket service
- Search/RAG endpoints
- AWS CDK infrastructure

## Next Steps

1. ~~Set up repository structure~~ ✅
2. ~~Create database schema~~ ✅
3. ~~Build Go API skeleton~~ ✅
4. ~~Implement Project & Node APIs~~ ✅
5. **Implement file upload with S3** ← Current focus
6. Wire up Python agent worker with SQS
7. Build Next.js frontend
8. Deploy to staging with AWS CDK

---

*This document will be updated as architectural decisions evolve and new requirements emerge.*

**Last Updated:** 2026-01-27
