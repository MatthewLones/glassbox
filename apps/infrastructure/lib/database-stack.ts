import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.IVpc;
  isProduction: boolean;
}

export class DatabaseStack extends cdk.Stack {
  public readonly instance: rds.IDatabaseInstance;
  public readonly secret: secretsmanager.ISecret;
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Security Group for Database
    this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `glassbox-${props.environment}-db-sg`,
      description: 'Security group for GlassBox database',
      allowAllOutbound: false,
    });

    // Generate database credentials
    this.secret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `glassbox/${props.environment}/database`,
      description: 'GlassBox database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'glassbox' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Database instance configuration
    const instanceType = props.isProduction
      ? ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE)
      : ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL);

    // Create RDS PostgreSQL instance
    // Note: pgvector extension needs to be enabled via SQL after instance creation
    this.instance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `glassbox-${props.environment}`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_1,
      }),
      instanceType,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      credentials: rds.Credentials.fromSecret(this.secret),
      databaseName: 'glassbox',
      allocatedStorage: props.isProduction ? 100 : 20,
      maxAllocatedStorage: props.isProduction ? 500 : 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: props.isProduction,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(props.isProduction ? 30 : 7),
      deletionProtection: props.isProduction,
      removalPolicy: props.isProduction
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      enablePerformanceInsights: props.isProduction,
      performanceInsightRetention: props.isProduction
        ? rds.PerformanceInsightRetention.MONTHS_1
        : undefined,
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      parameterGroup: new rds.ParameterGroup(this, 'ParameterGroup', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_16_1,
        }),
        parameters: {
          // Enable pgvector extension
          'shared_preload_libraries': 'pg_stat_statements',
          // Performance tuning
          'max_connections': props.isProduction ? '200' : '100',
          'work_mem': '64MB',
          'maintenance_work_mem': '256MB',
        },
      }),
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.instance.instanceEndpoint.hostname,
      description: 'Database endpoint',
      exportName: `${props.environment}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.instance.instanceEndpoint.port.toString(),
      description: 'Database port',
      exportName: `${props.environment}-DatabasePort`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.secret.secretArn,
      description: 'Database secret ARN',
      exportName: `${props.environment}-DatabaseSecretArn`,
    });
  }
}
