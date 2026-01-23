# GlassBox - Product Requirements Document

## Vision Statement

GlassBox is a collaborative workspace that structures organizational work into transparent, composable units called **Nodes**. As enterprises adopt agentic workflows, GlassBox provides the infrastructure to ensure all work—whether performed by humans or AI agents—is fully traceable, auditable, and naturally optimized for retrieval and context sharing.

**The core insight:** In a world where AI agents increasingly collaborate with humans, the "black box" problem isn't just about AI—it's about all organizational work. GlassBox makes every piece of work transparent by design.

---

## The Node Primitive

Everything in GlassBox is built on a single, powerful primitive: **The Node**.

### Node Anatomy

```
┌─────────────────────────────────────────────────────────┐
│  NODE: "Q4 Sales Analysis"                              │
│  Author: Agent (supervised by @sarah)                   │
│  Status: In Review                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  INPUTS                         OUTPUTS                 │
│  ────────                       ────────                │
│  • CRM Export (Q4)              • Executive Summary.pdf │
│  • Sales Targets.xlsx           • Regional Breakdown    │
│  • Node: "Q3 Analysis" →        • Recommendations.md    │
│    (output reference)           • structured_data.json  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  EVIDENCE (click to expand)                             │
│  ────────                                               │
│  • Agent reasoning logs                                 │
│  • 3 sub-nodes:                                         │
│    ├── Data Cleaning                                    │
│    ├── Regional Analysis                                │
│    └── Recommendation Generation                        │
│  • Intermediate calculations                            │
│  • Human feedback notes                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Node Properties

| Property | Description |
|----------|-------------|
| **Title** | Human-readable name for the work unit |
| **Author** | Human, Agent, or Agent-with-human-supervisor |
| **Inputs** | Files, documents, data, or outputs from other nodes |
| **Outputs** | Deliverables produced by completing this node |
| **Evidence** | Everything showing HOW inputs became outputs |
| **Status** | Lifecycle state (org-customizable) |
| **Version** | Full version history with rollback capability |
| **Metadata** | Created, modified, tags, permissions, cost tracking |

---

## Core Concepts

### 1. Recursive Structure

Nodes can contain sub-nodes, creating a natural hierarchy:

```
Organization Goal
└── Q4 Objectives
    └── Increase Revenue 20%
        ├── Sales Strategy Overhaul
        │   ├── Market Research          ← Agent-authored
        │   ├── Competitor Analysis      ← Agent-authored
        │   └── Strategy Document        ← Human-authored
        └── New Product Launch
            ├── Product Requirements
            ├── Development Sprint 1
            │   ├── Feature A
            │   └── Feature B
            └── Marketing Campaign
```

**Key principle:** You can always "peel back" any node to see its sub-nodes, down to the atomic level where it's just files and logs.

### 2. Composable Dependencies (Flexible DAG)

Nodes form a Directed Acyclic Graph—outputs from any node can be inputs to any other node:

- Same level: Node A's output feeds Node B's input
- Cross-level: A deeply nested node can reference a top-level node's output
- Cross-project: With permissions, reference nodes from other projects

**Circular dependency handling:** System provides warnings but allows flexible relationships. Users are responsible for resolving logical conflicts.

### 3. Dual Authorship Model

Every node has an author, which can be:

**Human Author:**
- Direct ownership of the work
- Manual input/output management
- Evidence = notes, files, meeting recordings, decisions

**Agent Author (with Human Supervisor):**
- LangGraph-based agent execution
- Automatic detailed logging (reasoning, tool calls, decisions)
- Can create sub-nodes as a core tool
- Human supervisor can intervene, redirect, or take over
- Evidence = comprehensive execution traces

### 4. Full Version History

- Every change creates a new version
- Complete audit trail of who changed what and when
- Rollback to any previous version
- Downstream nodes can pin to specific versions or follow latest

---

## Agentic Workflows

### Agent Capabilities

Agents in GlassBox have access to specialized tools:

| Tool | Description |
|------|-------------|
| `create_subnode()` | Decompose task into structured sub-tasks |
| `assign_author()` | Assign sub-nodes to humans or other agents |
| `request_input()` | Ask human supervisor for clarification/approval |
| `add_output()` | Produce deliverables |
| `log_reasoning()` | Document thought process (automatic) |
| `access_node()` | Read inputs from other nodes (with permissions) |

### Human-in-the-Loop Controls

**Two-level policy system:**

1. **Organization Level:** Baseline rules for all agent behavior
   - "Agents cannot delete nodes"
   - "Budget approvals over $10k require human"
   - "External API calls require approval"

2. **Node Level:** Further restrictions (cannot expand org-level permissions)
   - "This node requires human approval before completion"
   - "Agent can create max 3 sub-nodes without approval"
   - "Human must review all outputs before finalizing"

### Agent Execution Model

```
┌─────────────────────────────────────────────────────────┐
│                    LANGGRAPH ORCHESTRATION              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Agent receives node assignment]                       │
│           │                                             │
│           ▼                                             │
│  [Analyze inputs + context]                             │
│           │                                             │
│           ▼                                             │
│  [Decide: Can I do this directly?]                      │
│           │                                             │
│     ┌─────┴─────┐                                       │
│     │           │                                       │
│    YES          NO                                      │
│     │           │                                       │
│     ▼           ▼                                       │
│  [Execute]   [Create sub-nodes]                         │
│     │           │                                       │
│     │           ▼                                       │
│     │        [Assign: Agent or Human?]                  │
│     │           │                                       │
│     │           ▼                                       │
│     │        [Wait for sub-node completion]             │
│     │           │                                       │
│     └─────┬─────┘                                       │
│           ▼                                             │
│  [Produce outputs]                                      │
│           │                                             │
│           ▼                                             │
│  [Request human review if required]                     │
│           │                                             │
│           ▼                                             │
│  [Mark complete]                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Collaboration Features

### Real-Time Editing

- WebSocket-based live collaboration (Figma/Google Docs style)
- See who's viewing/editing in real-time
- Cursor presence and selection sharing

### Lock-Based Conflict Resolution

When an author (human or agent) is actively working on a node:

1. Node enters "locked" state
2. Other users see who has the lock
3. Changes queue until lock is released
4. Lock holder can explicitly release or system times out
5. Humans can "break" an agent's lock to intervene

### Notifications System

**Multi-channel approach:**
- In-app notification center
- Slack/Teams integration
- Email digests
- Webhooks for custom integrations

**Smart routing:**
- Users subscribe to nodes/projects
- Role-based automatic routing
- AI-assisted priority determination

---

## Organization Structure

```
Organization
├── Settings & Policies
│   ├── Agent permission policies
│   ├── Custom workflow states
│   ├── Integration configurations
│   └── Security settings
│
├── Members & Roles
│   ├── Admins
│   ├── Members
│   └── Guests (limited access)
│
└── Projects
    ├── Project Alpha
    │   ├── Settings
    │   ├── Members
    │   └── Node Canvas/Tree
    │
    └── Project Beta
        └── ...
```

### Custom Workflow States

Organizations define their own node lifecycle:

**Example: Software Company**
```
Draft → In Progress → Code Review → QA → Approved → Deployed
```

**Example: Legal Firm**
```
Draft → Internal Review → Partner Review → Client Review → Finalized → Archived
```

---

## Visualization Modes

### 1. Tree View
- Hierarchical file-explorer style
- Expand/collapse nodes
- Quick navigation for deep structures
- Best for: Understanding structure, finding specific nodes

### 2. Canvas View
- Figma-like infinite canvas
- Manual node positioning
- Freeform organization
- Best for: Creative work, brainstorming, custom layouts

### 3. Graph View
- Force-directed auto-layout
- Shows all relationships (not just parent-child)
- Highlights dependency flows
- Best for: Understanding complex relationships, impact analysis

---

## Templates

First-class template system for common workflows:

### Template Properties
- Pre-defined input/output structure
- Default sub-node structure
- Suggested workflow states
- Recommended agent configurations
- Shareable within and across organizations

### Future: Template Marketplace
*Architecturally planned but not in v1*
- Public/private template sharing
- Agent configuration packages
- Potential monetization for premium templates
- Community ratings and reviews

### Example Templates

**Research Node**
```
Inputs: Research question, Source materials, Constraints
Outputs: Research summary, Key findings, Recommendations
Sub-nodes: Literature review, Data analysis, Synthesis
```

**Code Review Node**
```
Inputs: PR link, Requirements doc, Related nodes
Outputs: Review comments, Approval status, Follow-up items
Evidence: Automated checks, Manual review notes
```

**Decision Node**
```
Inputs: Context, Options, Stakeholder input
Outputs: Decision, Rationale, Action items
Evidence: Pros/cons analysis, Discussion notes, Vote results
```

---

## Integration Architecture

### Import/Export
- Pull files from Google Drive, Dropbox, local storage
- Push outputs to external systems
- GlassBox as source of truth

### Two-Way Sync
- Bidirectional sync with selected platforms
- Conflict resolution policies
- Change tracking across systems

### MCP-Based Agent Integrations
- Agents use Model Context Protocol for external tool access
- Enterprise can self-host MCP servers for security
- Standard MCP tools: Slack, GitHub, Jira, databases, etc.

---

## Cross-Organization Collaboration

### Collaboration Patterns

| Pattern | Use Case | Capabilities |
|---------|----------|--------------|
| **Shared Workspaces** | Long-term partnerships, joint ventures | Full collaboration, shared nodes and projects |
| **Node Sharing** | Client deliverables, vendor inputs | Share specific nodes across org boundaries with controlled permissions |
| **Export/Import** | One-time transfers, compliance handoffs | Package nodes with full history, import into another org |

### Permission Model for Cross-Org

- Org admins control what can be shared externally
- Per-node sharing permissions (view, comment, edit, admin)
- Audit trail of all cross-org access
- Revocable access at any time
- Data residency controls (which org "owns" shared data)

---

## External API

### Full REST/GraphQL API

GlassBox provides comprehensive APIs for external system integration:

**Core Operations:**
- Create, read, update, delete nodes
- Manage inputs/outputs programmatically
- Trigger agent execution
- Query node relationships and history

**Use Cases:**
- CI/CD pipelines creating "deployment nodes" automatically
- CRM triggers creating "client onboarding nodes"
- External dashboards reading node status
- Automated compliance reporting
- Custom integrations not covered by built-in connectors

**API Design Principles:**
- RESTful with GraphQL option for complex queries
- Webhook support for event-driven architectures
- Rate limiting and quota management
- API keys with granular permission scopes
- OpenAPI/Swagger documentation

---

## Security & Compliance

### Deployment Options

| Option | Description | Use Case |
|--------|-------------|----------|
| **Cloud** | Fully managed SaaS | Startups, SMBs |
| **Private Cloud** | Dedicated instance in major clouds | Mid-market |
| **Self-Hosted** | On-premises deployment | Enterprise, regulated industries |

### Data Security Layers

1. **Self-Hosted Agents**
   - Enterprise deploys agent infrastructure
   - Data never leaves their network
   - Full control over model providers

2. **Data Classification**
   - Nodes have sensitivity levels
   - Agents only access appropriate clearance levels
   - Automatic PII detection and handling

3. **Encrypted Workspaces**
   - End-to-end encryption option
   - Zero-knowledge architecture available
   - Customer-managed keys

### Audit & Compliance
- Immutable audit logs
- SOC 2 Type II ready
- GDPR/CCPA compliance tools
- Custom retention policies
- Export for legal discovery

---

## Cost & Resource Tracking

### Tracked Metrics (per Node/Project/Team)

| Metric | Description |
|--------|-------------|
| **Token Usage** | Input/output tokens by model |
| **API Calls** | External service invocations |
| **Compute Time** | Agent execution duration |
| **Storage** | File and data storage consumed |
| **Estimated Cost** | Dollar amount based on provider pricing |

### Budget Controls
- Set budgets at org/project/node level
- Alerts at thresholds (50%, 80%, 100%)
- Hard limits that pause agent execution
- Cost attribution for chargebacks

---

## RAG & Retrieval

### Why GlassBox is RAG-Native

Traditional RAG struggles because organizational knowledge is scattered and unstructured. GlassBox solves this:

1. **Structured by Design**: Nodes have clear boundaries and relationships
2. **Rich Metadata**: Author, date, status, inputs, outputs all queryable
3. **Graph Relationships**: Follow edges to find related context
4. **Evidence Trail**: Reasoning and intermediate work is preserved

### Retrieval Capabilities

**Natural Language Search**
- "Find all analysis done by the sales team in Q4"
- "What nodes contributed to the product launch?"
- "Show me decisions made about pricing"

**Graph Traversal**
- Find all nodes that depend on a given output
- Trace lineage back to original sources
- Impact analysis for proposed changes

**Contextual RAG**
- When assigning work to agents, auto-suggest relevant nodes
- Pull in related context based on input/output similarity
- Smart context window optimization

---

## Scale & Architecture Principles

### Design for Enterprise, Start Small

**v1 Target:** Small teams (< 50 users, thousands of nodes)

**Architecture Principles for Future Scale:**
- Stateless services for horizontal scaling
- Event-sourced node history for audit and replay
- CQRS for read-heavy workloads
- Multi-region ready data layer
- Tenant isolation for enterprise security

---

## Success Metrics

### User Adoption
- Daily active users
- Nodes created per user
- Agent vs human authorship ratio

### Transparency Value
- Time to find information (RAG queries)
- Audit request fulfillment time
- Knowledge reuse (node references)

### Agent Effectiveness
- Task completion rate
- Human intervention frequency
- Cost per completed node
- Quality scores on agent outputs

---

## Platform & Storage

### Platform Support
- **v1:** Desktop/web only (responsive design)
- **Future:** Mobile apps for notifications and quick approvals
- **Future:** Offline mode with local-first sync

### File Storage Strategy (Configurable per Org)

| Option | Best For |
|--------|----------|
| **Direct Storage** | Small-medium files, simplicity |
| **External References** | Large datasets, existing cloud storage |
| **Hybrid** | Mixed workloads (auto-route by size/type) |

Organizations configure:
- Size thresholds for external storage
- Supported external storage providers (S3, GCS, Azure Blob, etc.)
- Retention and archival policies

---

## What GlassBox is NOT

- **Not a project management tool** (no Gantt charts, sprints, velocity)
- **Not a document editor** (integrates with editors, doesn't replace them)
- **Not just for AI** (humans benefit equally from transparency)
- **Not a chatbot** (agents do real work, not just answer questions)

---

## Summary

GlassBox transforms organizational work from opaque processes into transparent, auditable, AI-ready structures. By introducing the Node primitive—with its inputs, outputs, and evidence—teams can collaborate with AI agents while maintaining full visibility into how work gets done.

**The future of work is transparent. GlassBox makes it possible.**

---

## Next Steps

1. **Technical Implementation Document** - Architecture, tech stack, data models
2. **MVP Scope Definition** - What ships in v1 vs later
3. **User Research** - Validate assumptions with target users
4. **Prototype** - Build interactive mockups for key flows
