# GlassBox v1 Documentation

Welcome to the GlassBox v1 technical documentation. This folder contains comprehensive documentation for all components of the GlassBox platform.

## Quick Reference

| Component | Technology | Location |
|-----------|------------|----------|
| API Server | Go + Gin | `apps/api/` |
| Agent Worker | Python + LangGraph | `apps/workers/agent/` |
| File Processor | Python | `apps/workers/file_processor/` |
| Database | PostgreSQL + pgvector | `packages/db-schema/` |
| Infrastructure | AWS CDK (TypeScript) | `apps/infrastructure/` |
| Frontend | Next.js 14 | `apps/web/` |

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [API.md](./API.md) | Complete REST API reference (49 endpoints) |
| [DATABASE.md](./DATABASE.md) | Database schema and relationships (16 tables) |
| [WEBSOCKET.md](./WEBSOCKET.md) | WebSocket protocol and real-time features |
| [SERVICES.md](./SERVICES.md) | Go services and Python workers |

### Infrastructure & Operations

| Document | Description |
|----------|-------------|
| [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) | AWS resources and CDK stacks (8 stacks) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture overview |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Step-by-step deployment instructions |

## Platform Overview

GlassBox is a collaborative workspace where humans and AI agents work together on complex tasks. The core primitive is the **Node** - a unit of work with inputs, outputs, and execution history.

### Key Features

- **Node-Based Workflow**: Organize work in hierarchical trees with parent-child relationships
- **AI Agent Execution**: Run LLM-powered agents on nodes with full trace logging
- **Real-Time Collaboration**: WebSocket-based updates for multi-user editing
- **Version History**: Every node change is versioned for rollback capability
- **Distributed Locking**: Redis-backed locks prevent concurrent editing conflicts
- **Vector Search**: pgvector embeddings enable semantic search across files

### Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                    Next.js 14 + React                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (ALB)                      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│      Go API Server      │     │       WebSocket Hub          │
│     (Gin Framework)     │────▶│     (gorilla/websocket)      │
└─────────────────────────┘     └─────────────────────────────┘
              │                               │
              ├───────────────┬───────────────┤
              ▼               ▼               ▼
┌───────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│    PostgreSQL     │ │     Redis     │ │         S3          │
│   (+ pgvector)    │ │   (Cache)     │ │   (File Storage)    │
└───────────────────┘ └───────────────┘ └─────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SQS Queues                            │
│              (agent-jobs, file-processing)                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│     Agent Worker        │     │      File Processor          │
│  (Python + LangGraph)   │     │  (Python + Text Extraction)  │
└─────────────────────────┘     └─────────────────────────────┘
```

### Deployed Environment

| Environment | API Endpoint | Status |
|-------------|--------------|--------|
| Staging | `http://glassbox-staging-1042377516.us-east-1.elb.amazonaws.com` | Active |
| Production | TBD | Planned |

### Running Tests

```bash
# Run E2E tests against staging
./scripts/e2e-tests.sh

# Run with custom API URL
./scripts/e2e-tests.sh --api-url http://localhost:8080

# Verbose mode (shows response bodies on failure)
./scripts/e2e-tests.sh --verbose
```

## Related Documentation

- [PRD.md](../PRD.md) - Product Requirements Document
- [TECHNICAL.md](../TECHNICAL.md) - Technical Specification
- [ROADMAP.md](../ROADMAP.md) - Development Roadmap
- [CHANGELOG.md](../CHANGELOG.md) - Development Changelog
