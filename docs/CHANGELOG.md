# GlassBox Development Changelog

This document logs all significant changes made during development. Each entry includes:
- **Date & Session**: When the change was made
- **Summary**: Brief description of what changed
- **Justification**: Why this change was needed
- **Technical Details**: How it was implemented
- **Files Modified**: List of files touched

---

## [2026-01-28] Phase 9: Infrastructure & Deployment

### Summary
Implemented complete AWS infrastructure using CDK, Docker containerization for all services, and CI/CD pipelines with GitHub Actions for automated testing and deployment.

### Justification
Phase 9 provides the infrastructure foundation needed to deploy GlassBox to AWS. This includes all necessary cloud resources (VPC, databases, caches, compute), containerization for portable deployments, and CI/CD automation for reliable releases.

### Technical Details

**AWS CDK Infrastructure (`apps/infrastructure/`):**
- Network Stack: VPC with public/private/isolated subnets, NAT gateway, security groups
- Database Stack: RDS PostgreSQL with pgvector extension, automated backups, multi-AZ support for production
- Cache Stack: ElastiCache Redis for session cache, rate limiting, pub/sub
- Storage Stack: S3 bucket for file storage, CloudFront CDN distribution
- Messaging Stack: SQS queues for agent and file processing with DLQs
- Auth Stack: Cognito user pool with email/password and social auth
- Compute Stack: ECS Fargate cluster with API, agent worker, and file worker services, ALB, auto-scaling
- Monitoring Stack: CloudWatch dashboard and alarms for all services

**Docker Configuration:**
- `apps/api/Dockerfile`: Multi-stage Go build with alpine runtime
- `apps/workers/Dockerfile`: Python 3.12 slim image with dual worker support
- `docker/docker-compose.full.yml`: Full-stack local development with API and workers

**CI/CD Workflows (`.github/workflows/`):**
- `ci.yml`: Comprehensive CI pipeline with Go lint/test/build, Python lint/test, CDK synth, Docker builds
- `deploy.yml`: Automated deployment to staging on merge, manual production deployments
- `infra-diff.yml`: Infrastructure diff comments on PRs that change CDK code

**Environment Configurations:**
- `apps/infrastructure/config/staging.ts`: Cost-optimized staging environment
- `apps/infrastructure/config/production.ts`: High-availability production environment

### Files Created
- `apps/api/Dockerfile` - Multi-stage Go API build
- `apps/workers/Dockerfile` - Python workers image
- `docker/docker-compose.full.yml` - Full-stack docker-compose
- `apps/infrastructure/package.json` - CDK dependencies
- `apps/infrastructure/tsconfig.json` - TypeScript configuration
- `apps/infrastructure/cdk.json` - CDK app configuration
- `apps/infrastructure/bin/glassbox.ts` - CDK entry point
- `apps/infrastructure/lib/network-stack.ts` - VPC and security groups
- `apps/infrastructure/lib/database-stack.ts` - RDS PostgreSQL
- `apps/infrastructure/lib/cache-stack.ts` - ElastiCache Redis
- `apps/infrastructure/lib/storage-stack.ts` - S3 and CloudFront
- `apps/infrastructure/lib/messaging-stack.ts` - SQS queues
- `apps/infrastructure/lib/auth-stack.ts` - Cognito
- `apps/infrastructure/lib/compute-stack.ts` - ECS Fargate
- `apps/infrastructure/lib/monitoring-stack.ts` - CloudWatch dashboard
- `apps/infrastructure/config/staging.ts` - Staging configuration
- `apps/infrastructure/config/production.ts` - Production configuration
- `apps/infrastructure/config/index.ts` - Config loader
- `.github/workflows/ci.yml` - CI workflow
- `.github/workflows/deploy.yml` - Deploy workflow
- `.github/workflows/infra-diff.yml` - Infrastructure diff workflow

### Files Modified
- `docs/ROADMAP.md` - Marked Phase 9 complete
- `docs/CHANGELOG.md` - Added this entry

### Deployment Requirements
To deploy to AWS:
1. Configure AWS credentials with appropriate permissions
2. Set up GitHub secrets: `AWS_DEPLOY_ROLE_ARN`, `AWS_ACCOUNT_ID`, `SLACK_WEBHOOK_URL` (optional)
3. Run `npx cdk bootstrap` for first-time CDK setup
4. Run `npx cdk deploy --all --context environment=staging`

---

## [2026-01-28] Phase 8: Real-Time WebSocket

### Summary
Implemented complete WebSocket server for real-time collaboration features including connection management, authentication, subscriptions, presence tracking, and Redis pub/sub for multi-instance support.

### Justification
Real-time collaboration is a core feature of GlassBox - users need to see live updates when nodes are created/edited by teammates, track who's viewing what, and receive execution status updates as they happen. WebSocket infrastructure enables Figma/Google Docs-style collaboration.

### Technical Details

**WebSocket Package (`apps/api/internal/websocket/`):**
- `messages.go` - Message types for client/server communication:
  - Client messages: subscribe, unsubscribe, presence, lock_acquire, lock_release, ping
  - Server messages: subscribed, node_updated, presence_update, execution_update, etc.
- `hub.go` - Central hub for connection management:
  - Client registration/unregistration
  - Channel-based subscriptions (project:uuid, node:uuid)
  - Presence tracking per node
  - Redis pub/sub integration for multi-instance broadcasting
- `client.go` - WebSocket client handler:
  - Read/write pumps with ping/pong for keepalive
  - Message parsing and routing
  - Subscription and presence handling
- `handler.go` - HTTP upgrade handler for WebSocket connections
- `broadcaster.go` - Interface for broadcasting events:
  - BroadcastNodeCreated/Updated/Deleted
  - BroadcastLockAcquired/Released
  - BroadcastExecutionUpdate

**Authentication (`apps/api/internal/services/services.go`):**
- `GenerateWSToken` - Creates short-lived (5 min) JWT for WebSocket auth
- `ValidateWSToken` - Validates token and marks as used (one-time use via Redis)

**Routes:**
- `POST /api/v1/auth/ws-token` - Exchange JWT for WebSocket token
- `GET /ws?token=<ws_token>` - WebSocket upgrade endpoint

**Message Protocol:**
```json
// Client -> Server
{"type": "subscribe", "payload": {"channel": "project:uuid"}, "requestId": "123"}
{"type": "presence", "payload": {"nodeId": "uuid", "action": "editing"}}
{"type": "ping", "requestId": "456"}

// Server -> Client
{"type": "subscribed", "payload": {"channel": "project:uuid", "users": ["a@b.com"]}}
{"type": "node_updated", "payload": {"nodeId": "uuid", "title": "...", "updatedBy": "..."}}
{"type": "pong", "requestId": "456"}
```

### Files Created
- `apps/api/internal/websocket/messages.go` - Message types and serialization
- `apps/api/internal/websocket/hub.go` - Connection hub and channel management
- `apps/api/internal/websocket/client.go` - WebSocket client handling
- `apps/api/internal/websocket/handler.go` - HTTP upgrade handler
- `apps/api/internal/websocket/broadcaster.go` - Event broadcasting interface

### Files Modified
- `apps/api/internal/services/services.go` - Added WSToken methods to AuthService
- `apps/api/internal/handlers/handlers.go` - Implemented GetWSToken handler
- `apps/api/cmd/api/main.go` - Added WebSocket hub initialization and /ws route
- `apps/api/go.mod` - Added gorilla/websocket dependency
- `docs/ROADMAP.md` - Marked Phase 8 complete
- `docs/CHANGELOG.md` - Added this entry

### Verification
WebSocket test passed:
1. Get dev token -> Get WS token (5 min TTL)
2. Connect to ws://localhost:8080/ws?token=...
3. Send ping -> Receive pong
4. Subscribe to project channel -> Receive confirmation with user list

---

## [2026-01-28] Phase 6 & 7: File Processing & Search API

### Summary
Implemented file processing worker with text extraction (PDF, DOCX, plain text) and complete Search API with text search, semantic search foundation, and node context for RAG.

### Justification
Phase 6 enables extracting searchable content from uploaded files, which is essential for RAG. Phase 7 provides the search infrastructure to find relevant nodes and files based on user queries, enabling intelligent retrieval for the agent system.

### Technical Details

**File Processing Worker (`apps/workers/file_processor/worker.py`):**
- Text extraction for PDF files using pypdf
- Text extraction for DOCX files using python-docx
- Plain text file handling
- S3 download integration for processing
- Embedding generation with LiteLLM (requires OpenAI key)
- pgvector storage format for embeddings

**Search Service (`apps/api/internal/services/search.go`):**
- `TextSearch`: ILIKE-based search on node titles, descriptions, and file content
- `SemanticSearch`: pgvector cosine similarity search with threshold filtering
- `GetNodeContext`: Returns full context for a node including:
  - Node summary (id, title, description, status, author)
  - Inputs with file content
  - Outputs with structured data and files
  - Parent chain for hierarchical context
  - Sibling nodes for related context

**Search Handlers (`apps/api/internal/handlers/handlers.go`):**
- `POST /api/v1/orgs/:orgId/search` - Text search across nodes and files
- `POST /api/v1/orgs/:orgId/search/semantic` - Semantic search (returns 503 until embedding provider configured)
- `GET /api/v1/nodes/:nodeId/context` - Get node context for RAG

**New Models (`apps/api/internal/models/models.go`):**
- `NodeSummary` - Lightweight node representation
- `ContextInput` - Input content for RAG context
- `ContextOutput` - Output content for RAG context
- `NodeContext` - Complete context bundle for RAG

### Files Modified
- `apps/workers/file_processor/worker.py` - Complete text extraction implementation
- `apps/workers/requirements.txt` - Added pypdf, python-docx, aiofiles
- `apps/api/internal/services/search.go` - New SearchService implementation
- `apps/api/internal/services/services.go` - Removed unused import
- `apps/api/internal/handlers/handlers.go` - Implemented search handlers
- `apps/api/internal/models/models.go` - Added RAG context models
- `apps/api/cmd/api/main.go` - Added node context route
- `docs/ROADMAP.md` - Marked Phase 6 & 7 complete
- `docs/CHANGELOG.md` - Added this entry

### API Endpoints Implemented
- `POST /api/v1/orgs/:orgId/search` - Text search nodes and files
- `POST /api/v1/orgs/:orgId/search/semantic` - Semantic search
- `GET /api/v1/nodes/:nodeId/context` - Get node context for RAG

### Verification
Text search tested successfully:
- Search for "Market" returns 2 nodes (Marketing Materials Development, Market Research)
- Search for "analysis" returns 9 results (nodes + files)
- Filters working (status, project, author)
- Pagination working (limit, offset)

Node context tested:
- Returns node summary with inputs, outputs, parent chain, siblings
- File references properly included

---

## [2026-01-28] Phase 5 S3-First Outputs & End-to-End Testing

### Summary
Added S3-first storage for all agent outputs and completed successful end-to-end execution test with Claude Sonnet 4.

### Justification
All agent outputs (text, structured data, files) must be stored in S3 for auditability, compliance, and preventing database bloat. Tested full execution flow to verify all Phase 5 functionality works together.

### Technical Details

**S3 Client Module (`shared/s3.py`):**
- Async S3 client using aioboto3
- `upload()`, `download()`, `download_json()`, `get_presigned_url()`, `delete()`, `exists()`
- Helper functions: `generate_output_key()`, `generate_file_key()`
- Standardized S3 key format: `outputs/{org_id}/{execution_id}/{timestamp}_{type}_{uuid}.{ext}`

**Agent Executor S3 Integration:**
- All outputs now uploaded to S3 before creating database records
- Creates `files` record with storage_key pointing to S3
- Links `node_outputs` to files via file_id foreign key
- Full metadata tracking (execution_id, node_id, output_type, label)

**Database Connection Fix:**
- Added `search_path` initialization to include `glassbox` schema
- Fixed SQL type inference issue in `_update_status` method

**End-to-End Test Results (Claude claude-sonnet-4-20250514):**
- Duration: 46.4 seconds
- Tokens: 13,683 in / 2,422 out (7 LLM iterations)
- Created 4 subnodes (task decomposition working)
- Generated 2 structured outputs stored in S3 (~4.8KB total)
- 22 trace events logged with full audit trail
- Execution completed successfully with all evidence tracked

### Files Modified
- `apps/workers/shared/s3.py` - New S3 client module
- `apps/workers/shared/__init__.py` - Export S3 client
- `apps/workers/shared/db.py` - Added search_path init
- `apps/workers/shared/config.py` - Changed default model to anthropic/claude-sonnet-4-20250514
- `apps/workers/agent/executor.py` - S3 output storage, fixed _update_status, added user message for Anthropic
- `apps/workers/agent/worker.py` - Pass org_id to executor
- `apps/workers/requirements.txt` - New Python dependencies file
- `apps/workers/test_full_execution.py` - Comprehensive test script

---

## [2026-01-28] Complete Phase 5: Agent Execution

### Summary
Implemented complete agent execution system with pause/resume, cancellation, human-in-the-loop (HITL), and state checkpointing.

### Justification
Phase 5 is the core feature of GlassBox - the ability to run AI agents on nodes. This enables users to start agent executions, pause/resume them, provide human input when requested, and track the full execution trace.

### Technical Details

**ExecutionService (`services/execution.go`):**
- `Start`: Creates execution record, dispatches SQS job to agent worker
- `GetByID`: Returns execution with HITL fields extracted from checkpoint
- `GetCurrentForNode`: Returns active execution for a node
- `Pause`: Sets status to 'paused', worker checkpoints on next iteration
- `Resume`: Sets status to 'running', re-dispatches SQS job
- `Cancel`: Sets status to 'cancelled'
- `ProvideInput`: Stores human input in checkpoint, resumes execution
- `GetTrace`: Returns all trace events for an execution

**ExecutionHandler (`handlers/handlers.go`):**
- All 8 endpoints implemented with proper error handling
- New HITL endpoint: `POST /executions/:executionId/input`
- Returns execution with humanInputRequest when awaiting input

**Python Worker (`workers/agent/executor.py`):**
- Status polling before each iteration (checks for pause/cancel)
- Checkpointing after each iteration for crash recovery
- HITL support with `awaiting_input` status
- Resume from checkpoint on re-dispatch
- Human input injected into conversation as user message

**State Machine:**
```
pending → running → complete
              ↓
           paused → running (resume)
              ↓
         cancelled

running → awaiting_input → running (after input provided)
```

### Files Modified
- `apps/api/internal/services/execution.go` - New ExecutionServiceFull implementation
- `apps/api/internal/services/services.go` - Updated Services struct and SQS interface
- `apps/api/internal/handlers/handlers.go` - Implemented execution handlers
- `apps/api/internal/queue/sqs.go` - Updated DispatchAgentJob to accept any
- `apps/api/cmd/api/main.go` - Added HITL input route
- `apps/workers/agent/executor.py` - Added status polling, checkpointing, HITL
- `apps/workers/agent/worker.py` - Fixed camelCase field handling
- `docs/ROADMAP.md` - Marked Phase 5 complete
- `docs/CHANGELOG.md` - Added this entry

### API Endpoints Implemented
**Node Execution Control:**
- `POST /api/v1/nodes/:nodeId/execute` - Start execution
- `GET /api/v1/nodes/:nodeId/execution` - Get current execution
- `POST /api/v1/nodes/:nodeId/execution/pause` - Pause execution
- `POST /api/v1/nodes/:nodeId/execution/resume` - Resume execution
- `POST /api/v1/nodes/:nodeId/execution/cancel` - Cancel execution

**Execution Details:**
- `GET /api/v1/executions/:executionId` - Get execution by ID
- `GET /api/v1/executions/:executionId/trace` - Get full trace events
- `POST /api/v1/executions/:executionId/input` - Provide human input (HITL)

### Verification
Integration test flow:
1. Start execution → Status = 'pending', job dispatched to SQS
2. Worker picks up job → Status = 'running', trace events logged
3. Request pause → Status = 'paused', checkpoint saved
4. Resume → Status = 'running', worker continues from checkpoint
5. Cancel → Status = 'cancelled', worker exits cleanly
6. HITL: Agent requests input → Status = 'awaiting_input'
7. Provide input via API → Status = 'running', input added to conversation

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
