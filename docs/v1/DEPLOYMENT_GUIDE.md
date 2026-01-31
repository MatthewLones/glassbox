# GlassBox Deployment Guide v1

Step-by-step guide to deploy GlassBox from scratch.

## Prerequisites

### Required Tools

| Tool | Version | Installation |
|------|---------|--------------|
| AWS CLI | 2.x | `brew install awscli` |
| Node.js | 18+ | `brew install node` |
| Docker | 20+ | Download from docker.com |
| Go | 1.22+ | `brew install go` |
| Python | 3.11+ | `brew install python` |
| pnpm | 8+ | `npm install -g pnpm` |

### AWS Account Setup

1. **Create AWS Account** at aws.amazon.com
2. **Create IAM User** with programmatic access
3. **Attach Policies**:
   - AdministratorAccess (or specific policies below)

4. **Configure CLI**:
```bash
aws configure
# Enter Access Key ID
# Enter Secret Access Key
# Enter region: us-east-1
# Enter output format: json
```

5. **Verify Access**:
```bash
aws sts get-caller-identity
```

---

## Step 1: Clone Repository

```bash
git clone https://github.com/your-org/glassbox.git
cd glassbox
```

---

## Step 2: Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Install Go dependencies
cd apps/api
go mod download
cd ../..

# Install Python dependencies
cd apps/workers
pip install -r requirements.txt
cd ../..

# Install CDK dependencies
cd apps/infrastructure
npm install
cd ../..
```

---

## Step 3: Bootstrap CDK

First-time CDK setup for your AWS account:

```bash
cd apps/infrastructure

# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Replace ACCOUNT_ID with your AWS account number
# Find it with: aws sts get-caller-identity --query Account --output text
```

---

## Step 4: Create Secrets

### LLM API Keys

Create the LLM secret with your API keys:

```bash
aws secretsmanager create-secret \
  --name glassbox/staging/llm \
  --secret-string '{
    "jwtSecret": "your-jwt-secret-min-32-chars",
    "anthropicApiKey": "sk-ant-...",
    "openaiApiKey": "sk-..."
  }' \
  --region us-east-1
```

**Generate a secure JWT secret:**
```bash
openssl rand -base64 32
```

---

## Step 5: Build Docker Images

### Login to ECR

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
```

### Create ECR Repositories

```bash
aws ecr create-repository --repository-name glassbox-staging-api --region us-east-1
aws ecr create-repository --repository-name glassbox-staging-worker --region us-east-1
```

### Build and Push API Image

```bash
cd apps/api

# Build for Linux/AMD64 (required for Fargate)
docker build --platform linux/amd64 -t glassbox-staging-api:latest .

# Tag for ECR
docker tag glassbox-staging-api:latest \
  ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/glassbox-staging-api:latest

# Push
docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/glassbox-staging-api:latest

cd ../..
```

### Build and Push Worker Image

```bash
cd apps/workers

# Build for Linux/AMD64
docker build --platform linux/amd64 -t glassbox-staging-worker:latest .

# Tag for ECR
docker tag glassbox-staging-worker:latest \
  ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/glassbox-staging-worker:latest

# Push
docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/glassbox-staging-worker:latest

cd ../..
```

---

## Step 6: Deploy Infrastructure

### Synthesize CloudFormation

```bash
cd apps/infrastructure

# Verify templates compile
npx cdk synth
```

### Deploy All Stacks

```bash
# Deploy everything (takes 15-25 minutes)
npx cdk deploy --all --require-approval never
```

**Stack deployment order (automatic):**
1. Network (VPC, Security Groups) ~3 min
2. Database (RDS PostgreSQL) ~10 min
3. Cache (ElastiCache Redis) ~5 min
4. Storage (S3) ~1 min
5. Messaging (SQS) ~1 min
6. Auth (Cognito) ~2 min
7. Compute (ECS Services) ~5 min
8. Monitoring (CloudWatch) ~1 min

---

## Step 7: Verify Deployment

### Check Stack Status

```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?contains(StackName,'GlassBox')].{Name:StackName,Status:StackStatus}" \
  --output table
```

### Check ECS Services

```bash
aws ecs describe-services \
  --cluster glassbox-staging \
  --services glassbox-staging-api glassbox-staging-agent-worker glassbox-staging-file-worker \
  --query "services[].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount}" \
  --output table
```

### Get Load Balancer URL

```bash
aws cloudformation describe-stacks \
  --stack-name GlassBox-staging-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDns'].OutputValue" \
  --output text
```

### Test API Health

```bash
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name GlassBox-staging-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDns'].OutputValue" \
  --output text)

curl "http://${ALB_DNS}/health"
# Should return: {"status":"healthy","service":"glassbox-api"}
```

---

## Step 8: Run E2E Tests

```bash
# From repository root
./scripts/e2e-tests.sh --api-url "http://${ALB_DNS}"
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | Secrets Manager |
| `REDIS_URL` | Redis connection string | CDK outputs |
| `AWS_REGION` | AWS region | CDK |
| `S3_BUCKET` | S3 bucket name | CDK outputs |
| `SQS_AGENT_QUEUE_URL` | Agent queue URL | CDK outputs |
| `SQS_FILE_QUEUE_URL` | File queue URL | CDK outputs |
| `COGNITO_USER_POOL_ID` | Cognito pool ID | CDK outputs |
| `COGNITO_CLIENT_ID` | Cognito client ID | CDK outputs |
| `JWT_SECRET` | JWT signing secret | Secrets Manager |
| `OPENAI_API_KEY` | OpenAI API key | Secrets Manager |
| `ANTHROPIC_API_KEY` | Anthropic API key | Secrets Manager |

---

## Updating Deployment

### Update API

```bash
# Rebuild and push
cd apps/api
docker build --platform linux/amd64 -t glassbox-staging-api:latest .
docker tag glassbox-staging-api:latest ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/glassbox-staging-api:latest
docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/glassbox-staging-api:latest

# Force ECS to pull new image
aws ecs update-service \
  --cluster glassbox-staging \
  --service glassbox-staging-api \
  --force-new-deployment
```

### Update Infrastructure

```bash
cd apps/infrastructure
npx cdk diff  # Preview changes
npx cdk deploy --all
```

---

## Monitoring

### View Logs

```bash
# API logs
aws logs tail /ecs/glassbox-staging/api --follow

# Agent worker logs
aws logs tail /ecs/glassbox-staging/agent-worker --follow

# File worker logs
aws logs tail /ecs/glassbox-staging/file-worker --follow
```

### CloudWatch Dashboard

Access the dashboard at:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=GlassBox-staging
```

---

## Troubleshooting

### ECS Tasks Not Starting

```bash
# Check task failures
aws ecs describe-tasks \
  --cluster glassbox-staging \
  --tasks $(aws ecs list-tasks --cluster glassbox-staging --query 'taskArns[0]' --output text)
```

Common issues:
- **Image pull error**: Check ECR repository exists and image is pushed
- **Secret not found**: Verify secrets exist in Secrets Manager
- **Health check failing**: Check container logs

### Database Connection Issues

```bash
# Verify RDS is running
aws rds describe-db-instances \
  --db-instance-identifier glassbox-staging \
  --query 'DBInstances[0].DBInstanceStatus'
```

Common issues:
- **Security group**: Ensure ECS security group can access RDS
- **Credentials**: Verify DATABASE_URL secret is correct

### Redis Connection Issues

```bash
# Check ElastiCache
aws elasticache describe-cache-clusters \
  --cache-cluster-id glassbox-staging \
  --query 'CacheClusters[0].CacheClusterStatus'
```

---

## Cleanup

### Destroy All Resources

```bash
cd apps/infrastructure

# Destroy all stacks (careful - this deletes everything!)
npx cdk destroy --all

# Manually delete:
# 1. ECR repositories (if they contain images)
# 2. S3 buckets (if they contain files)
# 3. Secrets Manager secrets
```

### Delete Specific Resources

```bash
# Delete secrets
aws secretsmanager delete-secret --secret-id glassbox/staging/llm --force-delete-without-recovery

# Delete ECR repos
aws ecr delete-repository --repository-name glassbox-staging-api --force
aws ecr delete-repository --repository-name glassbox-staging-worker --force
```

---

## Production Considerations

### Before Going Live

1. **Domain & SSL**
   - Register domain
   - Create ACM certificate
   - Configure Route53

2. **Security**
   - Enable WAF
   - Review security groups
   - Enable VPC Flow Logs

3. **Scaling**
   - Configure auto-scaling policies
   - Set up multi-AZ RDS
   - Add Redis replicas

4. **Monitoring**
   - Set up CloudWatch alarms
   - Configure SNS notifications
   - Enable X-Ray tracing

5. **Backup**
   - Enable RDS automated backups
   - Configure S3 versioning
   - Set up cross-region replication

---

## Support

For issues:
1. Check CloudWatch logs
2. Review this guide
3. Check `docs/v1/` documentation
4. Open GitHub issue
