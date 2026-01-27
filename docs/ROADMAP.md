# GlassBox Backend Roadmap

This is the master todo list for backend development. Check items off as they're completed.

**Last Updated:** 2026-01-27

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| Database Schema | **Complete** | 16 tables, indexes, RLS ready |
| Go API | **Phase 2 Complete** | Auth, Orgs, Users implemented |
| Python Workers | Partial | Agent has LangGraph logic |
| WebSocket | Not Started | Directory only |
| Infrastructure | Not Started | Directory only |

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

## Phase 3: Core API - Projects & Nodes

**Goal:** Full CRUD for the core Node primitive.

### 3.1 Project Handlers
- [ ] `GET /api/v1/orgs/:orgId/projects` - List projects
- [ ] `POST /api/v1/orgs/:orgId/projects` - Create project
- [ ] `GET /api/v1/projects/:projectId` - Get project
- [ ] `PATCH /api/v1/projects/:projectId` - Update project
- [ ] `DELETE /api/v1/projects/:projectId` - Delete project

### 3.2 Node CRUD Handlers
- [ ] `GET /api/v1/projects/:projectId/nodes` - List nodes (with filters)
- [ ] `POST /api/v1/projects/:projectId/nodes` - Create node
- [ ] `GET /api/v1/nodes/:nodeId` - Get node with inputs/outputs
- [ ] `PATCH /api/v1/nodes/:nodeId` - Update node
- [ ] `DELETE /api/v1/nodes/:nodeId` - Soft delete node

### 3.3 Node Inputs/Outputs
- [ ] `POST /api/v1/nodes/:nodeId/inputs` - Add input
- [ ] `DELETE /api/v1/nodes/:nodeId/inputs/:inputId` - Remove input
- [ ] `POST /api/v1/nodes/:nodeId/outputs` - Add output
- [ ] `DELETE /api/v1/nodes/:nodeId/outputs/:outputId` - Remove output

### 3.4 Node Versioning
- [ ] `GET /api/v1/nodes/:nodeId/versions` - Get version history
- [ ] `GET /api/v1/nodes/:nodeId/versions/:v` - Get specific version
- [ ] `POST /api/v1/nodes/:nodeId/rollback/:v` - Rollback to version
- [ ] Auto-create version on node update

### 3.5 Node Relationships
- [ ] `GET /api/v1/nodes/:nodeId/children` - Get child nodes
- [ ] `GET /api/v1/nodes/:nodeId/dependencies` - Get dependency graph
- [ ] Parent-child tree queries
- [ ] DAG dependency queries

### 3.6 Node Locking
- [ ] `POST /api/v1/nodes/:nodeId/lock` - Acquire lock
- [ ] `DELETE /api/v1/nodes/:nodeId/lock` - Release lock
- [ ] Lock expiration handling
- [ ] Lock conflict responses

### 3.7 Service Layer
- [ ] ProjectService with DB queries
- [ ] NodeService with complex queries
- [ ] Version management logic
- [ ] Lock management with Redis

**Verification:** Create node with inputs/outputs, update it, verify version history.

---

## Phase 4: File Handling

**Goal:** Upload files to S3, track metadata, dispatch processing jobs.

### 4.1 S3 Integration
- [ ] S3 client configuration (LocalStack for dev)
- [ ] Presigned URL generation for uploads
- [ ] Presigned URL generation for downloads

### 4.2 File Handlers
- [ ] `POST /api/v1/orgs/:orgId/files/upload` - Get presigned upload URL
- [ ] `POST /api/v1/files/:fileId/confirm` - Confirm upload complete
- [ ] `GET /api/v1/files/:fileId` - Get file metadata + download URL
- [ ] `DELETE /api/v1/files/:fileId` - Delete file

### 4.3 Job Dispatch
- [ ] SQS client configuration (LocalStack for dev)
- [ ] Dispatch file processing job on upload confirm
- [ ] Job message format definition

### 4.4 Service Layer
- [ ] FileService with DB queries
- [ ] S3 operations wrapper
- [ ] SQS producer wrapper

**Verification:** Upload file via presigned URL, confirm, see processing job in queue.

---

## Phase 5: Agent Execution

**Goal:** Trigger and manage agent runs from API.

### 5.1 Execution Handlers
- [ ] `POST /api/v1/nodes/:nodeId/execute` - Start agent execution
- [ ] `GET /api/v1/nodes/:nodeId/execution` - Get current execution status
- [ ] `POST /api/v1/nodes/:nodeId/execution/pause` - Pause execution
- [ ] `POST /api/v1/nodes/:nodeId/execution/resume` - Resume execution
- [ ] `POST /api/v1/nodes/:nodeId/execution/cancel` - Cancel execution
- [ ] `GET /api/v1/executions/:executionId` - Get execution details
- [ ] `GET /api/v1/executions/:executionId/trace` - Get full trace

### 5.2 Job Dispatch
- [ ] Create agent_execution record
- [ ] Dispatch job to agent queue
- [ ] Job message format (node_id, execution_id, org_config)

### 5.3 Agent Worker Integration
- [ ] Verify worker picks up jobs
- [ ] Verify status updates write to DB
- [ ] Verify trace events are logged
- [ ] Test human-in-the-loop pause/resume

### 5.4 Service Layer
- [ ] ExecutionService with DB queries
- [ ] Status update handling
- [ ] Cost tracking aggregation

**Verification:** Start execution, see agent process it, retrieve trace.

---

## Phase 6: File Processing Worker

**Goal:** Extract text from files, generate embeddings.

### 6.1 Text Extraction
- [ ] PDF text extraction (using unstructured or pdfplumber)
- [ ] DOCX text extraction
- [ ] Plain text file handling
- [ ] Image OCR (optional - using pytesseract or Textract)

### 6.2 Embedding Generation
- [ ] Chunk long documents appropriately
- [ ] Generate embeddings via LiteLLM
- [ ] Store embeddings in pgvector column

### 6.3 Worker Integration
- [ ] Download file from S3
- [ ] Process and extract text
- [ ] Generate and store embeddings
- [ ] Update file status in DB
- [ ] Error handling and retries

**Verification:** Upload PDF, see extracted text and embedding in database.

---

## Phase 7: Search & RAG

**Goal:** Enable finding nodes and content.

### 7.1 Search Handlers
- [ ] `POST /api/v1/orgs/:orgId/search` - Text search nodes, files
- [ ] `POST /api/v1/orgs/:orgId/search/semantic` - Semantic search

### 7.2 Text Search
- [ ] Full-text search on node titles/content
- [ ] Filter by project, status, author
- [ ] Pagination and sorting

### 7.3 Semantic Search
- [ ] Generate query embedding
- [ ] pgvector similarity search
- [ ] Combine with metadata filters
- [ ] Return relevant nodes/files with scores

### 7.4 Service Layer
- [ ] SearchService with query building
- [ ] Embedding generation for queries
- [ ] Result ranking and formatting

**Verification:** Search for content, get relevant results with similarity scores.

---

## Phase 8: Real-Time (WebSocket)

**Goal:** Live updates for collaboration.

### 8.1 WebSocket Server
- [ ] Go WebSocket server setup (gorilla/websocket or similar)
- [ ] Connection upgrade handling
- [ ] Connection registry management

### 8.2 Authentication
- [ ] `POST /api/v1/auth/ws-token` - Exchange JWT for WS token
- [ ] WS token validation on connect
- [ ] Token expiration handling

### 8.3 Subscriptions
- [ ] Subscribe to project channel
- [ ] Subscribe to node channel
- [ ] Unsubscribe handling
- [ ] Channel-based message routing

### 8.4 Presence
- [ ] Track who's viewing/editing nodes
- [ ] Broadcast presence updates
- [ ] Handle disconnect cleanup

### 8.5 Real-Time Updates
- [ ] Node created/updated/deleted broadcasts
- [ ] Lock acquired/released broadcasts
- [ ] Execution status streaming
- [ ] Trace event streaming

### 8.6 Redis Pub/Sub
- [ ] Publish updates from API to Redis
- [ ] WebSocket server subscribes to Redis
- [ ] Multi-instance message distribution

**Verification:** Two browsers connected, edit in one, see update in other.

---

## Phase 9: Infrastructure & Deployment

**Goal:** Deploy to AWS.

### 9.1 AWS CDK Stacks
- [ ] Network stack (VPC, subnets, security groups)
- [ ] Database stack (RDS PostgreSQL with pgvector)
- [ ] Cache stack (ElastiCache Redis)
- [ ] Storage stack (S3 buckets, CloudFront)
- [ ] Messaging stack (SQS queues)
- [ ] Auth stack (Cognito user pool)
- [ ] Compute stack (ECS Fargate services)
- [ ] Monitoring stack (CloudWatch, alarms)

### 9.2 CI/CD
- [ ] GitHub Actions for CI (lint, test, build)
- [ ] Docker image builds
- [ ] Push to ECR
- [ ] Deploy to staging on merge
- [ ] Manual deploy to production

### 9.3 Environment Configuration
- [ ] Dev config (local Docker)
- [ ] Staging config
- [ ] Production config
- [ ] Secrets management (AWS Secrets Manager)

### 9.4 Dockerfiles
- [ ] Dockerfile for Go API
- [ ] Dockerfile for Go WebSocket
- [ ] Dockerfile for Python workers

**Verification:** `cdk deploy` creates working infrastructure, services run.

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
