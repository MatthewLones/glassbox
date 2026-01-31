"""Shared configuration for all workers."""

from functools import lru_cache
from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Environment
    environment: str = "development"

    # Database - can use DATABASE_URL directly or construct from components
    database_url: Optional[str] = None
    db_host: Optional[str] = None
    db_port: Optional[str] = None
    db_username: Optional[str] = None
    db_password: Optional[str] = None
    db_name: Optional[str] = None

    @model_validator(mode="after")
    def construct_database_url(self) -> "Settings":
        """Construct database_url from components if not provided directly."""
        if self.database_url:
            return self

        # If we have all the DB components, construct the URL
        if all([self.db_host, self.db_port, self.db_username, self.db_password, self.db_name]):
            self.database_url = (
                f"postgresql://{self.db_username}:{self.db_password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        else:
            # Default for local development
            self.database_url = "postgresql://glassbox:glassbox_dev@localhost:5432/glassbox"

        return self

    # Redis
    redis_url: str = "redis://localhost:6379"

    # AWS
    aws_region: str = "us-east-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_endpoint_url: Optional[str] = None  # Set to http://localhost:4566 for LocalStack

    # S3
    s3_bucket: str = "glassbox-files-dev"

    # SQS
    sqs_agent_queue_url: str = "http://localhost:4566/000000000000/glassbox-agent-jobs-dev"
    sqs_file_queue_url: str = "http://localhost:4566/000000000000/glassbox-file-processing-dev"

    # LLM defaults (LiteLLM format - prefix with provider/)
    default_model: str = "anthropic/claude-sonnet-4-20250514"
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
