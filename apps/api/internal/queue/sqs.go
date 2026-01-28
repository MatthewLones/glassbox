package queue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/glassbox/api/internal/config"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// SQSClient wraps the AWS SQS client with helper methods
type SQSClient struct {
	client           *sqs.Client
	agentQueueURL    string
	fileQueueURL     string
	logger           *zap.Logger
}

// NewSQSClient creates a new SQS client configured for the environment
func NewSQSClient(cfg *config.Config, logger *zap.Logger) (*SQSClient, error) {
	ctx := context.Background()

	// Load AWS config
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create SQS client with LocalStack endpoint for development
	var client *sqs.Client
	if cfg.IsDevelopment() {
		// Use LocalStack endpoint
		client = sqs.NewFromConfig(awsCfg, func(o *sqs.Options) {
			o.BaseEndpoint = aws.String("http://localhost:4566")
		})
	} else {
		client = sqs.NewFromConfig(awsCfg)
	}

	return &SQSClient{
		client:        client,
		agentQueueURL: cfg.SQSAgentQueueURL,
		fileQueueURL:  cfg.SQSFileQueueURL,
		logger:        logger,
	}, nil
}

// FileProcessingJob represents a job to process a file
type FileProcessingJob struct {
	FileID      uuid.UUID  `json:"fileId"`
	OrgID       uuid.UUID  `json:"orgId"`
	StorageKey  string     `json:"storageKey"`
	Filename    string     `json:"filename"`
	ContentType string     `json:"contentType"`
	UploadedBy  *uuid.UUID `json:"uploadedBy,omitempty"`
}

// DispatchFileProcessingJob sends a file processing job to the queue
// Accepts any struct that marshals to the expected format (for interface compatibility)
func (s *SQSClient) DispatchFileProcessingJob(ctx context.Context, job any) error {
	// Convert to our internal type if needed
	var fpJob FileProcessingJob
	switch v := job.(type) {
	case FileProcessingJob:
		fpJob = v
	default:
		// Marshal and unmarshal to convert from services.FileProcessingJobMessage
		data, err := json.Marshal(job)
		if err != nil {
			return fmt.Errorf("failed to marshal job: %w", err)
		}
		if err := json.Unmarshal(data, &fpJob); err != nil {
			return fmt.Errorf("failed to unmarshal job: %w", err)
		}
	}

	body, err := json.Marshal(fpJob)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	_, err = s.client.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(s.fileQueueURL),
		MessageBody: aws.String(string(body)),
		MessageAttributes: map[string]types.MessageAttributeValue{
			"JobType": {
				DataType:    aws.String("String"),
				StringValue: aws.String("file_processing"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to send file processing job: %w", err)
	}

	s.logger.Info("Dispatched file processing job",
		zap.String("fileId", fpJob.FileID.String()),
		zap.String("filename", fpJob.Filename),
	)

	return nil
}

// AgentJob represents a job for the agent worker
type AgentJob struct {
	ExecutionID uuid.UUID      `json:"executionId"`
	NodeID      uuid.UUID      `json:"nodeId"`
	OrgID       uuid.UUID      `json:"orgId"`
	OrgConfig   map[string]any `json:"orgConfig,omitempty"`
}

// DispatchAgentJob sends an agent job to the queue
// Accepts any struct that marshals to the expected format (for interface compatibility)
func (s *SQSClient) DispatchAgentJob(ctx context.Context, job any) error {
	// Convert to our internal type if needed
	var agentJob AgentJob
	switch v := job.(type) {
	case AgentJob:
		agentJob = v
	default:
		// Marshal and unmarshal to convert from services.AgentJobMessage
		data, err := json.Marshal(job)
		if err != nil {
			return fmt.Errorf("failed to marshal job: %w", err)
		}
		if err := json.Unmarshal(data, &agentJob); err != nil {
			return fmt.Errorf("failed to unmarshal job: %w", err)
		}
	}

	body, err := json.Marshal(agentJob)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	_, err = s.client.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(s.agentQueueURL),
		MessageBody: aws.String(string(body)),
		MessageAttributes: map[string]types.MessageAttributeValue{
			"JobType": {
				DataType:    aws.String("String"),
				StringValue: aws.String("agent_execution"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to send agent job: %w", err)
	}

	s.logger.Info("Dispatched agent job",
		zap.String("executionId", agentJob.ExecutionID.String()),
		zap.String("nodeId", agentJob.NodeID.String()),
	)

	return nil
}
