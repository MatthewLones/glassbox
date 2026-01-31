# GlassBox Services Documentation v1

Technical documentation for all backend services.

## Overview

GlassBox backend consists of:
- **Go API Server** - REST API + WebSocket
- **Agent Worker** - Python LangGraph agent execution
- **File Processor** - Python text extraction and embedding

---

## Go API Server

**Location:** `apps/api/`

### Directory Structure

```
apps/api/
├── cmd/
│   └── api/
│       └── main.go              # Entry point
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration loading
│   ├── database/
│   │   ├── postgres.go          # PostgreSQL connection
│   │   ├── redis.go             # Redis connection
│   │   ├── migrations.go        # Migration runner
│   │   └── schema.sql           # Embedded schema
│   ├── handlers/
│   │   └── handlers.go          # HTTP handlers
│   ├── middleware/
│   │   ├── auth.go              # JWT authentication
│   │   ├── cors.go              # CORS handling
│   │   ├── logger.go            # Request logging
│   │   ├── ratelimit.go         # Rate limiting
│   │   └── requestid.go         # Request ID tracking
│   ├── models/
│   │   └── models.go            # Data structures
│   ├── services/
│   │   ├── services.go          # Business logic
│   │   └── execution.go         # Execution service
│   ├── storage/
│   │   └── s3.go                # S3 client
│   ├── queue/
│   │   └── sqs.go               # SQS client
│   └── websocket/
│       ├── hub.go               # Connection hub
│       ├── client.go            # Client handling
│       ├── handler.go           # HTTP upgrade
│       ├── messages.go          # Message types
│       └── broadcaster.go       # Broadcast utilities
├── go.mod
└── go.sum
```

### Configuration

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `GO_ENV` | Environment (development/production) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET` | S3 bucket name | Required |
| `SQS_AGENT_QUEUE_URL` | Agent job queue URL | Required |
| `SQS_FILE_QUEUE_URL` | File processing queue URL | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `COGNITO_USER_POOL_ID` | Cognito user pool ID | Required |
| `COGNITO_CLIENT_ID` | Cognito client ID | Required |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |

### Services Layer

#### AuthService

Handles authentication and token management.

```go
type AuthService interface {
    // ValidateJWT validates a JWT token and returns user claims
    ValidateJWT(ctx context.Context, token string) (*UserClaims, error)

    // GenerateDevToken creates a development JWT (dev mode only)
    GenerateDevToken(ctx context.Context, userId, email string) (string, error)

    // GenerateWSToken creates a short-lived WebSocket token
    GenerateWSToken(ctx context.Context, userId, email string) (string, error)

    // ValidateWSToken validates and consumes a WebSocket token
    ValidateWSToken(ctx context.Context, token string) (*WSTokenData, error)

    // GetOrCreateUser ensures user exists in database
    GetOrCreateUser(ctx context.Context, cognitoSub, email, name string) (*User, error)
}
```

#### OrganizationService

Manages organizations and membership.

```go
type OrganizationService interface {
    // ListByUser returns organizations user belongs to
    ListByUser(ctx context.Context, userId string) ([]OrgWithRole, error)

    // GetByID returns organization if user has access
    GetByID(ctx context.Context, orgId, userId string) (*Organization, error)

    // Create creates new org and adds creator as owner
    Create(ctx context.Context, userId string, input CreateOrgInput) (*Organization, error)

    // Update updates org settings (requires admin/owner role)
    Update(ctx context.Context, orgId, userId string, input UpdateOrgInput) (*Organization, error)

    // Delete deletes org (requires owner role)
    Delete(ctx context.Context, orgId, userId string) error

    // GetUserRole returns user's role in org
    GetUserRole(ctx context.Context, orgId, userId string) (string, error)
}
```

#### NodeService

Core node operations with versioning and locking.

```go
type NodeService interface {
    // CRUD
    ListByProject(ctx context.Context, projectId string, filters NodeFilters) ([]Node, error)
    GetByID(ctx context.Context, nodeId string) (*NodeWithIO, error)
    Create(ctx context.Context, projectId, userId string, input CreateNodeInput) (*Node, error)
    Update(ctx context.Context, nodeId, userId string, input UpdateNodeInput) (*Node, error)
    Delete(ctx context.Context, nodeId, userId string) error

    // Versions
    ListVersions(ctx context.Context, nodeId string) ([]NodeVersion, error)
    GetVersion(ctx context.Context, nodeId string, version int) (*NodeVersion, error)
    Rollback(ctx context.Context, nodeId, userId string, version int) (*Node, error)

    // Inputs/Outputs
    AddInput(ctx context.Context, nodeId string, input CreateInputInput) (*NodeInput, error)
    RemoveInput(ctx context.Context, nodeId, inputId string) error
    AddOutput(ctx context.Context, nodeId string, input CreateOutputInput) (*NodeOutput, error)
    RemoveOutput(ctx context.Context, nodeId, outputId string) error

    // Relationships
    ListChildren(ctx context.Context, nodeId string) ([]Node, error)
    ListDependencies(ctx context.Context, nodeId string) ([]NodeDependency, error)

    // Locking
    AcquireLock(ctx context.Context, nodeId, userId string) (*LockInfo, error)
    ReleaseLock(ctx context.Context, nodeId, userId string) error
}
```

#### ExecutionService

Agent execution lifecycle management.

```go
type ExecutionService interface {
    // Start creates execution and dispatches job to SQS
    Start(ctx context.Context, nodeId, userId string) (*AgentExecution, error)

    // GetByID returns execution details
    GetByID(ctx context.Context, executionId string) (*AgentExecution, error)

    // GetCurrentForNode returns active execution for a node
    GetCurrentForNode(ctx context.Context, nodeId string) (*AgentExecution, error)

    // Pause pauses running execution
    Pause(ctx context.Context, executionId, userId string) error

    // Resume resumes paused execution
    Resume(ctx context.Context, executionId, userId string) error

    // Cancel cancels active execution
    Cancel(ctx context.Context, executionId, userId string) error

    // ProvideInput provides human input for HITL
    ProvideInput(ctx context.Context, executionId, userId string, input map[string]any) error

    // GetTrace returns all trace events
    GetTrace(ctx context.Context, executionId string) ([]TraceEvent, error)
}
```

#### FileService

File upload and processing orchestration.

```go
type FileService interface {
    // GetUploadURL creates file record and returns presigned upload URL
    GetUploadURL(ctx context.Context, orgId, userId string, input UploadInput) (*UploadResponse, error)

    // ConfirmUpload confirms upload and dispatches processing job
    ConfirmUpload(ctx context.Context, fileId, userId string) (*File, error)

    // GetByID returns file with download URL
    GetByID(ctx context.Context, fileId string) (*FileWithURL, error)

    // Delete removes file from S3 and database
    Delete(ctx context.Context, fileId, userId string) error
}
```

#### SearchService

Text and semantic search.

```go
type SearchService interface {
    // TextSearch performs ILIKE search across nodes and files
    TextSearch(ctx context.Context, orgId string, input SearchInput) (*SearchResults, error)

    // SemanticSearch performs vector similarity search
    SemanticSearch(ctx context.Context, orgId string, input SemanticSearchInput) (*SearchResults, error)

    // GetNodeContext returns full context for RAG
    GetNodeContext(ctx context.Context, nodeId string) (*NodeContext, error)
}
```

### Middleware Stack

```go
// Applied in order:
r.Use(gin.Recovery())        // Panic recovery
r.Use(middleware.Logger())   // Request logging
r.Use(middleware.CORS())     // Cross-origin handling
r.Use(middleware.RequestID()) // Request ID tracking
r.Use(middleware.Auth())     // JWT authentication (protected routes)
r.Use(middleware.RateLimit()) // Rate limiting (protected routes)
```

### Database Connection Pool

```go
// Configuration
config.MaxConns = 25
config.MinConns = 5
config.MaxConnLifetime = 1 * time.Hour
config.MaxConnIdleTime = 30 * time.Minute
config.HealthCheckPeriod = 1 * time.Minute
```

---

## Python Agent Worker

**Location:** `apps/workers/agent/`

### Directory Structure

```
apps/workers/
├── agent/
│   ├── __init__.py
│   ├── worker.py            # SQS consumer
│   └── executor.py          # LangGraph executor
├── file_processor/
│   ├── __init__.py
│   └── worker.py            # File processing
├── shared/
│   ├── __init__.py
│   ├── config.py            # Configuration
│   ├── db.py                # Database client
│   ├── s3.py                # S3 client
│   └── sqs.py               # SQS consumer
├── requirements.txt
└── pyproject.toml
```

### Agent Executor

The agent executor uses LangGraph for orchestration.

#### State Machine

```python
class AgentState(TypedDict):
    """State for agent execution."""
    node_id: str
    execution_id: str
    org_id: str

    # Node context
    title: str
    description: str
    inputs: List[Dict]
    outputs: List[Dict]

    # Conversation
    messages: List[Dict]

    # Execution state
    current_step: str
    iteration: int
    max_iterations: int

    # Results
    created_subnodes: List[str]
    created_outputs: List[Dict]

    # Control
    status: str  # running, paused, awaiting_input, complete, failed
    error: Optional[str]
```

#### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        START                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOAD NODE CONTEXT                             │
│           (inputs, outputs, parent chain, siblings)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYZE TASK                                 │
│           (understand inputs, determine approach)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│   SIMPLE EXECUTION   │              │  DECOMPOSE TO SUBS   │
│  (complete directly) │              │  (create_subnode)    │
└──────────────────────┘              └──────────────────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXECUTE / ITERATE                            │
│               (LLM calls, tool calls)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│   HUMAN INPUT NEEDED │              │     CONTINUE         │
│  (await_input)       │              │                      │
└──────────────────────┘              └──────────────────────┘
          │                                       │
          ▼                                       │
┌──────────────────────┐                          │
│   WAIT FOR INPUT     │                          │
│   (checkpoint)       │                          │
└──────────────────────┘                          │
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FINALIZE                                     │
│            (save outputs, update status)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COMPLETE                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Available Tools

```python
# Create child node
create_subnode(
    title: str,
    description: str,
    author_type: str = "agent"
) -> dict

# Add output to node
add_output(
    output_type: str,  # "text", "structured_data", "file"
    content: Any,
    label: str
) -> dict

# Request human input
request_human_input(
    prompt: str,
    options: List[str] = None
) -> dict

# Access another node's data
access_node(
    node_id: str,
    version: int = None  # None = latest
) -> dict
```

#### LLM Integration

Uses LiteLLM for model abstraction:

```python
from litellm import completion

response = completion(
    model=config.model,  # "gpt-4", "claude-3", etc.
    messages=messages,
    tools=tools,
    temperature=config.temperature
)
```

#### Checkpointing

State is checkpointed for pause/resume:

```python
async def _checkpoint(self, state: AgentState):
    """Save checkpoint for pause/resume."""
    checkpoint = {
        "state": state,
        "iteration": state["iteration"],
        "messages": state["messages"],
        "timestamp": datetime.utcnow().isoformat()
    }

    await self.db.execute(
        """
        UPDATE agent_executions
        SET langgraph_checkpoint = $1
        WHERE id = $2
        """,
        json.dumps(checkpoint),
        self.execution_id
    )
```

---

## Python File Processor

**Location:** `apps/workers/file_processor/`

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    SQS MESSAGE RECEIVED                          │
│                    {file_id, action: "process"}                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOWNLOAD FROM S3                              │
│                    (using storage_key)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTRACT TEXT                                  │
│           PDF: pypdf | DOCX: python-docx | TXT: raw             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATE EMBEDDING                            │
│              (LiteLLM text-embedding-3-small)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UPDATE DATABASE                               │
│       (extracted_text, embedding, processing_status)            │
└─────────────────────────────────────────────────────────────────┘
```

### Text Extraction

```python
async def extract_text(file_path: str, content_type: str) -> str:
    """Extract text based on content type."""

    if content_type == "application/pdf":
        return await extract_pdf_text(file_path)

    elif content_type in [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword"
    ]:
        return await extract_docx_text(file_path)

    elif content_type.startswith("text/"):
        return await extract_plain_text(file_path)

    else:
        raise ValueError(f"Unsupported content type: {content_type}")
```

### Embedding Generation

```python
async def generate_embedding(text: str) -> List[float]:
    """Generate embedding vector using OpenAI."""

    # Truncate if too long (8000 char limit)
    if len(text) > 8000:
        text = text[:8000]

    response = await litellm.aembedding(
        model="text-embedding-3-small",
        input=text
    )

    return response.data[0].embedding  # 1536 dimensions
```

---

## Shared Utilities

### Configuration (`shared/config.py`)

```python
@dataclass
class Config:
    # Database
    database_url: str

    # Redis
    redis_url: str

    # AWS
    aws_region: str = "us-east-1"
    s3_bucket: str = ""
    sqs_agent_queue_url: str = ""
    sqs_file_queue_url: str = ""

    # LLM
    default_model: str = "gpt-4"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            database_url=os.environ["DATABASE_URL"],
            redis_url=os.environ["REDIS_URL"],
            # ... other fields
        )
```

### Database Client (`shared/db.py`)

```python
class Database:
    def __init__(self, database_url: str):
        self.pool = None
        self.database_url = database_url

    async def connect(self):
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=2,
            max_size=10
        )

    async def execute(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def fetchrow(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetch(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)
```

### S3 Client (`shared/s3.py`)

```python
class S3Client:
    def __init__(self, bucket: str, region: str = "us-east-1"):
        self.bucket = bucket
        self.session = aioboto3.Session()
        self.region = region

    async def download(self, key: str, dest_path: str):
        async with self.session.client("s3", region_name=self.region) as s3:
            await s3.download_file(self.bucket, key, dest_path)

    async def upload(self, key: str, content: bytes, content_type: str):
        async with self.session.client("s3", region_name=self.region) as s3:
            await s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType=content_type
            )

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        async with self.session.client("s3", region_name=self.region) as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in
            )
```

### SQS Consumer (`shared/sqs.py`)

```python
class SQSConsumer:
    def __init__(self, queue_url: str, handler: Callable):
        self.queue_url = queue_url
        self.handler = handler
        self.session = aioboto3.Session()
        self.running = True

    async def start(self):
        async with self.session.client("sqs") as sqs:
            while self.running:
                response = await sqs.receive_message(
                    QueueUrl=self.queue_url,
                    MaxNumberOfMessages=1,
                    WaitTimeSeconds=20,
                    VisibilityTimeout=600
                )

                for message in response.get("Messages", []):
                    try:
                        body = json.loads(message["Body"])
                        await self.handler(body)

                        await sqs.delete_message(
                            QueueUrl=self.queue_url,
                            ReceiptHandle=message["ReceiptHandle"]
                        )
                    except Exception as e:
                        logger.error(f"Handler error: {e}")

    def stop(self):
        self.running = False
```

---

## Inter-Service Communication

### API → Workers (via SQS)

```
┌─────────────────┐     SQS Message      ┌─────────────────┐
│   Go API        │ ─────────────────▶  │  Python Worker  │
│                 │                      │                 │
│  FileService    │  {                   │  file_processor │
│  .ConfirmUpload │    "file_id": "...", │  .process()     │
│                 │    "action": "process"                 │
│                 │  }                   │                 │
└─────────────────┘                      └─────────────────┘
```

### Workers → API (via Database)

Workers update database directly, API reads on next request.

### Real-Time Updates (via Redis)

```
┌─────────────────┐     Redis Pub/Sub    ┌─────────────────┐
│  Python Worker  │ ─────────────────▶  │   Go API        │
│                 │                      │   (WebSocket)   │
│  Updates status │  Channel: glassbox   │                 │
│  in DB + Redis  │  {                   │  Broadcasts to  │
│                 │    "type": "exec",   │  subscribers    │
│                 │    "nodeId": "..."   │                 │
│                 │  }                   │                 │
└─────────────────┘                      └─────────────────┘
```
