# GlassBox Cost Analysis & Pricing Strategy

This document analyzes infrastructure costs at various scales and provides a framework for viable SaaS pricing.

**Last Updated:** 2026-01-28

---

## Table of Contents

1. [Infrastructure Cost Breakdown](#infrastructure-cost-breakdown)
2. [Scaling Scenarios](#scaling-scenarios)
3. [Cost Drivers Analysis](#cost-drivers-analysis)
4. [LLM Costs (The Big Variable)](#llm-costs-the-big-variable)
5. [Pricing Model Options](#pricing-model-options)
6. [Competitive Analysis](#competitive-analysis)
7. [Break-Even Analysis](#break-even-analysis)
8. [Recommendations](#recommendations)

---

## Infrastructure Cost Breakdown

### Current Staging Environment (~10 users)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| **Compute** | | |
| ECS Fargate - API | 0.25 vCPU, 0.5 GB | $9 |
| ECS Fargate - Agent Worker | 0.5 vCPU, 1 GB | $18 |
| ECS Fargate - File Worker | 0.25 vCPU, 0.5 GB | $9 |
| Application Load Balancer | 1 ALB | $18 |
| **Database** | | |
| RDS PostgreSQL | db.t4g.small, 50GB | $30 |
| **Cache** | | |
| ElastiCache Redis | cache.t4g.micro | $12 |
| **Networking** | | |
| NAT Gateway | 1 gateway | $32 |
| Data Transfer | ~10 GB/mo | $1 |
| **Storage** | | |
| S3 | 10 GB stored | $0.23 |
| CloudFront | 10 GB transfer | $1 |
| **Messaging** | | |
| SQS | 100K requests | $0.04 |
| **Auth** | | |
| Cognito | 10 MAU | Free |
| **Monitoring** | | |
| CloudWatch | Logs + metrics | $15 |
| **Total** | | **~$145/month** |

---

## Scaling Scenarios

### Small Team (10-50 users)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| ECS Fargate - API | 0.5 vCPU, 1 GB × 2 | $36 |
| ECS Fargate - Agent Worker | 1 vCPU, 2 GB × 2 | $72 |
| ECS Fargate - File Worker | 0.5 vCPU, 1 GB × 1 | $18 |
| ALB | 1 | $18 |
| RDS PostgreSQL | db.t4g.medium, 100GB | $65 |
| ElastiCache Redis | cache.t4g.small | $25 |
| NAT Gateway | 1 | $32 |
| S3 + CloudFront | 100 GB | $5 |
| SQS | 1M requests | $0.40 |
| Cognito | 50 MAU | Free |
| CloudWatch | | $25 |
| **Total** | | **~$300/month** |
| **Per User** | | **$6-30/user/mo** |

### Medium Company (50-200 users)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| ECS Fargate - API | 1 vCPU, 2 GB × 3 | $162 |
| ECS Fargate - Agent Worker | 2 vCPU, 4 GB × 4 | $288 |
| ECS Fargate - File Worker | 1 vCPU, 2 GB × 2 | $72 |
| ALB | 1 | $22 |
| RDS PostgreSQL | db.r6g.large, 200GB, Multi-AZ | $400 |
| ElastiCache Redis | cache.r6g.large × 2 | $200 |
| NAT Gateway | 2 (HA) | $64 |
| S3 + CloudFront | 500 GB | $20 |
| SQS | 5M requests | $2 |
| Cognito | 200 MAU | Free |
| CloudWatch | | $50 |
| **Total** | | **~$1,280/month** |
| **Per User** | | **$6.40-25.60/user/mo** |

### Large Enterprise (500-2000 users)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| ECS Fargate - API | 2 vCPU, 4 GB × 6 | $648 |
| ECS Fargate - Agent Worker | 4 vCPU, 8 GB × 10 | $1,440 |
| ECS Fargate - File Worker | 2 vCPU, 4 GB × 4 | $288 |
| ALB | 1 (higher LCU) | $50 |
| RDS PostgreSQL | db.r6g.2xlarge, 1TB, Multi-AZ | $1,600 |
| ElastiCache Redis | cache.r6g.xlarge × 3 | $600 |
| NAT Gateway | 3 (multi-AZ) | $96 |
| S3 + CloudFront | 5 TB | $150 |
| SQS | 50M requests | $20 |
| Cognito | 2000 MAU | $110 |
| CloudWatch | | $150 |
| **Total** | | **~$5,150/month** |
| **Per User** | | **$2.58-10.30/user/mo** |

### Massive Scale (10,000+ users)

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| ECS Fargate - API | 4 vCPU, 8 GB × 20 | $4,320 |
| ECS Fargate - Agent Worker | 4 vCPU, 8 GB × 50 | $7,200 |
| ECS Fargate - File Worker | 2 vCPU, 4 GB × 10 | $720 |
| ALB | Multiple | $200 |
| RDS PostgreSQL | db.r6g.4xlarge cluster | $5,000 |
| ElastiCache Redis | Cluster mode, 6 nodes | $2,400 |
| NAT Gateway | 6 | $192 |
| S3 + CloudFront | 50 TB | $1,200 |
| SQS | 500M requests | $200 |
| Cognito | 10,000 MAU | $550 |
| CloudWatch | | $500 |
| Multi-Region (optional) | +50% | +$11,000 |
| **Total** | | **~$22,500/month** |
| **Per User** | | **$2.25/user/mo** |

---

## Cost Drivers Analysis

### What Scales Linearly (Cost Increases with Users)

| Component | Why It Scales | Cost Impact |
|-----------|--------------|-------------|
| **Agent Workers** | More users = more agent executions | HIGH |
| **Database IOPS** | More queries, more writes | MEDIUM |
| **S3 Storage** | More files uploaded | LOW |
| **Data Transfer** | More API calls | LOW |
| **Cognito** | Per monthly active user | LOW |

### What Has Economies of Scale (Gets Cheaper Per User)

| Component | Why It's Fixed/Semi-Fixed | Benefit at Scale |
|-----------|--------------------------|------------------|
| **ALB** | One load balancer serves all | HIGH |
| **NAT Gateway** | Fixed per AZ | MEDIUM |
| **CloudWatch Base** | Dashboard is fixed cost | MEDIUM |
| **RDS Base Instance** | Upgrade tiers, not count | MEDIUM |

### The Hidden Cost Multiplier: LLM API Calls

This is where the real cost variability comes in.

---

## LLM Costs (The Big Variable)

### Cost Per Agent Execution

Based on our end-to-end test (Claude Sonnet, 7 iterations):
- **Tokens In:** ~14,000
- **Tokens Out:** ~2,500
- **Cost:** ~$0.05-0.10 per execution

| Model | Input (per 1M) | Output (per 1M) | Typical Execution |
|-------|---------------|-----------------|-------------------|
| GPT-4 Turbo | $10 | $30 | $0.08-0.15 |
| GPT-4o | $5 | $15 | $0.04-0.08 |
| Claude Sonnet | $3 | $15 | $0.03-0.06 |
| Claude Haiku | $0.25 | $1.25 | $0.005-0.01 |
| GPT-3.5 Turbo | $0.50 | $1.50 | $0.01-0.02 |

### Monthly LLM Costs by Usage Pattern

| Usage Level | Executions/User/Month | Cost/User (Sonnet) | Cost/User (GPT-4o) |
|-------------|----------------------|-------------------|-------------------|
| Light | 10 | $0.50 | $0.60 |
| Moderate | 50 | $2.50 | $3.00 |
| Heavy | 200 | $10.00 | $12.00 |
| Power User | 500 | $25.00 | $30.00 |

### LLM Cost at Scale (1000 users, moderate usage)

```
1000 users × 50 executions × $0.05 = $2,500/month in LLM costs alone
```

**This often exceeds infrastructure costs at scale!**

---

## Pricing Model Options

### Option 1: Per-Seat Pricing (Simple)

| Tier | Price/User/Month | Included | Target |
|------|-----------------|----------|--------|
| **Starter** | $15 | 25 agent runs, 1GB storage | Individuals |
| **Team** | $35 | 100 agent runs, 10GB storage | Small teams |
| **Business** | $65 | 300 agent runs, 50GB storage | Companies |
| **Enterprise** | Custom | Unlimited, dedicated support | Large orgs |

**Pros:** Simple to understand, predictable revenue
**Cons:** Heavy users subsidize light users, may lose power users

### Option 2: Usage-Based Pricing

| Component | Price |
|-----------|-------|
| Base Platform | $10/user/month |
| Agent Execution | $0.10/run |
| Storage | $0.10/GB/month |
| File Processing | $0.05/file |

**Pros:** Fair, scales with value delivered
**Cons:** Unpredictable bills scare customers

### Option 3: Hybrid (Recommended)

| Tier | Base Price | Included Runs | Overage |
|------|-----------|---------------|---------|
| **Starter** | $19/user/mo | 50 runs | $0.15/run |
| **Pro** | $49/user/mo | 200 runs | $0.10/run |
| **Enterprise** | $99/user/mo | 500 runs | $0.08/run |

**Why This Works:**
- Predictable base for budgeting
- Usage limits prevent abuse
- Overage pricing encourages upgrades
- Enterprise gets volume discounts

---

## Competitive Analysis

### Similar Products & Pricing

| Product | Pricing Model | Price Range |
|---------|--------------|-------------|
| **Notion** | Per seat | $8-15/user/mo |
| **Linear** | Per seat | $8-16/user/mo |
| **Figma** | Per editor | $12-45/editor/mo |
| **GitHub Copilot** | Per seat | $10-39/user/mo |
| **Jasper AI** | Usage + seat | $39-59/seat/mo |
| **Copy.ai** | Usage tiers | $36-186/mo |

### GlassBox Positioning

GlassBox is more like **Jasper/Copy.ai** (AI-powered productivity) than **Notion** (pure SaaS):
- AI execution costs are significant
- Value delivered scales with usage
- Enterprise users need more compute

**Recommended positioning:** $25-75/user/month range

---

## Break-Even Analysis

### At $49/user/month (Pro tier)

| Scale | Users | Revenue | Infra Cost | LLM Cost (moderate) | Gross Margin |
|-------|-------|---------|------------|---------------------|--------------|
| Startup | 50 | $2,450 | $300 | $125 | 83% |
| Growth | 200 | $9,800 | $1,280 | $500 | 82% |
| Scale | 1000 | $49,000 | $5,150 | $2,500 | 84% |
| Enterprise | 5000 | $245,000 | $15,000 | $12,500 | 89% |

### Gross Margin Breakdown

```
Revenue:                    $49/user/month
├── Infrastructure:         -$5-10/user (scales down)
├── LLM Costs:             -$2-5/user (based on usage)
├── Payment Processing:     -$1.50/user (3%)
└── Gross Profit:          $32-40/user (65-82%)
```

### Path to Profitability

| Milestone | Users | MRR | Gross Profit | Notes |
|-----------|-------|-----|--------------|-------|
| Ramen Profitable | 100 | $4,900 | $3,500 | Covers 1 founder |
| Seed Stage | 500 | $24,500 | $18,000 | Covers small team |
| Series A | 2,000 | $98,000 | $75,000 | Real business |
| Growth | 10,000 | $490,000 | $400,000 | Category leader |

---

## Cost Optimization Strategies

### For You (Reduce Your Costs)

1. **Reserved Instances**: Save 30-60% on RDS, ElastiCache
   - 1-year reserved: 30% savings
   - 3-year reserved: 60% savings

2. **Spot Instances for Workers**: Agent workers can tolerate interruption
   - 60-90% savings on worker compute
   - Use for non-critical processing queues

3. **Tiered Storage**: Move old files to S3 Glacier
   - Standard: $0.023/GB
   - Glacier: $0.004/GB (83% savings)

4. **Model Routing**: Use cheaper models for simple tasks
   - Haiku for summarization
   - Sonnet for complex reasoning
   - GPT-4 only when needed

5. **Caching**: Cache common RAG queries
   - Reduce embedding API calls
   - Reduce database load

### Projected Savings at Scale

| Optimization | 1000 Users | 10,000 Users |
|--------------|-----------|--------------|
| Reserved Instances | -$1,500/mo | -$8,000/mo |
| Spot for Workers | -$500/mo | -$3,000/mo |
| Smart Model Routing | -$800/mo | -$8,000/mo |
| Caching | -$300/mo | -$2,000/mo |
| **Total Savings** | **-$3,100/mo** | **-$21,000/mo** |

---

## Enterprise Considerations

### What Enterprises Pay For

| Feature | Value | Pricing Impact |
|---------|-------|----------------|
| SSO/SAML | Security requirement | +20-30% |
| Dedicated Instance | Isolation | +50-100% |
| Custom SLA | 99.9%+ uptime | +25% |
| Audit Logs | Compliance | Included in Enterprise |
| Data Residency | EU/Canada hosting | +30% (extra region) |
| Priority Support | 24/7, dedicated | +$500-2000/mo |

### Enterprise Pricing Example

```
Base: $99/user/month × 500 users = $49,500/month

Add-ons:
  SSO Integration:        +$5,000/month
  Dedicated Database:     +$3,000/month
  99.9% SLA:             +$2,000/month
  Priority Support:       +$2,000/month

Total:                    $61,500/month ($123/user)
```

---

## Multi-Tenant vs Dedicated

### Multi-Tenant (Default)

| Pros | Cons |
|------|------|
| Lower cost per user | Noisy neighbor risk |
| Automatic updates | Less customization |
| Shared infrastructure | Data co-mingling concerns |

**Best for:** SMB, startups, cost-conscious enterprises

### Dedicated Instance

| Pros | Cons |
|------|------|
| Full isolation | 2-3x cost |
| Custom configuration | Manual updates |
| Dedicated resources | Ops overhead |

**Best for:** Finance, healthcare, government, large enterprises

### Dedicated Cost Premium

| Scale | Multi-Tenant | Dedicated | Premium |
|-------|-------------|-----------|---------|
| 100 users | $300/mo | $800/mo | 167% |
| 500 users | $1,500/mo | $3,000/mo | 100% |
| 2000 users | $5,000/mo | $8,000/mo | 60% |

---

## Recommendations

### Immediate (Launch Pricing)

1. **Start with simple per-seat pricing**
   - $29/user/month for early adopters
   - Include 100 agent runs
   - Gather usage data

2. **Track metrics obsessively**
   - Runs per user
   - Tokens per run
   - Storage per user
   - Feature usage

3. **Don't underprice**
   - AI value is high
   - LLM costs are real
   - Premium positioning is easier than discount

### Short-term (6-12 months)

1. **Introduce tiers based on data**
   - See actual usage patterns
   - Create tiers that match reality

2. **Add usage-based component**
   - Overage pricing for heavy users
   - Prevents abuse, captures value

3. **Enterprise sales**
   - Custom pricing
   - Annual contracts (better cash flow)

### Long-term (12+ months)

1. **Reserved capacity deals**
   - Annual commits for discounts
   - Predictable revenue

2. **Platform/API pricing**
   - Let others build on GlassBox
   - API call pricing

3. **Marketplace**
   - Template marketplace
   - Revenue share with creators

---

## Summary

### The Math Works

| Scenario | Price | Margin | Verdict |
|----------|-------|--------|---------|
| $29/user | 60-70% | Viable but tight |
| $49/user | 75-82% | Healthy, recommended |
| $99/user (Enterprise) | 85%+ | Excellent |

### Key Takeaways

1. **Infrastructure scales well** - Per-user cost drops from ~$15 → ~$2 at scale
2. **LLM costs are the wildcard** - Can be 20-50% of costs depending on usage
3. **$49/user is the sweet spot** - Competitive, sustainable margins
4. **Enterprise is very profitable** - Dedicated + add-ons = premium pricing
5. **Model routing is critical** - Smart model selection saves 30-50% on LLM

### Viability Assessment

**Is GlassBox viable as an enterprise product?**

✅ **YES** - The unit economics work well:
- 75%+ gross margins at $49/user
- Infrastructure costs decrease per-user at scale
- LLM costs are manageable with smart routing
- Enterprise features command premium pricing
- Competitors in the space are priced $30-100/user

The key success factors:
1. Efficient agent execution (minimize LLM tokens)
2. Smart model routing (right model for the task)
3. Enterprise features (SSO, compliance, support)
4. Usage-based pricing for heavy users
