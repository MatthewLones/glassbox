"""S3 client utilities for file storage."""

import json
from datetime import datetime
from typing import Optional, Union
from uuid import UUID, uuid4

import aioboto3
import structlog

from .config import get_settings

logger = structlog.get_logger()


class S3Client:
    """Async S3 client for file operations."""

    def __init__(self, bucket: Optional[str] = None):
        self._settings = get_settings()
        self.bucket = bucket or self._settings.s3_bucket

    def _get_session_config(self) -> dict:
        """Get boto3 session configuration."""
        return {
            "region_name": self._settings.aws_region,
            "endpoint_url": self._settings.aws_endpoint_url,
            "aws_access_key_id": self._settings.aws_access_key_id or "test",
            "aws_secret_access_key": self._settings.aws_secret_access_key or "test",
        }

    async def upload(
        self,
        content: Union[str, bytes, dict],
        key: str,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> str:
        """Upload content to S3.

        Args:
            content: String, bytes, or dict (will be JSON serialized) to upload.
            key: S3 object key (path within bucket).
            content_type: MIME type for the content.
            metadata: Optional metadata to attach to the object.

        Returns:
            The S3 key where the content was stored.
        """
        session = aioboto3.Session()

        # Convert content to bytes
        if isinstance(content, dict):
            body = json.dumps(content, default=str).encode("utf-8")
            content_type = "application/json"
        elif isinstance(content, str):
            body = content.encode("utf-8")
        else:
            body = content

        async with session.client("s3", **self._get_session_config()) as s3:
            put_params = {
                "Bucket": self.bucket,
                "Key": key,
                "Body": body,
                "ContentType": content_type,
            }

            if metadata:
                put_params["Metadata"] = {k: str(v) for k, v in metadata.items()}

            await s3.put_object(**put_params)

            logger.info(
                "Uploaded to S3",
                bucket=self.bucket,
                key=key,
                size=len(body),
                content_type=content_type,
            )

            return key

    async def download(self, key: str) -> bytes:
        """Download content from S3.

        Args:
            key: S3 object key to download.

        Returns:
            The content as bytes.
        """
        session = aioboto3.Session()

        async with session.client("s3", **self._get_session_config()) as s3:
            response = await s3.get_object(Bucket=self.bucket, Key=key)
            body = await response["Body"].read()

            logger.info(
                "Downloaded from S3",
                bucket=self.bucket,
                key=key,
                size=len(body),
            )

            return body

    async def download_json(self, key: str) -> dict:
        """Download and parse JSON content from S3."""
        content = await self.download(key)
        return json.loads(content.decode("utf-8"))

    async def get_presigned_url(
        self,
        key: str,
        expiration: int = 3600,
        method: str = "get_object",
    ) -> str:
        """Generate a presigned URL for the object.

        Args:
            key: S3 object key.
            expiration: URL expiration time in seconds (default 1 hour).
            method: S3 method to presign ('get_object' or 'put_object').

        Returns:
            Presigned URL string.
        """
        session = aioboto3.Session()

        async with session.client("s3", **self._get_session_config()) as s3:
            url = await s3.generate_presigned_url(
                method,
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expiration,
            )
            return url

    async def delete(self, key: str) -> None:
        """Delete an object from S3."""
        session = aioboto3.Session()

        async with session.client("s3", **self._get_session_config()) as s3:
            await s3.delete_object(Bucket=self.bucket, Key=key)
            logger.info("Deleted from S3", bucket=self.bucket, key=key)

    async def exists(self, key: str) -> bool:
        """Check if an object exists in S3."""
        session = aioboto3.Session()

        async with session.client("s3", **self._get_session_config()) as s3:
            try:
                await s3.head_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:
                return False


def generate_output_key(
    org_id: UUID,
    execution_id: UUID,
    output_type: str,
    extension: str = "json",
) -> str:
    """Generate a standardized S3 key for agent outputs.

    Path format: outputs/{org_id}/{execution_id}/{timestamp}_{type}_{uuid}.{ext}

    Args:
        org_id: Organization UUID.
        execution_id: Execution UUID.
        output_type: Type of output (e.g., 'evidence', 'trace', 'result').
        extension: File extension.

    Returns:
        S3 key string.
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid4().hex[:8]
    return f"outputs/{org_id}/{execution_id}/{timestamp}_{output_type}_{unique_id}.{extension}"


def generate_file_key(org_id: UUID, file_id: UUID, filename: str) -> str:
    """Generate a standardized S3 key for uploaded files.

    Path format: files/{org_id}/{file_id}/{filename}
    """
    return f"files/{org_id}/{file_id}/{filename}"
