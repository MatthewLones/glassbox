# GlassBox Database Schema v1

Complete database schema documentation for PostgreSQL with pgvector.

## Overview

- **Database**: PostgreSQL 16
- **Extensions**: uuid-ossp, pgcrypto, pgvector
- **Total Tables**: 16
- **Vector Dimensions**: 1536 (OpenAI text-embedding-3-small)

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORGANIZATIONS                                   │
│  ┌──────────────┐                                                           │
│  │ organizations│◄──────────────────────────────────────────────────────────┤
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         │ 1:N                                                               │
│         ▼                                                                    │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐            │
│  │  org_members │◄─────►│    users     │◄─────►│project_members│            │
│  └──────────────┘       └──────────────┘       └──────────────┘            │
│                                                        │                     │
│         │                                              │                     │
│         │ 1:N                                          │ N:1                 │
│         ▼                                              ▼                     │
│  ┌──────────────┐                              ┌──────────────┐            │
│  │   projects   │◄─────────────────────────────│   projects   │            │
│  └──────┬───────┘                              └──────────────┘            │
│         │                                                                    │
│         │ 1:N                                                               │
│         ▼                                                                    │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐            │
│  │    nodes     │──────►│ node_versions│       │    files     │            │
│  └──────┬───────┘       └──────────────┘       └──────────────┘            │
│         │                                              ▲                     │
│         │ 1:N                                          │                     │
│         ├──────────────────────────────────────────────┤                     │
│         │                                              │                     │
│         ▼                                              │                     │
│  ┌──────────────┐       ┌──────────────┐              │                     │
│  │ node_inputs  │───────│node_outputs  │──────────────┘                     │
│  └──────────────┘       └──────────────┘                                    │
│         │                                                                    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐            │
│  │node_dependen.│       │agent_execut. │──────►│agent_trace_  │            │
│  └──────────────┘       └──────────────┘       │   events     │            │
│                                                 └──────────────┘            │
│                                                                              │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐            │
│  │  templates   │       │  audit_log   │       │notifications │            │
│  └──────────────┘       └──────────────┘       └──────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### organizations

Primary tenant table for multi-tenancy.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | | Organization name |
| slug | VARCHAR(100) | NO | | URL-safe identifier (unique) |
| settings | JSONB | YES | '{}' | Configuration (models, policies) |
| event_sourcing_level | VARCHAR(20) | YES | 'snapshot' | 'full', 'snapshot', 'audit' |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update timestamp |

**Indexes:**
- `idx_organizations_slug` on (slug)

**Settings JSONB Structure:**
```json
{
  "defaultModel": "gpt-4",
  "allowedModels": ["gpt-4", "claude-3"],
  "selfHostedEndpoint": null,
  "agentPolicies": {
    "maxTokensPerExecution": 100000,
    "requireApproval": false
  }
}
```

---

### users

User accounts linked to AWS Cognito.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| cognito_sub | VARCHAR(255) | NO | | Cognito subject ID (unique) |
| email | VARCHAR(255) | NO | | User email |
| name | VARCHAR(255) | YES | | Display name |
| avatar_url | TEXT | YES | | Profile image URL |
| settings | JSONB | YES | '{}' | User preferences |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update timestamp |

**Indexes:**
- `idx_users_cognito_sub` on (cognito_sub)
- `idx_users_email` on (email)

---

### org_members

Organization membership and roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| org_id | UUID | NO | | FK to organizations |
| user_id | UUID | NO | | FK to users |
| role | VARCHAR(50) | YES | 'member' | 'owner', 'admin', 'member', 'guest' |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Constraints:**
- UNIQUE(org_id, user_id)
- FK org_id → organizations(id) ON DELETE CASCADE
- FK user_id → users(id) ON DELETE CASCADE

**Indexes:**
- `idx_org_members_org` on (org_id)
- `idx_org_members_user` on (user_id)

---

### projects

Projects within organizations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| org_id | UUID | NO | | FK to organizations |
| name | VARCHAR(255) | NO | | Project name |
| description | TEXT | YES | | Project description |
| settings | JSONB | YES | '{}' | Project configuration |
| workflow_states | JSONB | YES | '["draft","in_progress","complete"]' | Custom workflow states |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update timestamp |

**Indexes:**
- `idx_projects_org` on (org_id)

---

### nodes

Core work unit primitive - the heart of GlassBox.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| org_id | UUID | NO | | FK to organizations |
| project_id | UUID | NO | | FK to projects |
| parent_id | UUID | YES | | FK to nodes (self-reference) |
| title | VARCHAR(500) | NO | | Node title |
| description | TEXT | YES | | Node description |
| status | VARCHAR(50) | YES | 'draft' | Workflow status |
| author_type | VARCHAR(20) | NO | | 'human' or 'agent' |
| author_user_id | UUID | YES | | FK to users |
| supervisor_user_id | UUID | YES | | FK to users (for agent nodes) |
| version | INTEGER | YES | 1 | Version number |
| metadata | JSONB | YES | '{}' | Flexible metadata |
| position | JSONB | YES | '{"x":0,"y":0}' | Canvas position |
| locked_by | UUID | YES | | FK to users (lock holder) |
| locked_at | TIMESTAMPTZ | YES | | Lock acquisition time |
| lock_expires_at | TIMESTAMPTZ | YES | | Lock expiration time |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update timestamp |
| deleted_at | TIMESTAMPTZ | YES | | Soft delete timestamp |

**Indexes:**
- `idx_nodes_org_project` on (org_id, project_id) WHERE deleted_at IS NULL
- `idx_nodes_parent` on (parent_id) WHERE deleted_at IS NULL
- `idx_nodes_author` on (author_user_id) WHERE deleted_at IS NULL
- `idx_nodes_status` on (org_id, status) WHERE deleted_at IS NULL
- `idx_nodes_locked` on (locked_by) WHERE locked_by IS NOT NULL

**Metadata JSONB Structure:**
```json
{
  "priority": "high",
  "dueDate": "2024-01-20",
  "tags": ["research", "analysis"],
  "assignees": ["user-uuid-1", "user-uuid-2"]
}
```

---

### node_versions

Full version history for nodes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| node_id | UUID | NO | | FK to nodes |
| version | INTEGER | NO | | Version number |
| snapshot | JSONB | NO | | Full node state at this version |
| change_type | VARCHAR(50) | YES | | 'created', 'updated', 'status_change' |
| change_summary | TEXT | YES | | Human-readable change description |
| changed_by | UUID | YES | | FK to users |
| created_at | TIMESTAMPTZ | YES | NOW() | Version creation time |

**Constraints:**
- UNIQUE(node_id, version)

**Indexes:**
- `idx_node_versions_node` on (node_id, version DESC)

---

### node_inputs

Input connections for nodes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| node_id | UUID | NO | | FK to nodes |
| input_type | VARCHAR(50) | NO | | 'file', 'node_reference', 'external_link', 'text' |
| file_id | UUID | YES | | FK to files |
| source_node_id | UUID | YES | | FK to nodes |
| source_node_version | INTEGER | YES | | Specific version (NULL = latest) |
| external_url | TEXT | YES | | External link URL |
| text_content | TEXT | YES | | Text input content |
| label | VARCHAR(255) | YES | | Display label |
| metadata | JSONB | YES | '{}' | Additional metadata |
| sort_order | INTEGER | YES | 0 | Display order |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Indexes:**
- `idx_node_inputs_node` on (node_id)
- `idx_node_inputs_source` on (source_node_id) WHERE source_node_id IS NOT NULL

---

### node_outputs

Output data from nodes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| node_id | UUID | NO | | FK to nodes |
| output_type | VARCHAR(50) | NO | | 'file', 'structured_data', 'text', 'external_link' |
| file_id | UUID | YES | | FK to files |
| structured_data | JSONB | YES | | Structured output data |
| text_content | TEXT | YES | | Text output content |
| external_url | TEXT | YES | | External link URL |
| label | VARCHAR(255) | YES | | Display label |
| metadata | JSONB | YES | '{}' | Additional metadata |
| sort_order | INTEGER | YES | 0 | Display order |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Indexes:**
- `idx_node_outputs_node` on (node_id)

---

### node_dependencies

DAG edges beyond parent-child relationships.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| source_node_id | UUID | NO | | FK to nodes (output provider) |
| target_node_id | UUID | NO | | FK to nodes (input consumer) |
| source_output_id | UUID | YES | | FK to node_outputs |
| target_input_id | UUID | YES | | FK to node_inputs |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Constraints:**
- UNIQUE(source_node_id, target_node_id, source_output_id, target_input_id)

**Indexes:**
- `idx_node_deps_source` on (source_node_id)
- `idx_node_deps_target` on (target_node_id)

---

### files

Uploaded files with text extraction and embeddings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| org_id | UUID | NO | | FK to organizations |
| storage_key | VARCHAR(500) | NO | | S3 object key |
| storage_bucket | VARCHAR(255) | NO | | S3 bucket name |
| filename | VARCHAR(500) | NO | | Original filename |
| content_type | VARCHAR(255) | YES | | MIME type |
| size_bytes | BIGINT | YES | | File size in bytes |
| processing_status | VARCHAR(50) | YES | 'pending' | 'pending', 'processing', 'complete', 'failed' |
| extracted_text | TEXT | YES | | Extracted text content |
| processing_error | TEXT | YES | | Error message if failed |
| embedding | vector(1536) | YES | | pgvector embedding |
| metadata | JSONB | YES | '{}' | Additional metadata |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| uploaded_by | UUID | YES | | FK to users |

**Indexes:**
- `idx_files_org` on (org_id)
- `idx_files_status` on (processing_status) WHERE processing_status IN ('pending', 'processing')
- `idx_files_embedding` on (embedding) USING ivfflat WITH (lists = 100)

---

## Agent Execution Tables

### agent_executions

Agent execution records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| node_id | UUID | NO | | FK to nodes |
| status | VARCHAR(50) | YES | 'pending' | Execution status |
| langgraph_thread_id | VARCHAR(255) | YES | | LangGraph thread ID |
| langgraph_checkpoint | JSONB | YES | | State checkpoint for resume |
| trace_summary | JSONB | YES | '[]' | High-level trace summary |
| started_at | TIMESTAMPTZ | YES | | Execution start time |
| completed_at | TIMESTAMPTZ | YES | | Execution end time |
| error_message | TEXT | YES | | Error if failed |
| total_tokens_in | INTEGER | YES | 0 | Total input tokens |
| total_tokens_out | INTEGER | YES | 0 | Total output tokens |
| estimated_cost_usd | DECIMAL(10,6) | YES | 0 | Estimated cost |
| model_id | VARCHAR(100) | YES | | Model used |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Status Values:**
- `pending` - Queued, not started
- `running` - Currently executing
- `paused` - Paused by user
- `awaiting_input` - Waiting for human input (HITL)
- `complete` - Successfully completed
- `failed` - Failed with error
- `cancelled` - Cancelled by user

**Indexes:**
- `idx_agent_executions_node` on (node_id)
- `idx_agent_executions_status` on (status) WHERE status IN ('pending', 'running', 'paused')

---

### agent_trace_events

Detailed execution trace events.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| execution_id | UUID | NO | | FK to agent_executions |
| event_type | VARCHAR(50) | NO | | Event type |
| event_data | JSONB | NO | | Event payload |
| timestamp | TIMESTAMPTZ | YES | NOW() | Event timestamp |
| duration_ms | INTEGER | YES | | Event duration |
| model | VARCHAR(100) | YES | | Model used (for LLM calls) |
| tokens_in | INTEGER | YES | | Input tokens |
| tokens_out | INTEGER | YES | | Output tokens |
| sequence_number | SERIAL | | | Ordering sequence |

**Event Types:**
- `llm_call` - LLM API call
- `tool_call` - Tool execution
- `decision` - Agent decision point
- `human_input_requested` - HITL request
- `human_input_received` - HITL response
- `error` - Error occurred
- `checkpoint` - State checkpoint saved

**Indexes:**
- `idx_trace_events_execution` on (execution_id, sequence_number)
- `idx_trace_events_type` on (execution_id, event_type)

---

## Supporting Tables

### templates

Reusable node templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| org_id | UUID | YES | | FK to organizations (NULL = system) |
| name | VARCHAR(255) | NO | | Template name |
| description | TEXT | YES | | Template description |
| structure | JSONB | NO | | Template structure |
| agent_config | JSONB | YES | '{}' | Agent configuration |
| is_public | BOOLEAN | YES | false | Public visibility |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | YES | NOW() | Last update timestamp |
| created_by | UUID | YES | | FK to users |

**Indexes:**
- `idx_templates_org` on (org_id)
- `idx_templates_public` on (is_public) WHERE is_public = true

---

### audit_log

Compliance audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| org_id | UUID | NO | | FK to organizations |
| user_id | UUID | YES | | FK to users |
| agent_execution_id | UUID | YES | | FK to agent_executions |
| action | VARCHAR(100) | NO | | Action performed |
| resource_type | VARCHAR(50) | NO | | Resource type |
| resource_id | UUID | YES | | Resource ID |
| details | JSONB | YES | '{}' | Action details |
| created_at | TIMESTAMPTZ | YES | NOW() | Audit timestamp |
| ip_address | INET | YES | | Client IP address |
| user_agent | TEXT | YES | | Client user agent |

**Indexes:**
- `idx_audit_log_org_time` on (org_id, created_at DESC)
- `idx_audit_log_resource` on (resource_type, resource_id)
- `idx_audit_log_user` on (user_id, created_at DESC)

---

### notifications

User notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | | FK to users |
| org_id | UUID | NO | | FK to organizations |
| type | VARCHAR(50) | NO | | Notification type |
| title | VARCHAR(255) | NO | | Notification title |
| body | TEXT | YES | | Notification body |
| resource_type | VARCHAR(50) | YES | | Related resource type |
| resource_id | UUID | YES | | Related resource ID |
| read_at | TIMESTAMPTZ | YES | | Read timestamp |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Notification Types:**
- `execution_complete` - Agent execution finished
- `human_input_needed` - HITL request
- `mention` - User mentioned in node
- `node_assigned` - Node assigned to user
- `lock_released` - Lock on node released

**Indexes:**
- `idx_notifications_user` on (user_id, created_at DESC)
- `idx_notifications_unread` on (user_id) WHERE read_at IS NULL

---

### project_members

Project-level permissions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| project_id | UUID | NO | | FK to projects |
| user_id | UUID | NO | | FK to users |
| role | VARCHAR(50) | YES | 'member' | 'admin', 'member', 'viewer' |
| created_at | TIMESTAMPTZ | YES | NOW() | Creation timestamp |

**Constraints:**
- UNIQUE(project_id, user_id)

**Indexes:**
- `idx_project_members_project` on (project_id)
- `idx_project_members_user` on (user_id)

---

## Row-Level Security (RLS)

RLS is enabled on all tenant-scoped tables:

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

### Setting Organization Context

The API sets the organization context before queries:

```sql
SET app.current_org_id = 'organization-uuid';
```

### Example RLS Policy

```sql
CREATE POLICY org_isolation ON nodes
    USING (org_id = current_setting('app.current_org_id')::UUID);
```

---

## Triggers

### update_updated_at

Automatically updates `updated_at` on row modification:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to: organizations, users, projects, nodes, templates

### increment_node_version

Automatically increments node version on content changes:

```sql
CREATE OR REPLACE FUNCTION increment_node_version()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.title IS DISTINCT FROM NEW.title OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.metadata IS DISTINCT FROM NEW.metadata) THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Vector Search

### Embedding Storage

Files store embeddings as `vector(1536)` for OpenAI text-embedding-3-small:

```sql
embedding vector(1536)
```

### IVFFlat Index

Approximate nearest neighbor search with IVFFlat:

```sql
CREATE INDEX idx_files_embedding ON files
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### Similarity Query

```sql
SELECT id, filename,
       1 - (embedding <=> $1::vector) AS similarity
FROM files
WHERE org_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

---

## Migration File

Located at: `packages/db-schema/migrations/001_initial_schema.sql`

Run migrations via:
- **API startup**: Auto-runs on boot (idempotent)
- **Manual**: `psql $DATABASE_URL -f packages/db-schema/migrations/001_initial_schema.sql`
