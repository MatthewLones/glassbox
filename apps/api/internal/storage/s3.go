package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/glassbox/api/internal/config"
	"go.uber.org/zap"
)

// S3Client wraps the AWS S3 client with helper methods
type S3Client struct {
	client       *s3.Client
	presignClient *s3.PresignClient
	bucket       string
	logger       *zap.Logger
}

// NewS3Client creates a new S3 client configured for the environment
func NewS3Client(cfg *config.Config, logger *zap.Logger) (*S3Client, error) {
	ctx := context.Background()

	// Load AWS config
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client with LocalStack endpoint for development
	var client *s3.Client
	if cfg.IsDevelopment() {
		// Use LocalStack endpoint
		client = s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			o.BaseEndpoint = aws.String("http://localhost:4566")
			o.UsePathStyle = true // Required for LocalStack
		})
	} else {
		client = s3.NewFromConfig(awsCfg)
	}

	presignClient := s3.NewPresignClient(client)

	return &S3Client{
		client:       client,
		presignClient: presignClient,
		bucket:       cfg.S3Bucket,
		logger:       logger,
	}, nil
}

// PresignedUploadURL generates a presigned URL for uploading a file
func (s *S3Client) PresignedUploadURL(ctx context.Context, key, contentType string, expiration time.Duration) (string, error) {
	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiration))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned upload URL: %w", err)
	}

	return req.URL, nil
}

// PresignedDownloadURL generates a presigned URL for downloading a file
func (s *S3Client) PresignedDownloadURL(ctx context.Context, key string, expiration time.Duration) (string, error) {
	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiration))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned download URL: %w", err)
	}

	return req.URL, nil
}

// HeadObject checks if an object exists and returns its size in bytes
func (s *S3Client) HeadObject(ctx context.Context, key string) (int64, error) {
	output, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return 0, fmt.Errorf("failed to head object: %w", err)
	}

	var size int64
	if output.ContentLength != nil {
		size = *output.ContentLength
	}
	return size, nil
}

// DeleteObject deletes an object from S3
func (s *S3Client) DeleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}
	return nil
}

// Bucket returns the configured bucket name
func (s *S3Client) Bucket() string {
	return s.bucket
}
