import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface CacheStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.IVpc;
}

export class CacheStack extends cdk.Stack {
  public readonly cluster: elasticache.CfnCacheCluster;
  public readonly securityGroup: ec2.ISecurityGroup;
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    // Security Group for Redis
    this.securityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `glassbox-${props.environment}-cache-sg`,
      description: 'Security group for GlassBox Redis cache',
      allowAllOutbound: false,
    });

    // Create subnet group for ElastiCache
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'SubnetGroup', {
      subnetGroupName: `glassbox-${props.environment}-cache-subnets`,
      description: 'Subnet group for GlassBox Redis cache',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
    });

    // Create Redis cluster
    this.cluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      clusterName: `glassbox-${props.environment}`,
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: 'cache.t4g.micro', // Small for staging, upgrade for production
      numCacheNodes: 1,
      port: 6379,
      vpcSecurityGroupIds: [this.securityGroup.securityGroupId],
      cacheSubnetGroupName: subnetGroup.ref,
      autoMinorVersionUpgrade: true,
      snapshotRetentionLimit: 7,
    });

    this.cluster.addDependency(subnetGroup);

    // Store endpoint for reference
    this.endpoint = `${this.cluster.attrRedisEndpointAddress}:${this.cluster.attrRedisEndpointPort}`;

    // Outputs
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.cluster.attrRedisEndpointAddress,
      description: 'Redis endpoint',
      exportName: `${props.environment}-RedisEndpoint`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.cluster.attrRedisEndpointPort,
      description: 'Redis port',
      exportName: `${props.environment}-RedisPort`,
    });
  }
}
