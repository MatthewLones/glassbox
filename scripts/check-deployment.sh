#!/bin/bash
# Check deployment status

echo "Checking CloudFormation stack status..."
aws cloudformation describe-stacks --stack-name GlassBox-staging-Compute --region us-east-1 --query 'Stacks[0].StackStatus' --output text 2>&1

echo "Checking ECR image..."
aws ecr describe-images --repository-name glassbox-staging-api --region us-east-1 --query 'imageDetails[0].imagePushedAt' --output text 2>&1

echo "Done"
