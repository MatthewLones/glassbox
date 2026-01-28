import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  environment: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly apiSecurityGroup: ec2.ISecurityGroup;
  public readonly workerSecurityGroup: ec2.ISecurityGroup;
  public readonly databaseSecurityGroup: ec2.ISecurityGroup;
  public readonly cacheSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'VPC', {
      vpcName: `glassbox-${props.environment}-vpc`,
      maxAzs: 2,
      natGateways: 1, // Single NAT for cost savings in staging
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Group for API/WebSocket services
    this.apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `glassbox-${props.environment}-api-sg`,
      description: 'Security group for GlassBox API services',
      allowAllOutbound: true,
    });

    // Allow inbound HTTP/HTTPS from anywhere (via ALB)
    this.apiSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      'Allow HTTP traffic'
    );

    // Security Group for Workers
    this.workerSecurityGroup = new ec2.SecurityGroup(this, 'WorkerSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `glassbox-${props.environment}-worker-sg`,
      description: 'Security group for GlassBox worker services',
      allowAllOutbound: true,
    });

    // Security Group for Database
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `glassbox-${props.environment}-db-sg`,
      description: 'Security group for GlassBox database',
      allowAllOutbound: false,
    });

    // Allow PostgreSQL from API and Workers
    this.databaseSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from API'
    );
    this.databaseSecurityGroup.addIngressRule(
      this.workerSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from Workers'
    );

    // Security Group for Cache
    this.cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `glassbox-${props.environment}-cache-sg`,
      description: 'Security group for GlassBox cache',
      allowAllOutbound: false,
    });

    // Allow Redis from API and Workers
    this.cacheSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from API'
    );
    this.cacheSecurityGroup.addIngressRule(
      this.workerSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis from Workers'
    );

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${props.environment}-VpcId`,
    });
  }
}
