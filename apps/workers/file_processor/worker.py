"""File processor worker - extracts text and generates embeddings."""

import asyncio
import signal
import sys
from typing import Any

import structlog

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from shared.config import get_settings
from shared.db import get_db
from shared.sqs import SQSConsumer

logger = structlog.get_logger()


async def process_file(file_id: str) -> None:
    """Process a file: extract text and generate embeddings."""
    db = await get_db()

    # Get file info
    file = await db.fetchrow(
        "SELECT * FROM files WHERE id = $1",
        file_id,
    )

    if not file:
        logger.error("File not found", file_id=file_id)
        return

    logger.info(
        "Processing file",
        file_id=file_id,
        filename=file["filename"],
        content_type=file["content_type"],
    )

    try:
        # Update status to processing
        await db.execute(
            "UPDATE files SET processing_status = 'processing' WHERE id = $1",
            file_id,
        )

        # Extract text based on content type
        content_type = file["content_type"] or ""
        extracted_text = ""

        if "pdf" in content_type:
            extracted_text = await extract_pdf(file)
        elif "word" in content_type or "docx" in content_type:
            extracted_text = await extract_docx(file)
        elif "text" in content_type:
            extracted_text = await extract_text(file)
        elif "image" in content_type:
            extracted_text = await extract_image_ocr(file)
        else:
            logger.warning(
                "Unsupported content type",
                content_type=content_type,
                file_id=file_id,
            )

        # Generate embedding
        embedding = None
        if extracted_text:
            embedding = await generate_embedding(extracted_text)

        # Update file record
        if embedding:
            await db.execute(
                """
                UPDATE files
                SET processing_status = 'complete',
                    extracted_text = $1,
                    embedding = $2
                WHERE id = $3
                """,
                extracted_text[:50000],  # Limit text size
                embedding,
                file_id,
            )
        else:
            await db.execute(
                """
                UPDATE files
                SET processing_status = 'complete',
                    extracted_text = $1
                WHERE id = $2
                """,
                extracted_text[:50000],
                file_id,
            )

        logger.info(
            "File processed successfully",
            file_id=file_id,
            text_length=len(extracted_text),
            has_embedding=embedding is not None,
        )

    except Exception as e:
        logger.error("File processing failed", file_id=file_id, error=str(e))
        await db.execute(
            """
            UPDATE files
            SET processing_status = 'failed',
                processing_error = $1
            WHERE id = $2
            """,
            str(e),
            file_id,
        )
        raise


async def extract_pdf(file: dict) -> str:
    """Extract text from PDF using unstructured."""
    # TODO: Download from S3 and process
    # For now, return placeholder
    return f"[PDF content from {file['filename']}]"


async def extract_docx(file: dict) -> str:
    """Extract text from Word document."""
    return f"[DOCX content from {file['filename']}]"


async def extract_text(file: dict) -> str:
    """Extract text from plain text file."""
    return f"[Text content from {file['filename']}]"


async def extract_image_ocr(file: dict) -> str:
    """Extract text from image using OCR."""
    return f"[OCR content from {file['filename']}]"


async def generate_embedding(text: str) -> list[float]:
    """Generate embedding using OpenAI."""
    from litellm import aembedding

    settings = get_settings()

    # Truncate text if too long
    max_chars = 8000
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        response = await aembedding(
            model="text-embedding-ada-002",
            input=text,
            api_key=settings.openai_api_key,
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error("Embedding generation failed", error=str(e))
        return None


async def handle_file_job(message: dict[str, Any]) -> None:
    """Handle a file processing job."""
    file_id = message.get("file_id")
    action = message.get("action", "process")

    if not file_id:
        logger.error("Invalid message: missing file_id")
        return

    if action == "process":
        await process_file(file_id)
    else:
        logger.warning("Unknown action", action=action)


async def main() -> None:
    """Main entry point for the file processor worker."""
    settings = get_settings()

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    )

    logger.info("Starting file processor worker", queue_url=settings.sqs_file_queue_url)

    consumer = SQSConsumer(
        queue_url=settings.sqs_file_queue_url,
        handler=handle_file_job,
        visibility_timeout=300,  # 5 minutes for file processing
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
