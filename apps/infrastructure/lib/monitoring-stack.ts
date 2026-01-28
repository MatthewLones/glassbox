import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { ComputeStack } from './compute-stack';
import { DatabaseStack } from './database-stack';
import { CacheStack } from './cache-stack';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  compute: ComputeStack;
  database: DatabaseStack;
  cache: CacheStack;
  isProduction: boolean;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `glassbox-${props.environment}-alarms`,
      displayName: `GlassBox ${props.environment} Alarms`,
    });

    // API Service Alarms
    const apiCpuAlarm = new cloudwatch.Alarm(this, 'ApiCpuAlarm', {
      alarmName: `glassbox-${props.environment}-api-cpu`,
      alarmDescription: 'API service CPU utilization is high',
      metric: props.compute.apiService.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiCpuAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    const apiMemoryAlarm = new cloudwatch.Alarm(this, 'ApiMemoryAlarm', {
      alarmName: `glassbox-${props.environment}-api-memory`,
      alarmDescription: 'API service memory utilization is high',
      metric: props.compute.apiService.metricMemoryUtilization(),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiMemoryAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // Database Alarms
    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DbCpuAlarm', {
      alarmName: `glassbox-${props.environment}-db-cpu`,
      alarmDescription: 'Database CPU utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBInstanceIdentifier: `glassbox-${props.environment}`,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbCpuAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DbConnectionsAlarm', {
      alarmName: `glassbox-${props.environment}-db-connections`,
      alarmDescription: 'Database connections are high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: `glassbox-${props.environment}`,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: props.isProduction ? 150 : 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbConnectionsAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    const dbStorageAlarm = new cloudwatch.Alarm(this, 'DbStorageAlarm', {
      alarmName: `glassbox-${props.environment}-db-storage`,
      alarmDescription: 'Database free storage is low',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'FreeStorageSpace',
        dimensionsMap: {
          DBInstanceIdentifier: `glassbox-${props.environment}`,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10 * 1024 * 1024 * 1024, // 10 GB
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbStorageAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `glassbox-${props.environment}`,
    });

    // API Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# GlassBox ${props.environment} - API Services`,
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API CPU Utilization',
        left: [props.compute.apiService.metricCpuUtilization()],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Memory Utilization',
        left: [props.compute.apiService.metricMemoryUtilization()],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Task Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ClusterName: props.compute.cluster.clusterName,
              ServiceName: props.compute.apiService.serviceName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
        height: 6,
      })
    );

    // Worker Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# GlassBox ${props.environment} - Worker Services`,
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Agent Worker CPU',
        left: [props.compute.agentWorkerService.metricCpuUtilization()],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Agent Worker Memory',
        left: [props.compute.agentWorkerService.metricMemoryUtilization()],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'File Worker CPU',
        left: [props.compute.fileWorkerService.metricCpuUtilization()],
        width: 8,
        height: 6,
      })
    );

    // Database Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# GlassBox ${props.environment} - Database`,
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Database CPU',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              DBInstanceIdentifier: `glassbox-${props.environment}`,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Connections',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensionsMap: {
              DBInstanceIdentifier: `glassbox-${props.environment}`,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Free Storage',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'FreeStorageSpace',
            dimensionsMap: {
              DBInstanceIdentifier: `glassbox-${props.environment}`,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 8,
        height: 6,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'Alarm SNS topic ARN',
      exportName: `${props.environment}-AlarmTopicArn`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
