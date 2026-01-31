# GlassBox Architecture Overview v1

High-level system architecture and design decisions.

## System Overview

GlassBox is a collaborative workspace where humans and AI agents work together on complex tasks. The platform is built around the **Node** primitive - a unit of work with inputs, outputs, and execution history.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Next.js Frontend                             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │    │
│  │  │  Canvas  │  │   Tree   │  │  Detail  │  │  Execution View  │     │    │
│  │  │   View   │  │   View   │  │   View   │  │   (Real-time)    │     │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS / WSS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Application Load Balancer                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│              ┌───────────────────────┴───────────────────────┐              │
│              ▼                                               ▼              │
│  ┌─────────────────────────┐                 ┌─────────────────────────┐    │
│  │      Go API Server      │                 │     WebSocket Hub       │    │
│  │    (Gin Framework)      │◄───────────────►│  (gorilla/websocket)    │    │
│  │                         │                 │                         │    │
│  │  ┌───────────────────┐  │                 │  ┌───────────────────┐  │    │
│  │  │     Handlers      │  │                 │  │   Subscriptions   │  │    │
│  │  │  (49 endpoints)   │  │                 │  │    (channels)     │  │    │
│  │  └───────────────────┘  │                 │  └───────────────────┘  │    │
│  │  ┌───────────────────┐  │                 │  ┌───────────────────┐  │    │
│  │  │     Services      │  │                 │  │    Presence       │  │    │
│  │  │  (business logic) │  │                 │  │   (who's online)  │  │    │
│  │  └───────────────────┘  │                 │  └───────────────────┘  │    │
│  └─────────────────────────┘                 └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                     │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │   PostgreSQL     │  │      Redis       │  │          S3              │   │
│  │   (+ pgvector)   │  │    (Cache)       │  │    (File Storage)        │   │
│  │                  │  │                  │  │                          │   │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────────────┐  │   │
│  │  │   Nodes    │  │  │  │   Locks    │  │  │  │  Uploaded Files    │  │   │
│  │  │  Versions  │  │  │  │  Sessions  │  │  │  │  Agent Outputs     │  │   │
│  │  │ Executions │  │  │  │  Pub/Sub   │  │  │  │                    │  │   │
│  │  │ Embeddings │  │  │  │Rate Limits │  │  │  │                    │  │   │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────────────┘  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ SQS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             WORKER LAYER                                    │
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │        Agent Worker             │  │       File Processor            │   │
│  │      (Python + LangGraph)       │  │         (Python)                │   │
│  │                                 │  │                                 │   │
│  │  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │   │
│  │  │   LLM Calls (LiteLLM)     │  │  │  │   Text Extraction         │  │   │
│  │  │   Tool Execution          │  │  │  │   (PDF, DOCX, TXT)        │  │   │
│  │  │   Subnode Creation        │  │  │  │                           │  │   │
│  │  │   Output Generation       │  │  │  │   Embedding Generation    │  │   │
│  │  │   Checkpointing           │  │  │  │   (OpenAI ada-002)        │  │   │
│  │  └───────────────────────────┘  │  │  └───────────────────────────┘  │   │
│  └─────────────────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ API Calls
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                 │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │    OpenAI API    │  │   Anthropic API  │  │    AWS Cognito           │   │
│  │   (GPT-4, etc)   │  │  (Claude, etc)   │  │  (Authentication)        │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### The Node Primitive

Everything in GlassBox is organized around **Nodes**:

```
┌─────────────────────────────────────────────────────────────────┐
│                           NODE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUTS                         OUTPUTS                         │
│  ┌──────────────┐               ┌──────────────┐                │
│  │ File         │               │ Text         │                │
│  │ Node Ref     │               │ Structured   │                │
│  │ External URL │    ────►      │ File         │                │
│  │ Text         │               │ External URL │                │
│  └──────────────┘               └──────────────┘                │
│                                                                 │
│  METADATA                       EXECUTION                       │
│  ┌──────────────┐               ┌──────────────┐                │
│  │ Title        │               │ Status       │                │
│  │ Description  │               │ Trace        │                │
│  │ Status       │               │ Tokens       │                │
│  │ Author       │               │ Cost         │                │
│  │ Version      │               │ Duration     │                │
│  └──────────────┘               └──────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Node Relationships

Nodes form two relationship types:

```
TREE (Parent-Child)                    DAG (Dependencies)
         ┌─────┐                            ┌─────┐
         │  A  │                            │  A  │
         └──┬──┘                            └──┬──┘
       ┌────┴────┐                             │
    ┌──┴──┐   ┌──┴──┐                      ┌───▼───┐
    │  B  │   │  C  │                      │   B   │
    └──┬──┘   └──┬──┘                      └───┬───┘
       │      ┌──┴──┐                      ┌───┴───┐
    ┌──┴──┐┌──┴──┐┌─┴──┐                   │   C   │◄────┐
    │  D  ││  E  ││ F  │                   └───────┘     │
    └─────┘└─────┘└────┘                        ▲        │
                                                │        │
    Hierarchical structure                  ┌───┴───┐    │
    for organization                        │   D   │────┘
                                            └───────┘
                                         Output dependencies
                                         (D's output feeds C)
```

---

## Data Flow

### Node Creation & Editing

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │   API    │         │    DB    │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  POST /nodes       │                    │
     │───────────────────►│                    │
     │                    │  INSERT node       │
     │                    │───────────────────►│
     │                    │                    │
     │                    │  INSERT version    │
     │                    │───────────────────►│
     │                    │                    │
     │                    │◄───────────────────│
     │  201 Created       │                    │
     │◄───────────────────│                    │
     │                    │                    │
     │           Broadcast via WebSocket       │
     │◄────────────────────────────────────────│
```

### Agent Execution Flow

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Client  │   │   API    │   │   SQS    │   │  Worker  │   │   LLM    │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │              │              │
     │ POST /execute│              │              │              │
     │─────────────►│              │              │              │
     │              │              │              │              │
     │              │ INSERT exec  │              │              │
     │              │──────────────┼──────────────┼──────────────│
     │              │              │              │              │
     │              │ Send Message │              │              │
     │              │─────────────►│              │              │
     │              │              │              │              │
     │ 201 Created  │              │              │              │
     │◄─────────────│              │              │              │
     │              │              │              │              │
     │              │              │ Receive Msg  │              │
     │              │              │─────────────►│              │
     │              │              │              │              │
     │              │              │              │ LLM Call     │
     │              │              │              │─────────────►│
     │              │              │              │              │
     │              │              │              │◄─────────────│
     │              │              │              │              │
     │              │              │  UPDATE DB   │              │
     │◄─────────────┼──────────────┼──────────────│              │
     │   (WebSocket broadcast)     │              │              │
     │              │              │              │              │
```

### File Upload & Processing

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Client  │   │   API    │   │    S3    │   │   SQS    │   │  Worker  │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │              │              │
     │ POST /upload │              │              │              │
     │─────────────►│              │              │              │
     │              │              │              │              │
     │ Presigned URL│              │              │              │
     │◄─────────────│              │              │              │
     │              │              │              │              │
     │ PUT (file)   │              │              │              │
     │──────────────┼─────────────►│              │              │
     │              │              │              │              │
     │ POST /confirm│              │              │              │
     │─────────────►│              │              │              │
     │              │              │              │              │
     │              │ Dispatch Job │              │              │
     │              │──────────────┼─────────────►│              │
     │              │              │              │              │
     │ 200 OK       │              │              │              │
     │◄─────────────│              │              │ Receive Job  │
     │              │              │              │─────────────►│
     │              │              │              │              │
     │              │              │ Download     │              │
     │              │              │◄─────────────┼──────────────│
     │              │              │              │              │
     │              │              │              │  Extract +   │
     │              │              │              │  Embed       │
     │              │              │              │              │
     │              │   UPDATE DB  │              │              │
     │              │◄─────────────┼──────────────┼──────────────│
```

---

## Security Architecture

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────┐    │
│  │ Browser │───►│   Cognito   │───►│   API   │───►│   DB    │    │
│  │         │    │ Hosted UI   │    │         │    │         │    │
│  └─────────┘    └─────────────┘    └─────────┘    └─────────┘    │
│       │                │                │              │         │
│       │  1. Login      │                │              │         │
│       │───────────────►│                │              │         │
│       │                │                │              │         │
│       │  2. JWT Token  │                │              │         │
│       │◄───────────────│                │              │         │
│       │                │                │              │         │
│       │  3. API Request (Bearer Token)  │              │         │
│       │────────────────────────────────►│              │         │
│       │                │                │              │         │
│       │                │  4. Validate   │              │         │
│       │                │◄───────────────│              │         │
│       │                │                │              │         │
│       │                │                │  5. Get User │         │
│       │                │                │─────────────►│         │
│       │                │                │              │         │
│       │  6. Response   │                │              │         │
│       │◄────────────────────────────────│              │         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Authorization Model

```
┌──────────────────────────────────────────────────────────────────┐
│                     AUTHORIZATION HIERARCHY                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Organization Level              Project Level                   │
│  ┌─────────────────┐            ┌─────────────────┐              │
│  │     Owner       │            │     Admin       │              │
│  │  (full access)  │            │  (full project) │              │
│  └────────┬────────┘            └────────┬────────┘              │
│           │                              │                       │
│  ┌────────▼────────┐            ┌────────▼────────┐              │
│  │     Admin       │            │     Member      │              │
│  │ (manage users)  │            │  (create/edit)  │              │
│  └────────┬────────┘            └────────┬────────┘              │
│           │                              │                       │
│  ┌────────▼────────┐            ┌────────▼────────┐              │
│  │     Member      │            │     Viewer      │              │
│  │(create projects)│            │   (read only)   │              │
│  └────────┬────────┘            └─────────────────┘              │
│           │                                                      │
│  ┌────────▼────────┐                                             │
│  │     Guest       │                                             │
│  │  (read only)    │                                             │
│  └─────────────────┘                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Row-Level Security

```sql
-- Every query runs with organization context
SET app.current_org_id = 'org-uuid';

-- RLS policy ensures tenant isolation
CREATE POLICY org_isolation ON nodes
    USING (org_id = current_setting('app.current_org_id')::UUID);
```

---

## Scalability Design

### Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────────┐
│                     HORIZONTAL SCALING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Load Balancer                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                          ALB                             │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│         ┌────────┐      ┌────────┐      ┌────────┐              │
│         │ API 1  │      │ API 2  │      │ API 3  │              │
│         └────────┘      └────────┘      └────────┘              │
│              │               │               │                  │
│              └───────────────┼───────────────┘                  │
│                              ▼                                  │
│                    ┌─────────────────┐                          │
│                    │   Redis Pub/Sub │ (WebSocket sync)         │
│                    └─────────────────┘                          │
│                                                                 │
│  Worker Scaling                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     SQS Queues                           │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│         ┌────────┐      ┌────────┐      ┌────────┐              │
│         │Worker 1│      │Worker 2│      │Worker 3│              │
│         └────────┘      └────────┘      └────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Scaling Strategy

1. **Read Replicas** - For read-heavy workloads
2. **Connection Pooling** - Via PgBouncer or similar
3. **Partitioning** - By org_id for large deployments
4. **Caching** - Redis for frequently accessed data

---

## Technology Decisions

### Why Go for API?

| Factor | Decision |
|--------|----------|
| Performance | Compiled, low latency |
| Concurrency | Goroutines for WebSocket handling |
| Type Safety | Static typing catches errors early |
| Deployment | Single binary, easy containerization |
| Ecosystem | Mature HTTP/WebSocket libraries |

### Why Python for Workers?

| Factor | Decision |
|--------|----------|
| LLM Libraries | LangChain, LiteLLM support |
| Data Processing | Rich ecosystem (pypdf, etc.) |
| Rapid Development | Quick iteration on agent logic |
| ML/AI | Natural fit for AI workloads |

### Why PostgreSQL?

| Factor | Decision |
|--------|----------|
| pgvector | Native vector embeddings |
| JSONB | Flexible metadata storage |
| Reliability | Battle-tested, ACID compliant |
| Extensions | Rich extension ecosystem |
| RLS | Row-level security for multi-tenancy |

### Why Redis?

| Factor | Decision |
|--------|----------|
| Speed | Sub-millisecond operations |
| Pub/Sub | WebSocket message distribution |
| Locks | Distributed locking primitive |
| TTL | Automatic key expiration |

---

## Deployment Architecture

### Staging

```
Region: us-east-1
├── VPC (2 AZs)
├── ECS Fargate
│   ├── API Service (1 task)
│   ├── Agent Worker (1 task)
│   └── File Worker (1 task)
├── RDS PostgreSQL (Single-AZ)
├── ElastiCache Redis (Single node)
├── S3 Bucket
└── CloudWatch Logs
```

### Production (Future)

```
Region: us-east-1 (Primary)
├── VPC (3 AZs)
├── ECS Fargate
│   ├── API Service (2-10 tasks, auto-scaling)
│   ├── Agent Worker (2-5 tasks)
│   └── File Worker (1-3 tasks)
├── RDS PostgreSQL (Multi-AZ)
├── ElastiCache Redis (Multi-node, replication)
├── S3 Bucket (Cross-region replication)
├── CloudWatch + Alarms
└── WAF + Shield

Region: eu-west-1 (DR)
├── RDS Read Replica
└── S3 Bucket (replicated)
```

---

## Design Principles

1. **Node-Centric** - Everything is a node or relates to one
2. **Evidence-First** - All actions are traced and auditable
3. **Human-in-the-Loop** - Agents can request human input
4. **Version Everything** - Full history for compliance
5. **Multi-Tenant** - Strict organization isolation
6. **Real-Time** - WebSocket for instant updates
7. **Async Workers** - Heavy tasks off the API path
