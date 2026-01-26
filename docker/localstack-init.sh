#!/bin/bash

echo "Initializing LocalStack resources..."

# Create S3 bucket for file uploads
awslocal s3 mb s3://glassbox-files-dev

# Create SQS queues
awslocal sqs create-queue --queue-name glassbox-agent-jobs-dev
awslocal sqs create-queue --queue-name glassbox-file-processing-dev
awslocal sqs create-queue --queue-name glassbox-notifications-dev

# Create dead letter queues
awslocal sqs create-queue --queue-name glassbox-agent-jobs-dlq-dev
awslocal sqs create-queue --queue-name glassbox-file-processing-dlq-dev

echo "LocalStack initialization complete!"
