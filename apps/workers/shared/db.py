"""Database connection and utilities."""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import asyncpg
from asyncpg import Pool

from .config import get_settings


class Database:
    """Async database connection pool."""

    def __init__(self):
        self._pool: Optional[Pool] = None
        self._settings = get_settings()

    async def connect(self) -> None:
        """Initialize the connection pool."""
        if self._pool is None:
            async def init_connection(conn):
                # Set search_path to include glassbox schema
                await conn.execute("SET search_path TO glassbox, public")

            self._pool = await asyncpg.create_pool(
                self._settings.database_url,
                min_size=5,
                max_size=20,
                command_timeout=60,
                init=init_connection,
            )

    async def disconnect(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a connection from the pool."""
        if self._pool is None:
            await self.connect()
        async with self._pool.acquire() as conn:
            yield conn

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Acquire a connection and start a transaction."""
        async with self.acquire() as conn:
            async with conn.transaction():
                yield conn

    async def execute(self, query: str, *args) -> str:
        """Execute a query."""
        async with self.acquire() as conn:
            return await conn.execute(query, *args)

    async def fetch(self, query: str, *args) -> list:
        """Fetch multiple rows."""
        async with self.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args) -> Optional[asyncpg.Record]:
        """Fetch a single row."""
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        """Fetch a single value."""
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args)


# Global database instance
db = Database()


async def get_db() -> Database:
    """Get the database instance."""
    if db._pool is None:
        await db.connect()
    return db
