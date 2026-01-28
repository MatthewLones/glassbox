import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface MessagingStackProps extends cdk.StackProps {
  environment: string;
}

export class MessagingStack extends cdk.Stack {
  public readonly agentQueue: sqs.IQueue;
  public readonly agentDeadLetterQueue: sqs.IQueue;
  public readonly fileQueue: sqs.IQueue;
  public readonly fileDeadLetterQueue: sqs.IQueue;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, props);

    // Dead letter queue for agent jobs
    this.agentDeadLetterQueue = new sqs.Queue(this, 'AgentDeadLetterQueue', {
      queueName: `glassbox-${props.environment}-agent-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Agent jobs queue
    this.agentQueue = new sqs.Queue(this, 'AgentQueue', {
      queueName: `glassbox-${props.environment}-agent-jobs`,
      visibilityTimeout: cdk.Duration.minutes(15), // Long timeout for LLM processing
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.agentDeadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Dead letter queue for file processing
    this.fileDeadLetterQueue = new sqs.Queue(this, 'FileDeadLetterQueue', {
      queueName: `glassbox-${props.environment}-file-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // File processing queue
    this.fileQueue = new sqs.Queue(this, 'FileQueue', {
      queueName: `glassbox-${props.environment}-file-jobs`,
      visibilityTimeout: cdk.Duration.minutes(5), // File processing timeout
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.fileDeadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'AgentQueueUrl', {
      value: this.agentQueue.queueUrl,
      description: 'Agent jobs queue URL',
      exportName: `${props.environment}-AgentQueueUrl`,
    });

    new cdk.CfnOutput(this, 'AgentQueueArn', {
      value: this.agentQueue.queueArn,
      description: 'Agent jobs queue ARN',
      exportName: `${props.environment}-AgentQueueArn`,
    });

    new cdk.CfnOutput(this, 'FileQueueUrl', {
      value: this.fileQueue.queueUrl,
      description: 'File jobs queue URL',
      exportName: `${props.environment}-FileQueueUrl`,
    });

    new cdk.CfnOutput(this, 'FileQueueArn', {
      value: this.fileQueue.queueArn,
      description: 'File jobs queue ARN',
      exportName: `${props.environment}-FileQueueArn`,
    });
  }
}
