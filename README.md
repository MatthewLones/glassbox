# GlassBox

**Transparent collaborative workspace for human-agent workflows.**

GlassBox structures organizational work into composable, auditable **Nodes** — enabling teams to collaborate with AI agents while maintaining full visibility into how work gets done.

## The Vision

In a world where AI agents increasingly collaborate with humans, the "black box" problem isn't just about AI — it's about all organizational work. GlassBox makes every piece of work transparent by design.

### The Node Primitive

Everything in GlassBox is built on a single, powerful primitive: **The Node**.

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
│                                                         │
├─────────────────────────────────────────────────────────┤
│  EVIDENCE                                               │
│  ────────                                               │
│  • Agent reasoning logs                                 │
│  • 3 sub-nodes (Data Cleaning, Analysis, Synthesis)     │
│  • Human feedback notes                                 │
└─────────────────────────────────────────────────────────┘
```

**Key Concepts:**
- **Recursive Structure** — Nodes contain sub-nodes, creating natural hierarchies
- **Composable Dependencies** — Outputs from any node can be inputs to any other
- **Dual Authorship** — Human-authored or Agent-authored (with human supervision)
- **Full Version History** — Every change tracked with rollback capability

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14, React, Tailwind, Reactflow | Web application with 4 visualization modes |
| **API** | Go (Gin) | HTTP REST API, high-performance request handling |
| **WebSocket** | Go | Real-time collaboration, presence, locks |
| **Workers** | Python, LangGraph, LiteLLM | Agent execution, RAG, file processing |
| **Database** | PostgreSQL + pgvector | Core data, embeddings, event sourcing |
| **Cache** | Redis | Sessions, pub/sub, rate limiting |
| **Storage** | S3 + CloudFront | Files with CDN delivery |
| **Auth** | AWS Cognito | Managed auth with SSO support |
| **Infrastructure** | AWS CDK | TypeScript IaC for ECS Fargate deployment |

## Project Structure

```
glassbox/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/
│   │   │   │   ├── canvas/    # Reactflow canvas view
│   │   │   │   ├── graph/     # Force-directed graph view
│   │   │   │   ├── grid/      # File explorer grid view
│   │   │   │   ├── tree/      # Hierarchical tree view
│   │   │   │   ├── node/      # Node CRUD components
│   │   │   │   └── ui/        # Shadcn/ui components
│   │   │   ├── hooks/
│   │   │   ├── stores/   # Zustand state
│   │   │   └── lib/      # Utilities, API client
│   │   └── ...
│   ├── api/              # Go API service
│   │   ├── internal/
│   │   │   ├── handlers/ # HTTP handlers
│   │   │   ├── services/ # Business logic
│   │   │   └── middleware/
│   │   └── ...
│   ├── workers/          # Python workers
│   │   ├── agent/        # LangGraph agent executor
│   │   ├── rag/          # Embeddings & search
│   │   ├── file_processor/
│   │   └── shared/       # DB, SQS, config
│   └── infrastructure/   # AWS CDK stacks
├── packages/
│   ├── shared-types/     # TypeScript types
│   ├── db-schema/        # PostgreSQL migrations
│   └── proto/            # gRPC definitions
├── docker/               # Docker Compose for local dev
└── docs/
    ├── PRD.md            # Product requirements
    ├── TECHNICAL.md      # Architecture & implementation
    └── CHANGELOG.md      # Development log
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Go 1.22+
- Python 3.11+
- Docker & Docker Compose

### Setup

```bash
# Clone
git clone https://github.com/your-org/glassbox.git
cd glassbox

# Install dependencies
pnpm install

# Start infrastructure (Postgres, Redis, LocalStack)
docker compose -f docker/docker-compose.yml up -d

# Run migrations
pnpm db:migrate

# Start development
pnpm dev
```

### Local Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js web app |
| API | http://localhost:8080 | Go REST API |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache & pub/sub |
| LocalStack | localhost:4566 | S3/SQS emulation |

### Dev Login

For local development without Cognito:
```
http://localhost:3000/auth/dev-login
```

## Visualization Modes

GlassBox provides 4 ways to view your work:

1. **Tree View** — Hierarchical file-explorer style, expand/collapse nodes
2. **Canvas View** — Figma-like infinite canvas with drag positioning (Reactflow)
3. **Graph View** — Force-directed layout showing all relationships (d3-force)
4. **Grid View** — Notion-style navigation, drill into folders, view evidence

Switch between views with `Cmd+1`, `Cmd+2`, `Cmd+3`, `Cmd+4`.

## Agent Execution

Agents in GlassBox use LangGraph with specialized tools:

- `create_subnode()` — Decompose tasks into sub-tasks
- `request_input()` — Ask human supervisor for clarification
- `add_output()` — Produce deliverables
- `access_node()` — Read from other nodes

Human-in-the-loop controls at organization and node level ensure agents work within defined boundaries.

## API Overview

```
/api/v1/orgs                    # Organizations
/api/v1/orgs/:orgId/projects    # Projects
/api/v1/projects/:projectId/nodes  # Nodes
/api/v1/nodes/:nodeId           # Node CRUD, inputs, outputs
/api/v1/nodes/:nodeId/execute   # Agent execution
/api/v1/orgs/:orgId/search      # Full-text & semantic search
```

See [TECHNICAL.md](docs/TECHNICAL.md) for full API documentation.

## Documentation

- **[PRD.md](docs/PRD.md)** — Product vision, node anatomy, collaboration features
- **[TECHNICAL.md](docs/TECHNICAL.md)** — Architecture, data models, API design
- **[CHANGELOG.md](docs/CHANGELOG.md)** — Development log with all changes

## Development Status

### Backend (Complete)
- Core REST API (Organizations, Projects, Nodes, Files)
- Node versioning with rollback
- Agent execution with HITL
- File processing (PDF, DOCX extraction)
- Search & RAG with pgvector
- WebSocket real-time updates
- AWS CDK infrastructure

### Frontend (In Progress)
- [x] Shadcn/ui component library
- [x] Authentication flow
- [x] Organization & project management
- [x] Tree view with node CRUD
- [x] Node detail panel
- [x] Canvas view (Reactflow)
- [x] Graph view (d3-force)
- [x] Grid view (file explorer)
- [ ] Agent execution UI
- [ ] WebSocket integration
- [ ] Search (Cmd+K)

## License

Proprietary — All rights reserved.
