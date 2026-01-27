# GlassBox Development Changelog

This document logs all significant changes made during development. Each entry includes:
- **Date & Session**: When the change was made
- **Summary**: Brief description of what changed
- **Justification**: Why this change was needed
- **Technical Details**: How it was implemented
- **Files Modified**: List of files touched

---

## [2026-01-26] Add Frontend Context Document

### Summary
Created a standalone context document for frontend development in a separate repo.

### Justification
User plans to develop UI/UX in a separate repo by experimenting with open source components. This document provides all the context needed to understand GlassBox concepts without re-explaining from scratch.

### Technical Details
- Explains the Node primitive (inputs, outputs, evidence)
- Documents node relationships (tree + DAG)
- Lists key UI views needed (tree, canvas, graph, detail, execution)
- Includes TypeScript interfaces for core data structures
- Provides design reference products for inspiration

### Files Modified
- `docs/FRONTEND_CONTEXT.md` - New file created

---

## [2026-01-26] Fix Missing React Query Devtools Dependency

### Summary
Added missing `@tanstack/react-query-devtools` package to web app dependencies.

### Justification
The `providers.tsx` file imports React Query Devtools but the package wasn't listed in `package.json`, causing a build failure on first run.

### Technical Details
- Added `@tanstack/react-query-devtools` version `^5.17.9` to match the main react-query version

### Files Modified
- `apps/web/package.json` - Added missing devtools dependency

---

## [2026-01-26] Initial Repository Scaffolding

### Summary
Complete monorepo structure scaffolded with all core components stubbed out.

### Justification
Establish the foundational architecture based on the PRD and TECHNICAL.md specifications before implementing features. This "skeleton first" approach ensures consistent structure and allows parallel development across services.

### Technical Details

**Monorepo Setup:**
- pnpm workspaces configured for `apps/*` and `packages/*`
- Root package.json with unified scripts for dev, build, test, docker operations

**Go API Service (`apps/api/`):**
- Main entry point with Gin router, middleware chain (auth, CORS, rate limiting, request ID, logging)
- All REST endpoints defined per TECHNICAL.md specification
- Internal package structure: handlers, services, models, middleware, database, config
- Dependencies: Gin, pgx (PostgreSQL), go-redis, AWS SDK, JWT, zap logging
- *Status: Router complete, handlers are stubs*

**Next.js Frontend (`apps/web/`):**
- Next.js 14 with App Router
- Dependencies: React Query, Zustand, React Flow, TailwindCSS
- Basic landing page implemented
- API client and store structure created
- *Status: Structure ready, components are stubs*

**Python Workers (`apps/workers/`):**
- Three worker types: agent, file_processor, rag
- Shared utilities: config, database, SQS consumer
- pyproject.toml for modern Python packaging
- *Status: Job processing skeleton visible, business logic pending*

**Database Schema (`packages/db-schema/`):**
- Complete 517-line SQL migration
- 17 tables: organizations, users, projects, nodes, node_versions, node_inputs, node_outputs, node_dependencies, files, agent_executions, agent_trace_events, templates, audit_log, notifications, org_members, project_members
- pgvector extension for embeddings
- Row-level security policies framework
- Proper indexes and constraints
- *Status: Production-ready*

**Docker Development Environment (`docker/`):**
- docker-compose.yml with PostgreSQL+pgvector, Redis, LocalStack
- Init scripts for database extensions and LocalStack (S3, SQS)
- *Status: Complete*

**Setup Automation (`scripts/`):**
- dev-setup.sh: Validates prerequisites, starts Docker, runs migrations, installs deps, creates .env
- *Status: Complete*

### Files Created
```
glassbox/
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .nvmrc
├── README.md
├── docs/
│   ├── PRD.md
│   └── TECHNICAL.md
├── apps/
│   ├── api/
│   │   ├── go.mod
│   │   ├── cmd/api/main.go
│   │   └── internal/... (config, database, handlers, middleware, models, services)
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── src/... (app, components, hooks, lib, stores)
│   └── workers/
│       ├── pyproject.toml
│       ├── requirements.txt
│       ├── agent/
│       ├── file_processor/
│       ├── rag/
│       └── shared/
├── packages/
│   ├── db-schema/migrations/001_initial_schema.sql
│   ├── shared-types/src/index.ts
│   └── proto/
├── docker/
│   ├── docker-compose.yml
│   ├── init-db.sql
│   └── localstack-init.sh
└── scripts/
    └── dev-setup.sh
```

---

## Change Log Template

Use this template for future entries:

```markdown
## [YYYY-MM-DD] Brief Title

### Summary
One-line description of the change.

### Justification
Why was this change needed? What problem does it solve?

### Technical Details
- Bullet points explaining how it was implemented
- Include any architectural decisions made
- Note any dependencies added or removed

### Files Modified
- `path/to/file1.ts` - Description of change
- `path/to/file2.go` - Description of change

### Related
- Links to relevant docs, issues, or PRs
- References to TECHNICAL.md sections updated
```
