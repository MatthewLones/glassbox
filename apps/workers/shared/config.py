"""Shared configuration for all workers."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Environment
    environment: str = "development"

    # Database
    database_url: str = "postgresql://glassbox:glassbox_dev@localhost:5432/glassbox"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # AWS
    aws_region: str = "us-east-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_endpoint_url: Optional[str] = "http://localhost:4566"  # LocalStack

    # S3
    s3_bucket: str = "glassbox-files-dev"

    # SQS
    sqs_agent_queue_url: str = "http://localhost:4566/000000000000/glassbox-agent-jobs-dev"
    sqs_file_queue_url: str = "http://localhost:4566/000000000000/glassbox-file-processing-dev"

    # LLM defaults
    default_model: str = "gpt-4-turbo-preview"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    # gRPC
    grpc_port: int = 50051

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
