# GlassBox Development Changelog

This document logs all significant changes made during development. Each entry includes:
- **Date & Session**: When the change was made
- **Summary**: Brief description of what changed
- **Justification**: Why this change was needed
- **Technical Details**: How it was implemented
- **Files Modified**: List of files touched

---

## [2026-01-27] Complete Phase 4: File Handling

### Summary
Implemented complete file upload/download flow with S3 presigned URLs, file metadata tracking, and SQS job dispatch for file processing.

### Justification
Phase 4 enables file attachments for nodes. Users can upload documents (PDFs, DOCXs, images) that will be processed for text extraction and embeddings in later phases.

### Technical Details

**S3 Client (`internal/storage/s3.go`):**
- AWS SDK v2 integration with LocalStack support for development
- `PresignedUploadURL`: Generates presigned PUT URLs with content-type (15 min expiration)
- `PresignedDownloadURL`: Generates presigned GET URLs (1 hour expiration)
- `HeadObject`: Verifies file existence and returns size
- `DeleteObject`: Removes file from S3

**SQS Client (`internal/queue/sqs.go`):**
- AWS SDK v2 integration with LocalStack support
- `DispatchFileProcessingJob`: Sends job to file processing queue
- `DispatchAgentJob`: Sends job to agent execution queue (for Phase 5)
- Message attributes for job type routing

**FileService (`services.go`):**
- `GetUploadURL`: Creates file record (pending status) and returns presigned URL
- `ConfirmUpload`: Verifies S3 upload, updates status, dispatches processing job
- `GetByID`: Returns file metadata with download URL
- `Delete`: Removes from both S3 and database
- Org membership validation for access control

**File Handlers (`handlers.go`):**
- `POST /api/v1/orgs/:orgId/files/upload` - Returns fileId and presigned upload URL
- `POST /api/v1/files/:fileId/confirm` - Confirms upload and triggers processing
- `GET /api/v1/files/:fileId` - Returns metadata with download URL
- `DELETE /api/v1/files/:fileId` - Deletes file

### Files Modified
- `apps/api/internal/storage/s3.go` - New S3 client wrapper
- `apps/api/internal/queue/sqs.go` - New SQS client wrapper
- `apps/api/internal/services/services.go` - Added FileService methods
- `apps/api/internal/handlers/handlers.go` - Implemented file handlers
- `apps/api/cmd/api/main.go` - Initialize S3 and SQS clients
- `apps/api/go.mod` - Added AWS SDK v2 dependencies
- `docs/ROADMAP.md` - Marked Phase 4 complete
- `docs/CHANGELOG.md` - Added this entry

### API Endpoints Implemented
**Files:**
- `POST /api/v1/orgs/:orgId/files/upload` - Get presigned upload URL
- `POST /api/v1/files/:fileId/confirm` - Confirm upload complete
- `GET /api/v1/files/:fileId` - Get file metadata + download URL
- `DELETE /api/v1/files/:fileId` - Delete file

### Verification
Tested complete flow with curl:
1. Request upload URL → Returns fileId and presigned S3 URL ✓
2. Upload file to S3 → File stored in LocalStack S3 ✓
3. Confirm upload → Status changes to "uploaded", size populated ✓
4. Get file → Returns metadata with download URL ✓
5. Delete file → HTTP 204, file removed from S3 and DB ✓
6. Verify SQS → Job message dispatched to file-processing queue ✓

---

## [2026-01-27] Complete Phase 3: Core API - Projects & Nodes

### Summary
Implemented full CRUD for Projects and Nodes, including inputs/outputs, versioning, relationships, and distributed locking.

### Justification
Phase 3 delivers the core data primitives of GlassBox. Nodes are the fundamental unit of work, and this phase enables creating, editing, versioning, and organizing them with proper access control.

### Technical Details

**Project Service (services.go):**
- `ListByOrg`: Returns all projects in an org (with membership check)
- `GetByID`: Returns project if user has org access
- `Create`: Creates project with default workflow states
- `Update`: Updates project name, description, settings, workflow states
- `Delete`: Requires admin/owner role, cascades to nodes

**Node Service (services.go):**
- `ListByProject`: Returns nodes with optional filters (status, authorType, parentId)
- `GetByID`: Returns node with populated inputs and outputs
- `Create`: Creates node with position, metadata, author tracking
- `Update`: Updates node and auto-creates version snapshot in transaction
- `Delete`: Soft-delete (sets deleted_at)

**Node Inputs/Outputs:**
- `AddInput`: Add file, node reference, URL, or text input
- `RemoveInput`: Remove input by ID
- `AddOutput`: Add file, structured data, text, or URL output
- `RemoveOutput`: Remove output by ID
- Auto-incrementing sort_order for ordering

**Node Versioning:**
- `ListVersions`: Get version history for a node
- `GetVersion`: Get specific version snapshot
- `Rollback`: Restore node to previous version (creates rollback version first)
- Auto-version on every update (stores full snapshot as JSONB)

**Node Relationships:**
- `ListChildren`: Get child nodes via parent_id
- `ListDependencies`: Get nodes this node depends on via source_node_id in inputs

**Node Locking (Redis + DB):**
- `AcquireLock`: Distributed lock with Redis SETNX + DB persistence
- `ReleaseLock`: Release lock from both Redis and DB
- 5-minute lock expiration with automatic extension on re-acquire
- Returns 409 Conflict when locked by another user

**Handlers (handlers.go):**
- All 17 node endpoints implemented with proper error handling
- Query parameter binding for list filters
- Version number parsing from URL params
- Consistent error responses (400, 401, 403, 404, 409, 500)

### Files Modified
- `apps/api/internal/services/services.go` - Added ProjectService, NodeService with all methods
- `apps/api/internal/handlers/handlers.go` - Implemented all project and node handlers
- `docs/ROADMAP.md` - Marked Phase 3 complete
- `docs/CHANGELOG.md` - Added this entry

### API Endpoints Implemented
**Projects:**
- `GET /api/v1/orgs/:orgId/projects` - List projects
- `POST /api/v1/orgs/:orgId/projects` - Create project
- `GET /api/v1/projects/:projectId` - Get project
- `PATCH /api/v1/projects/:projectId` - Update project
- `DELETE /api/v1/projects/:projectId` - Delete project

**Nodes:**
- `GET /api/v1/projects/:projectId/nodes` - List nodes
- `POST /api/v1/projects/:projectId/nodes` - Create node
- `GET /api/v1/nodes/:nodeId` - Get node
- `PATCH /api/v1/nodes/:nodeId` - Update node
- `DELETE /api/v1/nodes/:nodeId` - Delete node

**Node Inputs/Outputs:**
- `POST /api/v1/nodes/:nodeId/inputs` - Add input
- `DELETE /api/v1/nodes/:nodeId/inputs/:inputId` - Remove input
- `POST /api/v1/nodes/:nodeId/outputs` - Add output
- `DELETE /api/v1/nodes/:nodeId/outputs/:outputId` - Remove output

**Node Versioning:**
- `GET /api/v1/nodes/:nodeId/versions` - List versions
- `GET /api/v1/nodes/:nodeId/versions/:version` - Get version
- `POST /api/v1/nodes/:nodeId/rollback/:version` - Rollback

**Node Relationships:**
- `GET /api/v1/nodes/:nodeId/children` - List children
- `GET /api/v1/nodes/:nodeId/dependencies` - List dependencies

**Node Locking:**
- `POST /api/v1/nodes/:nodeId/lock` - Acquire lock
- `DELETE /api/v1/nodes/:nodeId/lock` - Release lock

---

## [2026-01-27] Complete Phase 2: Core API - Organizations & Users

### Summary
Implemented authentication, organization CRUD, and user endpoints with full database integration.

### Justification
Phase 2 provides the foundation for multi-tenant access control. Users can now authenticate with JWT tokens, manage organizations, and retrieve their profile.

### Technical Details

**Authentication:**
- Dev-mode JWT generation endpoint (`POST /api/v1/auth/dev-token`)
- JWT validation middleware extracts user context
- Helper functions to get user ID as UUID from context

**Organization Service (services.go):**
- `ListByUser`: Returns orgs where user is a member
- `GetByID`: Returns org if user has access
- `Create`: Creates org + adds creator as owner in transaction
- `Update`: Updates org (requires admin/owner role)
- `Delete`: Deletes org (requires owner role)
- `GetUserRole`: Gets user's role in an org

**User Service (services.go):**
- `GetByID`: Returns user by ID
- `Update`: Updates user profile/settings
- `ListNotifications`: Returns user's notifications
- `MarkNotificationRead`: Marks notification as read

**Organization Handlers (handlers.go):**
- Full CRUD with proper error handling (404, 403)
- UUID parsing from route params
- JSON request binding

**User Handlers (handlers.go):**
- GetMe, UpdateMe, ListNotifications, MarkNotificationRead
- Query param support (unread=true filter)

### Files Modified
- `apps/api/internal/services/services.go` - Added AuthService, OrganizationService, UserService methods
- `apps/api/internal/handlers/handlers.go` - Implemented org and user handlers
- `apps/api/cmd/api/main.go` - Added dev-token route
- `docs/ROADMAP.md` - Marked Phase 2 complete

### Verification
All endpoints tested with curl:
- Health check: `GET /health` ✓
- Generate token: `POST /api/v1/auth/dev-token` ✓
- List orgs: `GET /api/v1/orgs` ✓
- Create org: `POST /api/v1/orgs` ✓
- Get org: `GET /api/v1/orgs/:orgId` ✓
- Update org: `PATCH /api/v1/orgs/:orgId` ✓
- Delete org: `DELETE /api/v1/orgs/:orgId` ✓
- Get user: `GET /api/v1/users/me` ✓

---

## [2026-01-27] Complete Phase 1: Foundation

### Summary
Verified all local development infrastructure works correctly and created seed data.

### Justification
Phase 1 establishes the foundation for all subsequent development. Without working database, cache, and queue connections, no other work can proceed.

### Technical Details

**Docker Containers:**
- PostgreSQL 16 with pgvector extension running on :5432
- Redis 7 running on :6379
- LocalStack running on :4566 (S3, SQS)

**Database:**
- All 16 tables created via migration
- Extensions installed: uuid-ossp, pgcrypto, pgvector
- Created seed data script with test org, users, project, nodes

**Seed Data Created:**
- 1 organization (Acme Corp)
- 2 users (Alice, Bob)
- 1 project (Q1 Planning)
- 4 nodes (hierarchical structure with parent-child)
- Sample inputs, outputs, versions, dependencies
- 1 running agent execution with trace events
- 2 templates (system + org-specific)

**LocalStack Resources:**
- S3 bucket: `glassbox-files-dev`
- SQS queues: agent-jobs, file-processing, notifications + DLQs

**Bug Fixes:**
- Fixed pgx transaction type mismatch (pgx.Tx vs pgxpool.Tx)
- Fixed seed script column name (trace → trace_summary)

### Files Modified
- `packages/db-schema/seeds/001_dev_seed.sql` - New seed data script
- `apps/api/internal/database/postgres.go` - Fixed transaction type
- `docs/ROADMAP.md` - Marked Phase 1 complete

---

## [2026-01-26] Create Master Roadmap

### Summary
Created comprehensive backend development roadmap with 10 phases and 100+ tasks.

### Justification
Need a formal, persistent todo list to track all backend development work. This lives in the repo and can be checked off as work is completed.

### Technical Details
- 10 development phases from Foundation to Testing
- Each phase has specific tasks with checkboxes
- Includes verification criteria for each phase
- Quick reference section for common commands and file locations
- Progress tracking instructions

### Files Modified
- `docs/ROADMAP.md` - New master roadmap created

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
