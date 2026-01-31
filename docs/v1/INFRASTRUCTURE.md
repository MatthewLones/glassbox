# GlassBox Infrastructure Documentation v1

AWS infrastructure deployed via CDK.

## Overview

| Resource Type | Service | Count |
|---------------|---------|-------|
| VPC | Network | 1 |
| RDS | PostgreSQL | 1 |
| ElastiCache | Redis | 1 |
| S3 | Storage | 1 |
| SQS | Queues | 4 (2 + 2 DLQ) |
| Cognito | Auth | 1 |
| ECS | Containers | 3 services |
| CloudWatch | Monitoring | 1 dashboard |

---

## CDK Stacks

**Location:** `apps/infrastructure/lib/`

### Stack Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         GlassBox-{env}                           │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐   │
│  │    Network     │   │    Database    │   │     Cache      │   │
│  │    (VPC)       │   │    (RDS)       │   │   (Redis)      │   │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘   │
│          │                    │                     │            │
│  ┌───────┴────────┐   ┌───────┴────────┐   ┌───────┴────────┐   │
│  │    Storage     │   │   Messaging    │   │      Auth      │   │
│  │    (S3)        │   │    (SQS)       │   │   (Cognito)    │   │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘   │
│          │                    │                     │            │
│          └────────────────────┼─────────────────────┘            │
│                               │                                  │
│                    ┌──────────┴──────────┐                       │
│                    │      Compute        │                       │
│                    │      (ECS)          │                       │
│                    └──────────┬──────────┘                       │
│                               │                                  │
│                    ┌──────────┴──────────┐                       │
│                    │     Monitoring      │                       │
│                    │   (CloudWatch)      │                       │
│                    └─────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Network Stack

**File:** `network-stack.ts`

### VPC Configuration

| Property | Staging | Production |
|----------|---------|------------|
| CIDR | 10.0.0.0/16 | 10.0.0.0/16 |
| Availability Zones | 2 | 3 |
| NAT Gateways | 1 | 3 |
| Public Subnets | 2 | 3 |
| Private Subnets | 2 | 3 |
| Isolated Subnets | 2 | 3 |

### Subnet Layout

```
VPC (10.0.0.0/16)
├── Public Subnets (internet-facing)
│   ├── 10.0.0.0/24   - AZ-a (ALB)
│   └── 10.0.1.0/24   - AZ-b (ALB)
├── Private Subnets (NAT-routed)
│   ├── 10.0.10.0/24  - AZ-a (ECS)
│   └── 10.0.11.0/24  - AZ-b (ECS)
└── Isolated Subnets (no internet)
    ├── 10.0.20.0/24  - AZ-a (RDS)
    └── 10.0.21.0/24  - AZ-b (RDS)
```

### Security Groups

| Name | Inbound | Outbound |
|------|---------|----------|
| ALB SG | 80, 443 from 0.0.0.0/0 | All to VPC |
| ECS SG | 8080 from ALB SG | All |
| RDS SG | 5432 from ECS SG | None |
| Redis SG | 6379 from ECS SG | None |

---

## 2. Database Stack

**File:** `database-stack.ts`

### RDS PostgreSQL

| Property | Staging | Production |
|----------|---------|------------|
| Instance Class | db.t3.medium | db.r6g.large |
| Multi-AZ | No | Yes |
| Storage | 20 GB | 100 GB |
| Max Storage | 100 GB | 500 GB |
| Backup Retention | 7 days | 30 days |
| Delete Protection | No | Yes |
| Version | PostgreSQL 16 | PostgreSQL 16 |

### Extensions

- `uuid-ossp` - UUID generation
- `pgcrypto` - Cryptographic functions
- `vector` - pgvector for embeddings

### Secrets Manager

Database credentials stored in: `glassbox/{env}/database`

```json
{
  "username": "glassbox",
  "password": "auto-generated",
  "host": "glassbox-{env}.xxx.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "dbname": "glassbox"
}
```

### Parameter Store

| Key | Value |
|-----|-------|
| `/glassbox/{env}/database/host` | RDS endpoint |
| `/glassbox/{env}/database/port` | 5432 |
| `/glassbox/{env}/database/name` | glassbox |

---

## 3. Cache Stack

**File:** `cache-stack.ts`

### ElastiCache Redis

| Property | Staging | Production |
|----------|---------|------------|
| Node Type | cache.t3.micro | cache.r6g.large |
| Num Nodes | 1 | 2 (primary + replica) |
| Multi-AZ | No | Yes |
| Auto Failover | No | Yes |
| Encryption | In-transit | In-transit + At-rest |
| Version | 7.x | 7.x |

### Use Cases

- **Session Cache** - WebSocket tokens, user sessions
- **Rate Limiting** - Token bucket per user
- **Distributed Locks** - Node edit locks (5 min TTL)
- **Pub/Sub** - WebSocket message broadcasting

---

## 4. Storage Stack

**File:** `storage-stack.ts`

### S3 Bucket

| Property | Value |
|----------|-------|
| Name | `glassbox-{env}-files-{account}` |
| Versioning | Disabled (use DB versioning) |
| Encryption | AES-256 |
| Public Access | Blocked |
| CORS | Enabled for frontend domain |

### CORS Configuration

```json
{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedOrigins": ["https://app.glassbox.io"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

### Folder Structure

```
glassbox-{env}-files/
├── uploads/
│   └── {org_id}/
│       └── {file_id}/
│           └── {filename}
├── outputs/
│   └── {org_id}/
│       └── {execution_id}/
│           └── {timestamp}_{type}_{uuid}.{ext}
└── temp/
    └── {uuid}/
```

---

## 5. Messaging Stack

**File:** `messaging-stack.ts`

### SQS Queues

| Queue | Purpose | Visibility Timeout | DLQ |
|-------|---------|-------------------|-----|
| `glassbox-{env}-agent-jobs` | Agent execution | 600s (10 min) | Yes |
| `glassbox-{env}-file-processing` | File processing | 300s (5 min) | Yes |

### Dead Letter Queues

| DLQ | Max Receives | Retention |
|-----|--------------|-----------|
| `glassbox-{env}-agent-jobs-dlq` | 3 | 14 days |
| `glassbox-{env}-file-processing-dlq` | 3 | 14 days |

### Message Format

**Agent Job:**
```json
{
  "executionId": "uuid",
  "nodeId": "uuid",
  "orgId": "uuid",
  "orgConfig": {
    "defaultModel": "gpt-4",
    "selfHostedEndpoint": null
  }
}
```

**File Processing:**
```json
{
  "fileId": "uuid",
  "action": "process"
}
```

---

## 6. Auth Stack

**File:** `auth-stack.ts`

### Cognito User Pool

| Property | Value |
|----------|-------|
| Name | `glassbox-{env}-users` |
| Self Sign-Up | Enabled |
| MFA | Optional |
| Email Verification | Required |
| Password Policy | 8+ chars, uppercase, lowercase, number |

### User Pool Client

| Property | Value |
|----------|-------|
| Name | `glassbox-{env}-app` |
| OAuth Flows | Authorization Code, Implicit |
| Scopes | openid, email, profile |
| Token Validity | Access: 1h, ID: 1h, Refresh: 30d |

### Hosted UI

| Property | Value |
|----------|-------|
| Domain | `glassbox-{env}.auth.us-east-1.amazoncognito.com` |
| Callback URL | `https://app.glassbox.io/auth/callback` |
| Sign-out URL | `https://app.glassbox.io/auth/logout` |

---

## 7. Compute Stack

**File:** `compute-stack.ts`

### ECS Cluster

| Property | Value |
|----------|-------|
| Name | `glassbox-{env}` |
| Capacity Providers | FARGATE, FARGATE_SPOT |
| Container Insights | Enabled |

### Services

#### API Service

| Property | Staging | Production |
|----------|---------|------------|
| CPU | 512 | 1024 |
| Memory | 1024 MB | 2048 MB |
| Desired Count | 1 | 2 |
| Min Capacity | 1 | 2 |
| Max Capacity | 4 | 10 |
| Image | `{account}.dkr.ecr.{region}.amazonaws.com/glassbox-{env}-api:latest` |

**Environment Variables:**
```
PORT=8080
GO_ENV=production
DATABASE_URL=from-secret
REDIS_URL=redis://{endpoint}:6379
AWS_REGION=us-east-1
S3_BUCKET=glassbox-{env}-files
SQS_AGENT_QUEUE_URL={queue-url}
SQS_FILE_QUEUE_URL={queue-url}
COGNITO_USER_POOL_ID=from-parameter
COGNITO_CLIENT_ID=from-parameter
COGNITO_REGION=us-east-1
JWT_SECRET=from-secret
ALLOWED_ORIGINS=https://app.glassbox.io
```

#### Agent Worker Service

| Property | Staging | Production |
|----------|---------|------------|
| CPU | 512 | 1024 |
| Memory | 1024 MB | 2048 MB |
| Desired Count | 1 | 2 |

**Environment Variables:**
```
WORKER_TYPE=agent
DATABASE_URL=from-secret
REDIS_URL=redis://{endpoint}:6379
AWS_REGION=us-east-1
S3_BUCKET=glassbox-{env}-files
SQS_QUEUE_URL={agent-queue-url}
OPENAI_API_KEY=from-secret
ANTHROPIC_API_KEY=from-secret
DEFAULT_MODEL=gpt-4
```

#### File Worker Service

| Property | Staging | Production |
|----------|---------|------------|
| CPU | 256 | 512 |
| Memory | 512 MB | 1024 MB |
| Desired Count | 1 | 1 |

**Environment Variables:**
```
WORKER_TYPE=file
DATABASE_URL=from-secret
AWS_REGION=us-east-1
S3_BUCKET=glassbox-{env}-files
SQS_QUEUE_URL={file-queue-url}
OPENAI_API_KEY=from-secret
```

### Application Load Balancer

| Property | Value |
|----------|-------|
| Type | Application |
| Scheme | Internet-facing |
| Listeners | HTTP (80) → HTTPS redirect, HTTPS (443) |
| Target Group | API service on port 8080 |
| Health Check | GET /health |
| Idle Timeout | 60 seconds |

### Auto Scaling

```
Target Tracking Policy:
  - CPU Target: 70%
  - Memory Target: 80%
  - Scale In Cooldown: 300s
  - Scale Out Cooldown: 60s
```

---

## 8. Monitoring Stack

**File:** `monitoring-stack.ts`

### CloudWatch Dashboard

**Widgets:**
- API Request Count
- API Latency (p50, p95, p99)
- API Error Rate
- ECS CPU/Memory Utilization
- RDS CPU/Connections/Disk
- Redis Memory/Connections
- SQS Queue Depth
- SQS DLQ Messages

### Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| API 5xx Rate | > 5% for 5 min | SNS notification |
| API Latency p99 | > 5s for 5 min | SNS notification |
| RDS CPU | > 80% for 5 min | SNS notification |
| RDS Connections | > 80% max for 5 min | SNS notification |
| Redis Memory | > 80% for 5 min | SNS notification |
| SQS DLQ | > 0 messages | SNS notification |

### Log Groups

| Log Group | Retention |
|-----------|-----------|
| `/ecs/glassbox-{env}/api` | 30 days |
| `/ecs/glassbox-{env}/agent-worker` | 30 days |
| `/ecs/glassbox-{env}/file-worker` | 30 days |

---

## Secrets Management

### Secrets Manager

| Secret ID | Contents |
|-----------|----------|
| `glassbox/{env}/database` | DB credentials (auto-generated) |
| `glassbox/{env}/llm` | API keys for LLM providers |

**LLM Secret Structure:**
```json
{
  "jwtSecret": "your-jwt-signing-secret",
  "anthropicApiKey": "sk-ant-...",
  "openaiApiKey": "sk-..."
}
```

### Parameter Store

| Parameter | Type | Value |
|-----------|------|-------|
| `/glassbox/{env}/cognito/user-pool-id` | String | User pool ID |
| `/glassbox/{env}/cognito/client-id` | String | Client ID |
| `/glassbox/{env}/cognito/region` | String | us-east-1 |

---

## ECR Repositories

| Repository | Image |
|------------|-------|
| `glassbox-{env}-api` | Go API server |
| `glassbox-{env}-worker` | Python workers |

### Image Tags

- `latest` - Most recent build
- `{git-sha}` - Specific commit
- `{version}` - Release version (e.g., v1.0.0)

---

## Cost Estimate (Staging)

| Service | Monthly Cost (USD) |
|---------|-------------------|
| ECS Fargate (3 services) | ~$50 |
| RDS t3.medium | ~$30 |
| ElastiCache t3.micro | ~$15 |
| NAT Gateway | ~$35 |
| S3 (10 GB) | ~$1 |
| SQS | ~$1 |
| CloudWatch | ~$5 |
| **Total** | **~$137/month** |

---

## Deployment Commands

```bash
# Navigate to infrastructure
cd apps/infrastructure

# Install dependencies
npm install

# Synthesize CloudFormation
npx cdk synth

# Deploy all stacks
npx cdk deploy --all --require-approval never

# Deploy specific stack
npx cdk deploy GlassBox-staging-Compute

# Diff changes
npx cdk diff

# Destroy all (careful!)
npx cdk destroy --all
```
