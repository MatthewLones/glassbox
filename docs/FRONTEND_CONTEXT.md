# GlassBox Frontend Context

This document provides context for frontend development. The backend is being built separately - this covers what the UI needs to represent.

---

## What is GlassBox?

GlassBox is a collaborative workspace where humans and AI agents work together on complex tasks. Think: Google Docs meets AI workflows.

**Core principle:** Everything is transparent and auditable. You can always see *why* something was produced and *how*.

---

## The Node Primitive

Everything in GlassBox is a **Node**. A node is a unit of work with:

```
┌─────────────────────────────────────────────────────────────┐
│                         NODE                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUTS                    OUTPUTS                           │
│  ├── File (PDF, Doc)       ├── File (generated report)      │
│  ├── Another Node          ├── Structured Data (JSON)       │
│  ├── External Link         ├── Text (analysis, summary)     │
│  └── Text Instructions     └── External Link                │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  EVIDENCE (the "glass box")                                  │
│  ├── Agent execution logs                                    │
│  ├── LLM reasoning traces                                    │
│  ├── Tool calls made                                         │
│  ├── Human decisions                                         │
│  └── Sub-nodes created                                       │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  METADATA                                                    │
│  ├── Author: Human OR Agent (with human supervisor)         │
│  ├── Status: draft → in_progress → review → complete        │
│  ├── Version: Full history, can rollback                    │
│  └── Lock: Who's currently editing                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Node Relationships

### 1. Parent-Child (Tree Structure)
Nodes can contain sub-nodes, creating a hierarchy:

```
Research Report (parent)
├── Data Collection (child)
│   ├── Survey Analysis (grandchild)
│   └── Interview Summary (grandchild)
├── Literature Review (child)
└── Conclusions (child)
```

### 2. Dependencies (DAG Structure)
Nodes can depend on other nodes (even across branches):

```
Node A ──────┐
             ├──► Node C (depends on both A and B)
Node B ──────┘
```

---

## Author Types

Every node has an author:

| Author Type | Description |
|-------------|-------------|
| **Human** | Created/edited directly by a user |
| **Agent** | Created by AI, always has a human supervisor |

Agent-authored nodes show:
- Which AI model was used
- Full execution trace (every LLM call, tool use, decision)
- Human supervisor who approved/triggered it

---

## Key UI Views Needed

### 1. Tree View (Default)
Hierarchical list showing parent-child relationships. Expandable/collapsible nodes.

### 2. Canvas View
Spatial layout where users can drag nodes around. Shows dependencies as connecting lines.

### 3. Graph View
Force-directed graph showing all relationships (parent-child AND dependencies).

### 4. Node Detail View
Full view of a single node showing:
- All inputs (with preview/expand)
- All outputs (with preview/download)
- Evidence panel (collapsible, shows agent trace)
- Version history timeline
- Comments/discussion

### 5. Execution View
Real-time view when an agent is running:
- Current step
- Streaming output
- Trace building in real-time
- Pause/cancel controls

---

## Data Structures (TypeScript)

```typescript
interface Node {
  id: string;
  title: string;
  status: 'draft' | 'in_progress' | 'review' | 'complete' | string; // custom statuses

  // Hierarchy
  projectId: string;
  parentId: string | null;

  // Author
  authorType: 'human' | 'agent';
  authorUserId: string | null;      // if human
  supervisorUserId: string | null;  // if agent

  // Versioning
  version: number;

  // Collaboration
  lockedBy: string | null;
  lockedAt: string | null;

  // Canvas position
  position: { x: number; y: number };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

interface NodeInput {
  id: string;
  nodeId: string;
  inputType: 'file' | 'node_reference' | 'external_link' | 'text';

  // Depending on type:
  fileId?: string;
  sourceNodeId?: string;
  sourceNodeVersion?: number;
  externalUrl?: string;
  textContent?: string;

  label: string;
  sortOrder: number;
}

interface NodeOutput {
  id: string;
  nodeId: string;
  outputType: 'file' | 'structured_data' | 'text' | 'external_link';

  // Depending on type:
  fileId?: string;
  structuredData?: Record<string, any>;
  textContent?: string;

  label: string;
  sortOrder: number;
}

interface AgentExecution {
  id: string;
  nodeId: string;
  status: 'pending' | 'running' | 'paused' | 'complete' | 'failed' | 'cancelled';

  // Trace is array of events
  trace: TraceEvent[];

  // Metrics
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number;

  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface TraceEvent {
  eventType: 'llm_call' | 'tool_call' | 'decision' | 'human_input' | 'error';
  timestamp: string;
  durationMs?: number;
  data: Record<string, any>;
}
```

---

## UI Patterns to Consider

### Transparency
- Agent reasoning should be easily accessible (not hidden)
- Show confidence levels where applicable
- Make it easy to see "why" for any output

### Collaboration
- Show presence (who's viewing/editing)
- Lock indicators on nodes being edited
- Real-time updates (content changes as others edit)

### Progressive Disclosure
- Show summary by default, expand for details
- Trace view: collapsed by default, expand to see full reasoning
- Inputs/outputs: show count and types, expand for full content

### Status & Progress
- Clear visual status indicators (color-coded)
- Progress indication for running agents
- Version badges showing edit history

---

## Design References

Consider these products for inspiration:
- **Linear** - Clean, minimal, fast-feeling
- **Notion** - Flexible blocks, good hierarchy
- **Figma** - Canvas interaction, collaboration presence
- **GitHub** - Version history, diff views
- **Retool** - Data-dense but readable

---

## Questions for UI Development

When building components, consider:
1. How does this look with 3 items? 30 items? 300 items?
2. What happens when an agent is running for 5 minutes?
3. How do we show a node with 10 inputs vs 1 input?
4. What does "locked by someone else" look like?
5. How deep can the tree go before it's unusable?
