# GlassBox

Transparent collaborative workspace for human-agent workflows.

GlassBox structures organizational work into composable, auditable **Nodes** - enabling teams to collaborate with AI agents while maintaining full visibility into how work gets done.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Go 1.22+
- Python 3.11+
- Docker & Docker Compose

### Setup

```bash
# Clone and setup
git clone https://github.com/your-org/glassbox.git
cd glassbox

# Run setup script
./scripts/dev-setup.sh
```

### Running Services

```bash
# Start all dependencies (Postgres, Redis, LocalStack)
pnpm docker:up

# Terminal 1: Next.js frontend
cd apps/web && pnpm dev

# Terminal 2: Go API
cd apps/api && go run cmd/api/main.go

# Terminal 3: Python agent worker
cd apps/workers && source .venv/bin/activate && python -m agent.worker
```

### Services

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| LocalStack (S3/SQS) | localhost:4566 |

## Project Structure

```
glassbox/
├── apps/
│   ├── web/           # Next.js frontend
│   ├── api/           # Go API service
│   ├── websocket/     # Go WebSocket service (coming soon)
│   └── workers/       # Python background workers
│       ├── agent/     # LangGraph agent executor
│       ├── rag/       # RAG and embeddings
│       └── file_processor/  # Document extraction
├── packages/
│   ├── shared-types/  # TypeScript types
│   ├── db-schema/     # Database migrations
│   └── proto/         # gRPC definitions
├── infrastructure/    # AWS CDK
├── docker/           # Docker Compose for local dev
└── docs/             # Documentation
    ├── PRD.md        # Product Requirements
    └── TECHNICAL.md  # Technical Implementation
```

## Documentation

- [Product Requirements (PRD)](docs/PRD.md) - What we're building and why
- [Technical Implementation](docs/TECHNICAL.md) - Architecture, tech stack, and implementation details

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TailwindCSS, React Flow |
| API | Go (Gin), PostgreSQL, Redis |
| Workers | Python, LangGraph, LiteLLM |
| Infrastructure | AWS (ECS Fargate, RDS, S3, SQS) |
| IaC | AWS CDK |

## Development

### Database Migrations

```bash
# Run migrations
pnpm db:migrate

# Create new migration
cd packages/db-schema
pnpm migrate:create my_migration
```

### Testing

```bash
# All tests
pnpm test

# Frontend tests
cd apps/web && pnpm test

# Go tests
cd apps/api && go test ./...

# Python tests
cd apps/workers && pytest
```

## License

Proprietary - All rights reserved.
