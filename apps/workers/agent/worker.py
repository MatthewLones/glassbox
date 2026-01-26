"""Agent worker - processes agent execution jobs from SQS."""

import asyncio
import signal
import sys
from typing import Any

import structlog

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from shared.config import get_settings
from shared.db import get_db
from shared.sqs import SQSConsumer
from .executor import AgentExecutor

logger = structlog.get_logger()


async def handle_agent_job(message: dict[str, Any]) -> None:
    """Handle an agent execution job."""
    node_id = message.get("node_id")
    execution_id = message.get("execution_id")
    org_config = message.get("org_config", {})

    if not node_id or not execution_id:
        logger.error("Invalid message: missing node_id or execution_id")
        return

    logger.info(
        "Processing agent job",
        node_id=node_id,
        execution_id=execution_id,
    )

    try:
        db = await get_db()
        executor = AgentExecutor(db, node_id, execution_id, org_config)
        await executor.run()

        logger.info(
            "Agent job completed",
            node_id=node_id,
            execution_id=execution_id,
        )
    except Exception as e:
        logger.error(
            "Agent job failed",
            node_id=node_id,
            execution_id=execution_id,
            error=str(e),
        )
        # Update execution status to failed
        db = await get_db()
        await db.execute(
            """
            UPDATE agent_executions
            SET status = 'failed', error_message = $1, completed_at = NOW()
            WHERE id = $2
            """,
            str(e),
            execution_id,
        )
        raise


async def main() -> None:
    """Main entry point for the agent worker."""
    settings = get_settings()

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    )

    logger.info("Starting agent worker", queue_url=settings.sqs_agent_queue_url)

    consumer = SQSConsumer(
        queue_url=settings.sqs_agent_queue_url,
        handler=handle_agent_job,
        visibility_timeout=600,  # 10 minutes for agent jobs
    )

    # Handle graceful shutdown
    loop = asyncio.get_event_loop()

    def shutdown():
        logger.info("Received shutdown signal")
        consumer.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown)

    try:
        await consumer.start()
    except asyncio.CancelledError:
        logger.info("Worker cancelled")
    finally:
        from shared.db import db
        await db.disconnect()
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
