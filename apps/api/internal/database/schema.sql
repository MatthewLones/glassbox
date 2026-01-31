-- Migration: Initial Schema
-- Created: 2024-01-15

-- Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- ORGANIZATIONS
-- =====================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,

    -- Settings (JSONB for flexibility)
    settings JSONB DEFAULT '{}',

    -- Event sourcing configuration (org-configurable)
    -- 'full' = every change is an event
    -- 'snapshot' = periodic snapshots + events
    -- 'audit' = simple audit log only
    event_sourcing_level VARCHAR(20) DEFAULT 'snapshot',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- =====================================================
-- USERS
-- =====================================================
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

CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================
-- ORGANIZATION MEMBERS
-- =====================================================
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member', 'guest'

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);

-- =====================================================
-- PROJECTS
-- =====================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',

    -- Custom workflow states for this project
    workflow_states JSONB DEFAULT '["draft", "in_progress", "complete"]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(org_id);

-- =====================================================
-- PROJECT MEMBERS
-- =====================================================
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member', 'viewer'

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- =====================================================
-- FILES
-- =====================================================
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Storage info
    storage_key VARCHAR(500) NOT NULL,
    storage_bucket VARCHAR(255) NOT NULL,

    -- File metadata
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(255),
    size_bytes BIGINT,

    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'complete', 'failed'
    extracted_text TEXT,
    processing_error TEXT,

    -- Embeddings (pgvector) - 1536 dimensions for OpenAI ada-002
    embedding vector(1536),

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES users(id)
);

CREATE INDEX idx_files_org ON files(org_id);
CREATE INDEX idx_files_status ON files(processing_status) WHERE processing_status IN ('pending', 'processing');
-- Vector index for similarity search (IVFFlat for faster queries at scale)
CREATE INDEX idx_files_embedding ON files USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- NODES (Core Primitive)
-- =====================================================
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES nodes(id) ON DELETE SET NULL,

    -- Core fields
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',

    -- Author info
    author_type VARCHAR(20) NOT NULL, -- 'human', 'agent'
    author_user_id UUID REFERENCES users(id),
    supervisor_user_id UUID REFERENCES users(id), -- For agent-authored nodes

    -- Version tracking
    version INTEGER DEFAULT 1,

    -- Flexible metadata (JSONB)
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

CREATE INDEX idx_nodes_org_project ON nodes(org_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_parent ON nodes(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_author ON nodes(author_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_status ON nodes(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_nodes_locked ON nodes(locked_by) WHERE locked_by IS NOT NULL;

-- =====================================================
-- NODE VERSIONS (Full History)
-- =====================================================
CREATE TABLE node_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,

    -- Snapshot of node state at this version
    snapshot JSONB NOT NULL,

    -- What changed
    change_type VARCHAR(50), -- 'created', 'updated', 'status_change', 'inputs_changed', 'outputs_changed'
    change_summary TEXT,
    changed_by UUID REFERENCES users(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(node_id, version)
);

CREATE INDEX idx_node_versions_node ON node_versions(node_id, version DESC);

-- =====================================================
-- NODE INPUTS
-- =====================================================
CREATE TABLE node_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

    -- Input type
    input_type VARCHAR(50) NOT NULL, -- 'file', 'node_reference', 'external_link', 'text'

    -- For file inputs
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,

    -- For node reference inputs (output of another node)
    source_node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    source_node_version INTEGER, -- NULL = latest version

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

CREATE INDEX idx_node_inputs_node ON node_inputs(node_id);
CREATE INDEX idx_node_inputs_source ON node_inputs(source_node_id) WHERE source_node_id IS NOT NULL;

-- =====================================================
-- NODE OUTPUTS
-- =====================================================
CREATE TABLE node_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

    -- Output type
    output_type VARCHAR(50) NOT NULL, -- 'file', 'structured_data', 'text', 'external_link'

    -- For file outputs
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,

    -- For structured data outputs
    structured_data JSONB,

    -- For text outputs
    text_content TEXT,

    -- For external links
    external_url TEXT,

    -- Metadata
    label VARCHAR(255),
    metadata JSONB DEFAULT '{}',

    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_node_outputs_node ON node_outputs(node_id);

-- =====================================================
-- NODE DEPENDENCIES (DAG edges beyond parent-child)
-- =====================================================
CREATE TABLE node_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source node's output feeds into target node's input
    source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

    -- Which specific output/input are connected (optional for general dependencies)
    source_output_id UUID REFERENCES node_outputs(id) ON DELETE SET NULL,
    target_input_id UUID REFERENCES node_inputs(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_node_id, target_node_id, source_output_id, target_input_id)
);

CREATE INDEX idx_node_deps_source ON node_dependencies(source_node_id);
CREATE INDEX idx_node_deps_target ON node_dependencies(target_node_id);

-- =====================================================
-- AGENT EXECUTIONS (Evidence)
-- =====================================================
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

    -- Execution status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'paused', 'complete', 'failed', 'cancelled'

    -- LangGraph state
    langgraph_thread_id VARCHAR(255),
    langgraph_checkpoint JSONB,

    -- Summary trace (high-level)
    trace_summary JSONB DEFAULT '[]',

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Cost tracking
    total_tokens_in INTEGER DEFAULT 0,
    total_tokens_out INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 6) DEFAULT 0,

    -- Model used
    model_id VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_executions_node ON agent_executions(node_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status) WHERE status IN ('pending', 'running', 'paused');

-- =====================================================
-- AGENT TRACE EVENTS (Detailed Logging)
-- =====================================================
CREATE TABLE agent_trace_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,

    -- Event info
    event_type VARCHAR(50) NOT NULL, -- 'llm_call', 'tool_call', 'decision', 'human_input_requested', 'human_input_received', 'error', 'checkpoint'
    event_data JSONB NOT NULL,

    -- Timing
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER,

    -- For LLM calls
    model VARCHAR(100),
    tokens_in INTEGER,
    tokens_out INTEGER,

    -- Sequence number for ordering
    sequence_number SERIAL
);

CREATE INDEX idx_trace_events_execution ON agent_trace_events(execution_id, sequence_number);
CREATE INDEX idx_trace_events_type ON agent_trace_events(execution_id, event_type);

-- =====================================================
-- TEMPLATES
-- =====================================================
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system template

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Template structure (defines inputs, outputs, sub-nodes, etc.)
    structure JSONB NOT NULL,

    -- Agent configuration
    agent_config JSONB DEFAULT '{}',

    is_public BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_templates_org ON templates(org_id);
CREATE INDEX idx_templates_public ON templates(is_public) WHERE is_public = true;

-- =====================================================
-- AUDIT LOG
-- =====================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Who performed the action
    user_id UUID REFERENCES users(id),
    agent_execution_id UUID REFERENCES agent_executions(id),

    -- What happened
    action VARCHAR(100) NOT NULL, -- 'node.created', 'node.updated', 'execution.started', etc.
    resource_type VARCHAR(50) NOT NULL, -- 'node', 'project', 'file', etc.
    resource_id UUID,

    -- Details
    details JSONB DEFAULT '{}',

    -- When
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Request metadata (for compliance)
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_log_org_time ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Notification content
    type VARCHAR(50) NOT NULL, -- 'execution_complete', 'human_input_needed', 'mention', 'node_assigned', etc.
    title VARCHAR(255) NOT NULL,
    body TEXT,

    -- Related resources
    resource_type VARCHAR(50),
    resource_id UUID,

    -- State
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on tenant-scoped tables
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

-- Note: RLS policies will be created by the application based on the current user's org membership
-- Example policy (to be applied dynamically):
-- CREATE POLICY org_isolation ON nodes
--     USING (org_id = current_setting('app.current_org_id')::UUID);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to increment node version on update
CREATE OR REPLACE FUNCTION increment_node_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment if content changed (not just lock state)
    IF (OLD.title IS DISTINCT FROM NEW.title OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.metadata IS DISTINCT FROM NEW.metadata) THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_nodes_version
    BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION increment_node_version();
