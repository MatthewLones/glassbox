-- GlassBox Development Seed Data
-- Run this after migrations to populate test data for local development

-- Clear existing data (in reverse dependency order)
TRUNCATE TABLE
    agent_trace_events,
    agent_executions,
    node_dependencies,
    node_outputs,
    node_inputs,
    node_versions,
    nodes,
    files,
    project_members,
    projects,
    org_members,
    users,
    organizations,
    templates,
    audit_log,
    notifications
CASCADE;

-- ============================================================================
-- Test Organization
-- ============================================================================
INSERT INTO organizations (id, name, slug, settings, event_sourcing_level) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Acme Corp',
    'acme',
    '{
        "default_model": "gpt-4o",
        "models": [
            {"name": "primary", "litellm_model": "gpt-4o"},
            {"name": "fast", "litellm_model": "gpt-4o-mini"}
        ]
    }'::jsonb,
    'full'
);

-- ============================================================================
-- Test Users
-- ============================================================================
INSERT INTO users (id, cognito_sub, email, name, avatar_url) VALUES
(
    '22222222-2222-2222-2222-222222222222',
    'dev-user-1',
    'alice@acme.com',
    'Alice Developer',
    NULL
),
(
    '33333333-3333-3333-3333-333333333333',
    'dev-user-2',
    'bob@acme.com',
    'Bob Engineer',
    NULL
);

-- ============================================================================
-- Organization Members
-- ============================================================================
INSERT INTO org_members (id, org_id, user_id, role) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'owner'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'member'
);

-- ============================================================================
-- Test Project
-- ============================================================================
INSERT INTO projects (id, org_id, name, description, settings, workflow_states) VALUES
(
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Q1 Planning',
    'Strategic planning for Q1 2026',
    '{}'::jsonb,
    '["draft", "in_progress", "review", "complete"]'::jsonb
);

-- ============================================================================
-- Project Members
-- ============================================================================
INSERT INTO project_members (id, project_id, user_id, role) VALUES
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'admin'
),
(
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'member'
);

-- ============================================================================
-- Test Nodes (Hierarchical Structure)
-- ============================================================================

-- Root node
INSERT INTO nodes (id, org_id, project_id, parent_id, title, status, author_type, author_user_id, version, metadata, position) VALUES
(
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    NULL,
    'Q1 Strategic Goals',
    'in_progress',
    'human',
    '22222222-2222-2222-2222-222222222222',
    1,
    '{"priority": "high"}'::jsonb,
    '{"x": 0, "y": 0}'::jsonb
);

-- Child node 1 (human-authored)
INSERT INTO nodes (id, org_id, project_id, parent_id, title, status, author_type, author_user_id, version, metadata, position) VALUES
(
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    'Market Research',
    'complete',
    'human',
    '33333333-3333-3333-3333-333333333333',
    2,
    '{}'::jsonb,
    '{"x": -200, "y": 150}'::jsonb
);

-- Child node 2 (agent-authored with supervisor)
INSERT INTO nodes (id, org_id, project_id, parent_id, title, status, author_type, author_user_id, supervisor_user_id, version, metadata, position) VALUES
(
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    'Competitor Analysis',
    'in_progress',
    'agent',
    NULL,
    '22222222-2222-2222-2222-222222222222',
    1,
    '{"model": "gpt-4o"}'::jsonb,
    '{"x": 200, "y": 150}'::jsonb
);

-- Grandchild node (under Market Research)
INSERT INTO nodes (id, org_id, project_id, parent_id, title, status, author_type, author_user_id, version, metadata, position) VALUES
(
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    'Customer Survey Results',
    'complete',
    'human',
    '33333333-3333-3333-3333-333333333333',
    1,
    '{}'::jsonb,
    '{"x": -200, "y": 300}'::jsonb
);

-- ============================================================================
-- Node Inputs (for Market Research node)
-- ============================================================================
INSERT INTO node_inputs (id, node_id, input_type, text_content, label, sort_order) VALUES
(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '66666666-6666-6666-6666-666666666666',
    'text',
    'Analyze market trends for Q1 2026 focusing on: 1) Emerging technologies 2) Customer pain points 3) Competitive landscape',
    'Instructions',
    0
);

-- Reference to another node as input
INSERT INTO node_inputs (id, node_id, input_type, source_node_id, label, sort_order) VALUES
(
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '77777777-7777-7777-7777-777777777777',
    'node_reference',
    '66666666-6666-6666-6666-666666666666',
    'Market Research Results',
    0
);

-- ============================================================================
-- Node Outputs (for Market Research node)
-- ============================================================================
INSERT INTO node_outputs (id, node_id, output_type, text_content, label, sort_order) VALUES
(
    '99999999-9999-9999-9999-999999999999',
    '66666666-6666-6666-6666-666666666666',
    'text',
    '## Market Research Summary

### Key Findings
1. AI adoption increasing 40% YoY
2. Customers want better collaboration tools
3. Main competitors: Notion, Coda, Monday

### Recommendations
- Focus on AI-native features
- Emphasize transparency and auditability
- Target enterprise segment',
    'Research Summary',
    0
);

INSERT INTO node_outputs (id, node_id, output_type, structured_data, label, sort_order) VALUES
(
    'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0',
    '66666666-6666-6666-6666-666666666666',
    'structured_data',
    '{
        "market_size": "$45B",
        "growth_rate": "12%",
        "top_competitors": ["Notion", "Coda", "Monday"],
        "opportunity_score": 8.5
    }'::jsonb,
    'Market Metrics',
    1
);

-- ============================================================================
-- Node Versions (for Market Research showing edit history)
-- ============================================================================
INSERT INTO node_versions (id, node_id, version, snapshot, change_type, change_summary, changed_by) VALUES
(
    'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0',
    '66666666-6666-6666-6666-666666666666',
    1,
    '{"title": "Market Research", "status": "draft"}'::jsonb,
    'created',
    'Initial creation',
    '33333333-3333-3333-3333-333333333333'
),
(
    'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0',
    '66666666-6666-6666-6666-666666666666',
    2,
    '{"title": "Market Research", "status": "complete"}'::jsonb,
    'status_change',
    'Marked as complete after review',
    '33333333-3333-3333-3333-333333333333'
);

-- ============================================================================
-- Node Dependencies (Competitor Analysis depends on Market Research)
-- ============================================================================
INSERT INTO node_dependencies (id, source_node_id, target_node_id) VALUES
(
    'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0',
    '66666666-6666-6666-6666-666666666666',
    '77777777-7777-7777-7777-777777777777'
);

-- ============================================================================
-- Agent Execution (for the agent-authored node)
-- ============================================================================
INSERT INTO agent_executions (id, node_id, status, langgraph_thread_id, trace_summary, started_at, total_tokens_in, total_tokens_out, estimated_cost_usd, model_id) VALUES
(
    'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
    '77777777-7777-7777-7777-777777777777',
    'running',
    'lg-thread-12345',
    '[]'::jsonb,
    NOW() - INTERVAL '5 minutes',
    1500,
    500,
    0.05,
    'gpt-4o'
);

-- ============================================================================
-- Agent Trace Events
-- ============================================================================
INSERT INTO agent_trace_events (id, execution_id, event_type, event_data, model, tokens_in, tokens_out, duration_ms) VALUES
(
    'f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0',
    'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
    'llm_call',
    '{
        "prompt_summary": "Analyzing market research data...",
        "response_summary": "I will create a competitor analysis based on the market research..."
    }'::jsonb,
    'gpt-4o',
    1000,
    300,
    2500
),
(
    'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
    'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
    'tool_call',
    '{
        "tool": "access_node",
        "arguments": {"node_id": "66666666-6666-6666-6666-666666666666"},
        "result": "Retrieved market research outputs"
    }'::jsonb,
    NULL,
    500,
    200,
    150
);

-- ============================================================================
-- Sample Template
-- ============================================================================
INSERT INTO templates (id, org_id, name, description, structure, agent_config, is_public) VALUES
(
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
    NULL,  -- System template
    'Research Report',
    'Standard template for research tasks with analysis and recommendations',
    '{
        "default_inputs": [
            {"type": "text", "label": "Research Question"},
            {"type": "text", "label": "Constraints"}
        ],
        "default_outputs": [
            {"type": "text", "label": "Executive Summary"},
            {"type": "structured_data", "label": "Key Findings"},
            {"type": "text", "label": "Recommendations"}
        ],
        "suggested_subnodes": [
            {"title": "Literature Review", "author_type": "agent"},
            {"title": "Data Analysis", "author_type": "agent"},
            {"title": "Synthesis", "author_type": "human"}
        ]
    }'::jsonb,
    '{"model": "gpt-4o", "max_iterations": 10}'::jsonb,
    true
),
(
    'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
    '11111111-1111-1111-1111-111111111111',  -- Org-specific template
    'Acme Decision Doc',
    'Acme Corp standard decision documentation template',
    '{
        "default_inputs": [
            {"type": "text", "label": "Context"},
            {"type": "text", "label": "Options"},
            {"type": "text", "label": "Stakeholders"}
        ],
        "default_outputs": [
            {"type": "text", "label": "Decision"},
            {"type": "text", "label": "Rationale"},
            {"type": "structured_data", "label": "Action Items"}
        ]
    }'::jsonb,
    '{}'::jsonb,
    false
);

-- ============================================================================
-- Done! Print summary
-- ============================================================================
DO $$
DECLARE
    org_count INT;
    user_count INT;
    project_count INT;
    node_count INT;
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO project_count FROM projects;
    SELECT COUNT(*) INTO node_count FROM nodes;

    RAISE NOTICE '=== Seed Data Summary ===';
    RAISE NOTICE 'Organizations: %', org_count;
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE 'Projects: %', project_count;
    RAISE NOTICE 'Nodes: %', node_count;
    RAISE NOTICE '=========================';
END $$;
