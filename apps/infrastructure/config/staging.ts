// Staging environment configuration
export const stagingConfig = {
  environment: 'staging',
  isProduction: false,

  // Network
  network: {
    maxAzs: 2,
    natGateways: 1, // Cost savings in staging
  },

  // Database
  database: {
    instanceType: 'db.t4g.small',
    allocatedStorage: 50,
    maxAllocatedStorage: 100,
    backupRetention: 7,
    deletionProtection: false,
    multiAz: false,
  },

  // Cache
  cache: {
    nodeType: 'cache.t4g.micro',
    numNodes: 1,
  },

  // ECS API Service
  api: {
    cpu: 256,
    memory: 512,
    minCapacity: 1,
    maxCapacity: 4,
    targetCpuUtilization: 70,
  },

  // ECS Agent Worker
  agentWorker: {
    cpu: 512,
    memory: 1024,
    minCapacity: 1,
    maxCapacity: 4,
    targetCpuUtilization: 70,
  },

  // ECS File Worker
  fileWorker: {
    cpu: 256,
    memory: 512,
    minCapacity: 1,
    maxCapacity: 2,
    targetCpuUtilization: 70,
  },

  // Monitoring
  monitoring: {
    alarmEvaluationPeriods: 3,
    cpuThreshold: 80,
    memoryThreshold: 80,
    dbConnectionsThreshold: 80,
    freeStorageThreshold: 10 * 1024 * 1024 * 1024, // 10 GB
  },

  // CloudFront
  cloudfront: {
    priceClass: 'PriceClass_100', // North America and Europe only
  },

  // Tags
  tags: {
    Project: 'GlassBox',
    Environment: 'staging',
    ManagedBy: 'CDK',
  },
};
