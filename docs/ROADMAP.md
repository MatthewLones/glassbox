# GlassBox Backend Roadmap

This is the master todo list for backend development. Check items off as they're completed.

**Last Updated:** 2026-01-28

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| Database Schema | **Complete** | 16 tables, indexes, RLS ready |
| Go API | **Phase 8 Complete** | Auth, Orgs, Users, Projects, Nodes, Files, Executions, Search, WebSocket implemented |
| Python Workers | **Phase 6 Complete** | Agent worker + File processor with text extraction |
| WebSocket | **Phase 8 Complete** | Hub, subscriptions, presence, Redis pub/sub |
| Infrastructure | **Phase 9 Complete** | AWS CDK, Docker, CI/CD, Environment configs |

---

## Phase 1: Foundation ✅ COMPLETE

**Goal:** Verify local dev environment works end-to-end.

- [x] Start Docker containers (Postgres, Redis, LocalStack)
- [x] Run database migrations successfully
- [x] Create seed data script for development
- [x] Verify Go API can connect to Postgres
- [x] Verify Go API can connect to Redis
- [x] Test LocalStack S3/SQS connectivity

**Verification:** `curl localhost:8080/health` returns OK with DB status.

---

## Phase 2: Core API - Organizations & Users ✅ COMPLETE

**Goal:** Basic tenant management and authentication.

### 2.1 Authentication
- [x] Dev-mode JWT generation (bypass Cognito for local dev)
- [x] JWT validation middleware
- [x] User context extraction from token
- [x] RLS context setting per request

### 2.2 Organization Handlers
- [x] `GET /api/v1/orgs` - List user's organizations
- [x] `POST /api/v1/orgs` - Create organization
- [x] `GET /api/v1/orgs/:orgId` - Get organization details
- [x] `PATCH /api/v1/orgs/:orgId` - Update organization
- [x] `DELETE /api/v1/orgs/:orgId` - Delete organization

### 2.3 User Handlers
- [x] `GET /api/v1/users/me` - Get current user
- [x] `PATCH /api/v1/users/me` - Update current user
- [x] `GET /api/v1/users/me/notifications` - List notifications

### 2.4 Service Layer
- [x] OrganizationService with DB queries
- [x] UserService with DB queries
- [x] Request validation helpers

**Verification:** Create org via API, retrieve it, verify in database. ✅ Tested with curl.

---

## Phase 3: Core API - Projects & Nodes ✅ COMPLETE

**Goal:** Full CRUD for the core Node primitive.

### 3.1 Project Handlers
- [x] `GET /api/v1/orgs/:orgId/projects` - List projects
- [x] `POST /api/v1/orgs/:orgId/projects` - Create project
- [x] `GET /api/v1/projects/:projectId` - Get project
- [x] `PATCH /api/v1/projects/:projectId` - Update project
- [x] `DELETE /api/v1/projects/:projectId` - Delete project

### 3.2 Node CRUD Handlers
- [x] `GET /api/v1/projects/:projectId/nodes` - List nodes (with filters)
- [x] `POST /api/v1/projects/:projectId/nodes` - Create node
- [x] `GET /api/v1/nodes/:nodeId` - Get node with inputs/outputs
- [x] `PATCH /api/v1/nodes/:nodeId` - Update node
- [x] `DELETE /api/v1/nodes/:nodeId` - Soft delete node

### 3.3 Node Inputs/Outputs
- [x] `POST /api/v1/nodes/:nodeId/inputs` - Add input
- [x] `DELETE /api/v1/nodes/:nodeId/inputs/:inputId` - Remove input
- [x] `POST /api/v1/nodes/:nodeId/outputs` - Add output
- [x] `DELETE /api/v1/nodes/:nodeId/outputs/:outputId` - Remove output

### 3.4 Node Versioning
- [x] `GET /api/v1/nodes/:nodeId/versions` - Get version history
- [x] `GET /api/v1/nodes/:nodeId/versions/:v` - Get specific version
- [x] `POST /api/v1/nodes/:nodeId/rollback/:v` - Rollback to version
- [x] Auto-create version on node update

### 3.5 Node Relationships
- [x] `GET /api/v1/nodes/:nodeId/children` - Get child nodes
- [x] `GET /api/v1/nodes/:nodeId/dependencies` - Get dependency graph
- [x] Parent-child tree queries
- [x] DAG dependency queries

### 3.6 Node Locking
- [x] `POST /api/v1/nodes/:nodeId/lock` - Acquire lock
- [x] `DELETE /api/v1/nodes/:nodeId/lock` - Release lock
- [x] Lock expiration handling (5 minute TTL)
- [x] Lock conflict responses (409 Conflict)

### 3.7 Service Layer
- [x] ProjectService with DB queries
- [x] NodeService with complex queries
- [x] Version management logic
- [x] Lock management with Redis

**Verification:** Create node with inputs/outputs, update it, verify version history.

---

## Phase 4: File Handling ✅ COMPLETE

**Goal:** Upload files to S3, track metadata, dispatch processing jobs.

### 4.1 S3 Integration
- [x] S3 client configuration (LocalStack for dev)
- [x] Presigned URL generation for uploads
- [x] Presigned URL generation for downloads

### 4.2 File Handlers
- [x] `POST /api/v1/orgs/:orgId/files/upload` - Get presigned upload URL
- [x] `POST /api/v1/files/:fileId/confirm` - Confirm upload complete
- [x] `GET /api/v1/files/:fileId` - Get file metadata + download URL
- [x] `DELETE /api/v1/files/:fileId` - Delete file

### 4.3 Job Dispatch
- [x] SQS client configuration (LocalStack for dev)
- [x] Dispatch file processing job on upload confirm
- [x] Job message format definition

### 4.4 Service Layer
- [x] FileService with DB queries
- [x] S3 operations wrapper
- [x] SQS producer wrapper

**Verification:** Upload file via presigned URL, confirm, see processing job in queue. ✅ Tested with curl.

---

## Phase 5: Agent Execution ✅ COMPLETE

**Goal:** Trigger and manage agent runs from API.

### 5.1 Execution Handlers
- [x] `POST /api/v1/nodes/:nodeId/execute` - Start agent execution
- [x] `GET /api/v1/nodes/:nodeId/execution` - Get current execution status
- [x] `POST /api/v1/nodes/:nodeId/execution/pause` - Pause execution
- [x] `POST /api/v1/nodes/:nodeId/execution/resume` - Resume execution
- [x] `POST /api/v1/nodes/:nodeId/execution/cancel` - Cancel execution
- [x] `GET /api/v1/executions/:executionId` - Get execution details
- [x] `GET /api/v1/executions/:executionId/trace` - Get full trace
- [x] `POST /api/v1/executions/:executionId/input` - Provide human input (HITL)

### 5.2 Job Dispatch
- [x] Create agent_execution record
- [x] Dispatch job to agent queue
- [x] Job message format (executionId, nodeId, orgId, orgConfig)

### 5.3 Agent Worker Integration
- [x] Worker picks up jobs from SQS
- [x] Status updates write to DB (running, complete, failed, cancelled)
- [x] Trace events logged to agent_trace_events
- [x] Human-in-the-loop with awaiting_input status
- [x] Checkpointing for pause/resume
- [x] Status polling before each iteration

### 5.4 Service Layer
- [x] ExecutionService with DB queries
- [x] Status update handling
- [x] Cost tracking (tokens in/out)

**Verification:** Start execution, see agent process it, retrieve trace.

---

## Phase 6: File Processing Worker ✅ COMPLETE

**Goal:** Extract text from files, generate embeddings.

### 6.1 Text Extraction
- [x] PDF text extraction (using pypdf)
- [x] DOCX text extraction (using python-docx)
- [x] Plain text file handling
- [ ] Image OCR (optional - deferred for future)

### 6.2 Embedding Generation
- [x] Chunk long documents appropriately
- [x] Generate embeddings via LiteLLM (requires OpenAI key)
- [x] Store embeddings in pgvector column

### 6.3 Worker Integration
- [x] Download file from S3
- [x] Process and extract text
- [x] Generate and store embeddings
- [x] Update file status in DB
- [x] Error handling and retries

**Verification:** Upload text file, see extracted text in database. ✅ Tested successfully.

---

## Phase 7: Search & RAG ✅ COMPLETE

**Goal:** Enable finding nodes and content.

### 7.1 Search Handlers
- [x] `POST /api/v1/orgs/:orgId/search` - Text search nodes, files
- [x] `POST /api/v1/orgs/:orgId/search/semantic` - Semantic search (needs embedding provider)
- [x] `GET /api/v1/nodes/:nodeId/context` - Get node context for RAG

### 7.2 Text Search
- [x] Full-text search on node titles/content (ILIKE pattern matching)
- [x] Filter by project, status, author
- [x] Pagination and sorting
- [x] Search across files with extracted text

### 7.3 Semantic Search
- [x] pgvector similarity search implementation
- [x] Combine with metadata filters
- [x] Return relevant nodes/files with similarity scores
- [ ] Query embedding generation (requires OPENAI_API_KEY)

### 7.4 Service Layer
- [x] SearchService with query building
- [x] Result ranking and formatting
- [x] GetNodeContext for RAG (inputs, outputs, parent chain, siblings)

**Verification:** Text search returns relevant nodes and files. ✅ Tested successfully.

---

## Phase 8: Real-Time (WebSocket) ✅ COMPLETE

**Goal:** Live updates for collaboration.

### 8.1 WebSocket Server
- [x] Go WebSocket server setup (gorilla/websocket or similar)
- [x] Connection upgrade handling
- [x] Connection registry management

### 8.2 Authentication
- [x] `POST /api/v1/auth/ws-token` - Exchange JWT for WS token
- [x] WS token validation on connect
- [x] Token expiration handling

### 8.3 Subscriptions
- [x] Subscribe to project channel
- [x] Subscribe to node channel
- [x] Unsubscribe handling
- [x] Channel-based message routing

### 8.4 Presence
- [x] Track who's viewing/editing nodes
- [x] Broadcast presence updates
- [x] Handle disconnect cleanup

### 8.5 Real-Time Updates
- [x] Node created/updated/deleted broadcasts
- [x] Lock acquired/released broadcasts
- [x] Execution status streaming
- [x] Trace event streaming

### 8.6 Redis Pub/Sub
- [x] Publish updates from API to Redis
- [x] WebSocket server subscribes to Redis
- [x] Multi-instance message distribution

**Verification:** WebSocket connects, subscribes to channels, receives ping/pong. ✅ Tested successfully.

---

## Phase 9: Infrastructure & Deployment ✅ COMPLETE

**Goal:** Deploy to AWS.

### 9.1 AWS CDK Stacks
- [x] Network stack (VPC, subnets, security groups)
- [x] Database stack (RDS PostgreSQL with pgvector)
- [x] Cache stack (ElastiCache Redis)
- [x] Storage stack (S3 buckets, CloudFront)
- [x] Messaging stack (SQS queues)
- [x] Auth stack (Cognito user pool)
- [x] Compute stack (ECS Fargate services)
- [x] Monitoring stack (CloudWatch, alarms)

### 9.2 CI/CD
- [x] GitHub Actions for CI (lint, test, build)
- [x] Docker image builds
- [x] Push to ECR
- [x] Deploy to staging on merge
- [x] Manual deploy to production

### 9.3 Environment Configuration
- [x] Dev config (local Docker)
- [x] Staging config
- [x] Production config
- [x] Secrets management (AWS Secrets Manager via CDK)

### 9.4 Dockerfiles
- [x] Dockerfile for Go API
- [x] Dockerfile for Python workers (API and WebSocket combined in Go API)

**Verification:** `cdk synth` generates CloudFormation templates. CI/CD workflows created.

---

## Phase 10: Testing & Polish

**Goal:** Production-ready quality.

### 10.1 Testing
- [ ] Unit tests for Go services
- [ ] Unit tests for Python workers
- [ ] Integration tests for API endpoints
- [ ] End-to-end test: create node → run agent → get output

### 10.2 Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Developer setup guide
- [ ] Deployment runbook

### 10.3 Error Handling
- [ ] Consistent error response format
- [ ] Proper HTTP status codes
- [ ] Error logging with context
- [ ] User-friendly error messages

### 10.4 Performance
- [ ] Database query optimization
- [ ] Connection pooling verification
- [ ] Basic load testing
- [ ] Identify bottlenecks

**Verification:** All tests pass, docs are complete, error handling is consistent.

---

## Quick Reference

### Starting Development

```bash
# Start dependencies
cd docker && docker compose up -d

# Run migrations
psql -h localhost -U glassbox -d glassbox -f packages/db-schema/migrations/001_initial_schema.sql

# Start Go API
cd apps/api && go run cmd/api/main.go

# Start Python agent worker
cd apps/workers && source .venv/bin/activate && python -m agent.worker
```

### Key Files

| Component | Main File |
|-----------|-----------|
| Go API entry | `apps/api/cmd/api/main.go` |
| Go handlers | `apps/api/internal/handlers/handlers.go` |
| Go services | `apps/api/internal/services/services.go` |
| DB schema | `packages/db-schema/migrations/001_initial_schema.sql` |
| Agent worker | `apps/workers/agent/worker.py` |
| Agent executor | `apps/workers/agent/executor.py` |
| File processor | `apps/workers/file_processor/worker.py` |

---

## Progress Tracking

When completing tasks:
1. Check the box in this document
2. Add entry to `docs/CHANGELOG.md`
3. Update `docs/TECHNICAL.md` if architecture changed
