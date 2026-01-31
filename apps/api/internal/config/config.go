package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Server
	Port        string
	Environment string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// AWS
	AWSRegion          string
	S3Bucket           string
	SQSAgentQueueURL   string
	SQSFileQueueURL    string
	CognitoUserPoolID  string
	CognitoClientID    string
	CognitoRegion      string

	// CORS
	AllowedOrigins []string

	// Rate Limiting
	RateLimitPerMinute int

	// JWT
	JWTSecret string
}

func Load() (*Config, error) {
	// Build database URL from components or use DATABASE_URL directly
	databaseURL := getEnv("DATABASE_URL", "")
	if databaseURL == "" {
		// Construct from individual environment variables (for AWS Secrets Manager)
		dbHost := getEnv("DB_HOST", "localhost")
		dbPort := getEnv("DB_PORT", "5432")
		dbUser := getEnv("DB_USERNAME", "glassbox")
		dbPass := getEnv("DB_PASSWORD", "glassbox_dev")
		dbName := getEnv("DB_NAME", "glassbox")
		sslMode := getEnv("DB_SSLMODE", "require") // Use 'require' for RDS
		databaseURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
			dbUser, dbPass, dbHost, dbPort, dbName, sslMode)
	}

	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		Environment:        getEnv("GO_ENV", "development"),
		DatabaseURL:        databaseURL,
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379"),
		AWSRegion:          getEnv("AWS_REGION", "us-east-1"),
		S3Bucket:           getEnv("S3_BUCKET", "glassbox-files-dev"),
		SQSAgentQueueURL:   getEnv("SQS_AGENT_QUEUE_URL", "http://localhost:4566/000000000000/glassbox-agent-jobs-dev"),
		SQSFileQueueURL:    getEnv("SQS_FILE_QUEUE_URL", "http://localhost:4566/000000000000/glassbox-file-processing-dev"),
		CognitoUserPoolID:  getEnv("COGNITO_USER_POOL_ID", ""),
		CognitoClientID:    getEnv("COGNITO_CLIENT_ID", ""),
		CognitoRegion:      getEnv("COGNITO_REGION", "us-east-1"),
		AllowedOrigins:     strings.Split(getEnv("ALLOWED_ORIGINS", "http://localhost:3000"), ","),
		RateLimitPerMinute: getEnvInt("RATE_LIMIT_PER_MINUTE", 100),
		JWTSecret:          getEnv("JWT_SECRET", "dev-secret-change-in-production"),
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	return nil
}

func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
