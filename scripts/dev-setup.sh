#!/bin/bash
set -e

echo "=== GlassBox Development Setup ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required. Please install Node.js 20+."
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is required. Install with: npm install -g pnpm"
    exit 1
fi

if ! command -v go &> /dev/null; then
    echo "Error: Go is required. Please install Go 1.22+."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3.11+ is required."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "Error: Docker is required."
    exit 1
fi

echo "All prerequisites found!"
echo ""

# Start Docker dependencies
echo "Starting Docker dependencies (Postgres, Redis, LocalStack)..."
docker compose -f docker/docker-compose.yml up -d

# Wait for Postgres to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker exec glassbox-postgres pg_isready -U glassbox -d glassbox > /dev/null 2>&1; do
    sleep 1
done
echo "PostgreSQL is ready!"

# Run database migrations
echo "Running database migrations..."
docker exec -i glassbox-postgres psql -U glassbox -d glassbox < packages/db-schema/migrations/001_initial_schema.sql
echo "Migrations complete!"

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
pnpm install

# Copy environment files
echo "Setting up environment files..."

if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
    echo "Created apps/api/.env"
fi

if [ ! -f apps/web/.env.local ]; then
    cp apps/web/.env.example apps/web/.env.local
    echo "Created apps/web/.env.local"
fi

if [ ! -f apps/workers/.env ]; then
    cp apps/workers/.env.example apps/workers/.env
    echo "Created apps/workers/.env"
fi

# Setup Python virtual environment
echo "Setting up Python virtual environment..."
cd apps/workers
python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
deactivate
cd ../..

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To start development:"
echo ""
echo "  Terminal 1 (Next.js frontend):"
echo "    cd apps/web && pnpm dev"
echo ""
echo "  Terminal 2 (Go API):"
echo "    cd apps/api && go run cmd/api/main.go"
echo ""
echo "  Terminal 3 (Python agent worker):"
echo "    cd apps/workers && source .venv/bin/activate && python -m agent.worker"
echo ""
echo "Or run all at once (when ready):"
echo "    pnpm dev"
echo ""
echo "Services:"
echo "  - Frontend:   http://localhost:3000"
echo "  - API:        http://localhost:8080"
echo "  - Postgres:   localhost:5432"
echo "  - Redis:      localhost:6379"
echo "  - LocalStack: localhost:4566"
echo ""
