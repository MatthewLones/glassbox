// Production environment configuration
export const productionConfig = {
  environment: 'production',
  isProduction: true,

  // Network
  network: {
    maxAzs: 3,
    natGateways: 2, // High availability
  },

  // Database
  database: {
    instanceType: 'db.r6g.large',
    allocatedStorage: 100,
    maxAllocatedStorage: 500,
    backupRetention: 30,
    deletionProtection: true,
    multiAz: true,
  },

  // Cache
  cache: {
    nodeType: 'cache.r6g.large',
    numNodes: 2, // Primary + replica
  },

  // ECS API Service
  api: {
    cpu: 1024,
    memory: 2048,
    minCapacity: 2,
    maxCapacity: 20,
    targetCpuUtilization: 60,
  },

  // ECS Agent Worker
  agentWorker: {
    cpu: 1024,
    memory: 2048,
    minCapacity: 2,
    maxCapacity: 20,
    targetCpuUtilization: 60,
  },

  // ECS File Worker
  fileWorker: {
    cpu: 512,
    memory: 1024,
    minCapacity: 2,
    maxCapacity: 10,
    targetCpuUtilization: 60,
  },

  // Monitoring
  monitoring: {
    alarmEvaluationPeriods: 2, // Faster alerting in prod
    cpuThreshold: 70,
    memoryThreshold: 70,
    dbConnectionsThreshold: 150,
    freeStorageThreshold: 20 * 1024 * 1024 * 1024, // 20 GB
  },

  // CloudFront
  cloudfront: {
    priceClass: 'PriceClass_All', // Global distribution
  },

  // Tags
  tags: {
    Project: 'GlassBox',
    Environment: 'production',
    ManagedBy: 'CDK',
  },
};
