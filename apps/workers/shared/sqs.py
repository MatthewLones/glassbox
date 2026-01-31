"""SQS consumer and producer utilities."""

import asyncio
import json
from typing import Any, Callable, Optional

import aioboto3
import structlog

from .config import get_settings

logger = structlog.get_logger()


class SQSConsumer:
    """Async SQS message consumer."""

    def __init__(
        self,
        queue_url: str,
        handler: Callable[[dict], Any],
        max_messages: int = 10,
        wait_time_seconds: int = 20,
        visibility_timeout: int = 300,
    ):
        self.queue_url = queue_url
        self.handler = handler
        self.max_messages = max_messages
        self.wait_time_seconds = wait_time_seconds
        self.visibility_timeout = visibility_timeout
        self._running = False
        self._settings = get_settings()

    async def start(self) -> None:
        """Start consuming messages."""
        self._running = True
        session = aioboto3.Session()

        # Build client kwargs - only pass credentials if explicitly set (for local dev)
        client_kwargs = {
            "region_name": self._settings.aws_region,
        }
        if self._settings.aws_endpoint_url:
            client_kwargs["endpoint_url"] = self._settings.aws_endpoint_url
        if self._settings.aws_access_key_id:
            client_kwargs["aws_access_key_id"] = self._settings.aws_access_key_id
        if self._settings.aws_secret_access_key:
            client_kwargs["aws_secret_access_key"] = self._settings.aws_secret_access_key

        async with session.client("sqs", **client_kwargs) as sqs:
            logger.info("Starting SQS consumer", queue_url=self.queue_url)

            while self._running:
                try:
                    response = await sqs.receive_message(
                        QueueUrl=self.queue_url,
                        MaxNumberOfMessages=self.max_messages,
                        WaitTimeSeconds=self.wait_time_seconds,
                        VisibilityTimeout=self.visibility_timeout,
                        MessageAttributeNames=["All"],
                    )

                    messages = response.get("Messages", [])

                    for message in messages:
                        try:
                            body = json.loads(message["Body"])
                            await self.handler(body)

                            # Delete message after successful processing
                            await sqs.delete_message(
                                QueueUrl=self.queue_url,
                                ReceiptHandle=message["ReceiptHandle"],
                            )
                            logger.info(
                                "Message processed successfully",
                                message_id=message["MessageId"],
                            )
                        except Exception as e:
                            logger.error(
                                "Failed to process message",
                                message_id=message["MessageId"],
                                error=str(e),
                            )
                            # Message will become visible again after visibility timeout

                except Exception as e:
                    logger.error("Error receiving messages", error=str(e))
                    await asyncio.sleep(5)  # Back off on error

    def stop(self) -> None:
        """Stop consuming messages."""
        self._running = False
        logger.info("Stopping SQS consumer")


class SQSProducer:
    """SQS message producer."""

    def __init__(self, queue_url: str):
        self.queue_url = queue_url
        self._settings = get_settings()

    async def send(
        self,
        message: dict,
        message_group_id: Optional[str] = None,
        deduplication_id: Optional[str] = None,
    ) -> str:
        """Send a message to the queue."""
        session = aioboto3.Session()

        # Build client kwargs - only pass credentials if explicitly set (for local dev)
        client_kwargs = {
            "region_name": self._settings.aws_region,
        }
        if self._settings.aws_endpoint_url:
            client_kwargs["endpoint_url"] = self._settings.aws_endpoint_url
        if self._settings.aws_access_key_id:
            client_kwargs["aws_access_key_id"] = self._settings.aws_access_key_id
        if self._settings.aws_secret_access_key:
            client_kwargs["aws_secret_access_key"] = self._settings.aws_secret_access_key

        async with session.client("sqs", **client_kwargs) as sqs:
            params = {
                "QueueUrl": self.queue_url,
                "MessageBody": json.dumps(message),
            }

            if message_group_id:
                params["MessageGroupId"] = message_group_id
            if deduplication_id:
                params["MessageDeduplicationId"] = deduplication_id

            response = await sqs.send_message(**params)
            logger.info(
                "Message sent",
                message_id=response["MessageId"],
                queue_url=self.queue_url,
            )
            return response["MessageId"]
