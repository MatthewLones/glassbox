import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
import { CacheStack } from './cache-stack';
import { StorageStack } from './storage-stack';
import { MessagingStack } from './messaging-stack';
import { AuthStack } from './auth-stack';

export interface ComputeStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  apiSecurityGroup: ec2.ISecurityGroup;
  workerSecurityGroup: ec2.ISecurityGroup;
  database: DatabaseStack;
  cache: CacheStack;
  storage: StorageStack;
  messaging: MessagingStack;
  auth: AuthStack;
  isProduction: boolean;
}

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.ICluster;
  public readonly apiService: ecs.FargateService;
  public readonly agentWorkerService: ecs.FargateService;
  public readonly fileWorkerService: ecs.FargateService;
  public readonly loadBalancer: elbv2.IApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `glassbox-${props.environment}`,
      vpc: props.vpc,
      containerInsights: props.isProduction,
    });

    // ECR Repositories - import existing repositories created outside CDK
    const apiRepo = ecr.Repository.fromRepositoryName(
      this,
      'ApiRepository',
      `glassbox-${props.environment}-api`
    );

    const workerRepo = ecr.Repository.fromRepositoryName(
      this,
      'WorkerRepository',
      `glassbox-${props.environment}-worker`
    );

    // Import existing LLM secret (created outside CDK to prevent deletion on rollback)
    const llmSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'LlmSecret',
      `glassbox/${props.environment}/llm`
    );

    // Task execution role
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `glassbox-${props.environment}-execution`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant secret access to execution role
    props.database.secret.grantRead(executionRole);
    llmSecret.grantRead(executionRole);

    // Task role for API
    const apiTaskRole = new iam.Role(this, 'ApiTaskRole', {
      roleName: `glassbox-${props.environment}-api-task`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant API task role permissions
    props.storage.filesBucket.grantReadWrite(apiTaskRole);
    props.messaging.agentQueue.grantSendMessages(apiTaskRole);
    props.messaging.fileQueue.grantSendMessages(apiTaskRole);

    // Task role for workers
    const workerTaskRole = new iam.Role(this, 'WorkerTaskRole', {
      roleName: `glassbox-${props.environment}-worker-task`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant worker task role permissions
    props.storage.filesBucket.grantReadWrite(workerTaskRole);
    props.messaging.agentQueue.grantConsumeMessages(workerTaskRole);
    props.messaging.fileQueue.grantConsumeMessages(workerTaskRole);

    // Log groups
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/glassbox-${props.environment}/api`,
      retention: props.isProduction
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const workerLogGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/ecs/glassbox-${props.environment}/worker`,
      retention: props.isProduction
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Environment variables shared by all services
    const commonEnv = {
      GO_ENV: props.isProduction ? 'production' : 'staging',
      ENVIRONMENT: props.isProduction ? 'production' : 'staging',
      AWS_REGION: this.region,
      S3_BUCKET: props.storage.filesBucket.bucketName,
      SQS_AGENT_QUEUE_URL: props.messaging.agentQueue.queueUrl,
      SQS_FILE_QUEUE_URL: props.messaging.fileQueue.queueUrl,
      COGNITO_USER_POOL_ID: props.auth.userPool.userPoolId,
      COGNITO_CLIENT_ID: props.auth.userPoolClient.userPoolClientId,
      COGNITO_REGION: this.region,
      REDIS_URL: `redis://${props.cache.redisEndpoint}:${props.cache.redisPort}`,
    };

    // Database secrets - pass individual fields, apps construct connection string
    const dbSecrets = {
      DB_HOST: ecs.Secret.fromSecretsManager(props.database.secret, 'host'),
      DB_PORT: ecs.Secret.fromSecretsManager(props.database.secret, 'port'),
      DB_USERNAME: ecs.Secret.fromSecretsManager(props.database.secret, 'username'),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(props.database.secret, 'password'),
      DB_NAME: ecs.Secret.fromSecretsManager(props.database.secret, 'dbname'),
    };

    // API Task Definition
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      family: `glassbox-${props.environment}-api`,
      cpu: props.isProduction ? 512 : 256,
      memoryLimitMiB: props.isProduction ? 1024 : 512,
      executionRole,
      taskRole: apiTaskRole,
    });

    apiTaskDef.addContainer('api', {
      containerName: 'api',
      image: ecs.ContainerImage.fromEcrRepository(apiRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        ...commonEnv,
        PORT: '8080',
        ALLOWED_ORIGINS: props.isProduction
          ? 'https://app.glassbox.io'
          : 'http://localhost:3000,http://localhost:5173',
      },
      secrets: {
        ...dbSecrets,
        JWT_SECRET: ecs.Secret.fromSecretsManager(llmSecret, 'jwtSecret'),
      },
      portMappings: [{ containerPort: 8080 }],
      healthCheck: {
        // Use GET request (-O /dev/null) instead of HEAD (--spider) for more reliable health checks
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 -O /dev/null http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 5,
        // Increased start period to allow for database, redis, and AWS SDK initialization
        startPeriod: cdk.Duration.seconds(120),
      },
    });

    // Use API security group from Network stack
    const apiSecurityGroup = props.apiSecurityGroup;

    // Application Load Balancer (using security group from Network stack)
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      loadBalancerName: `glassbox-${props.environment}`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
    });

    // API Service
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      serviceName: `glassbox-${props.environment}-api`,
      cluster: this.cluster,
      taskDefinition: apiTaskDef,
      desiredCount: props.isProduction ? 2 : 1,
      securityGroups: [apiSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      circuitBreaker: { rollback: true },
    });

    // ALB Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: `glassbox-${props.environment}-api`,
      vpc: props.vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
      // Increased deregistration delay to allow graceful shutdown
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    this.apiService.attachToApplicationTargetGroup(targetGroup);

    // HTTP Listener (redirect to HTTPS in production)
    const httpListener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      defaultAction: props.isProduction
        ? elbv2.ListenerAction.redirect({
            protocol: 'HTTPS',
            port: '443',
            permanent: true,
          })
        : elbv2.ListenerAction.forward([targetGroup]),
    });

    // Worker Task Definition
    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      family: `glassbox-${props.environment}-worker`,
      cpu: props.isProduction ? 512 : 256,
      memoryLimitMiB: props.isProduction ? 1024 : 512,
      executionRole,
      taskRole: workerTaskRole,
    });

    // Use worker security group from Network stack
    const workerSecurityGroup = props.workerSecurityGroup;

    // Agent Worker container
    workerTaskDef.addContainer('agent-worker', {
      containerName: 'agent-worker',
      image: ecs.ContainerImage.fromEcrRepository(workerRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'agent',
        logGroup: workerLogGroup,
      }),
      command: ['python', '-m', 'agent.worker'],
      environment: {
        ...commonEnv,
        PYTHONUNBUFFERED: '1',
      },
      secrets: {
        ...dbSecrets,
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(llmSecret, 'anthropicApiKey'),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(llmSecret, 'openaiApiKey'),
      },
    });

    // Agent Worker Service
    this.agentWorkerService = new ecs.FargateService(this, 'AgentWorkerService', {
      serviceName: `glassbox-${props.environment}-agent-worker`,
      cluster: this.cluster,
      taskDefinition: workerTaskDef,
      desiredCount: props.isProduction ? 2 : 1,
      securityGroups: [workerSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      circuitBreaker: { rollback: true },
    });

    // File Worker Task Definition
    const fileWorkerTaskDef = new ecs.FargateTaskDefinition(this, 'FileWorkerTaskDef', {
      family: `glassbox-${props.environment}-file-worker`,
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole,
      taskRole: workerTaskRole,
    });

    fileWorkerTaskDef.addContainer('file-worker', {
      containerName: 'file-worker',
      image: ecs.ContainerImage.fromEcrRepository(workerRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'file',
        logGroup: workerLogGroup,
      }),
      command: ['python', '-m', 'file_processor.worker'],
      environment: {
        ...commonEnv,
        PYTHONUNBUFFERED: '1',
      },
      secrets: {
        ...dbSecrets,
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(llmSecret, 'openaiApiKey'),
      },
    });

    // File Worker Service
    this.fileWorkerService = new ecs.FargateService(this, 'FileWorkerService', {
      serviceName: `glassbox-${props.environment}-file-worker`,
      cluster: this.cluster,
      taskDefinition: fileWorkerTaskDef,
      desiredCount: 1,
      securityGroups: [workerSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      circuitBreaker: { rollback: true },
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS name',
      exportName: `${props.environment}-LoadBalancerDns`,
    });

    new cdk.CfnOutput(this, 'ApiRepositoryUri', {
      value: apiRepo.repositoryUri,
      description: 'API ECR repository URI',
      exportName: `${props.environment}-ApiRepositoryUri`,
    });

    new cdk.CfnOutput(this, 'WorkerRepositoryUri', {
      value: workerRepo.repositoryUri,
      description: 'Worker ECR repository URI',
      exportName: `${props.environment}-WorkerRepositoryUri`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster name',
      exportName: `${props.environment}-ClusterName`,
    });
  }
}
