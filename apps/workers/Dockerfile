# GlassBox Python Workers Dockerfile
# Supports both agent worker and file processor worker

FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1000 glassbox && \
    useradd -u 1000 -g glassbox -m glassbox

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Change ownership
RUN chown -R glassbox:glassbox /app

# Switch to non-root user
USER glassbox

# Default environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check (worker processes don't have HTTP endpoints, so we check the process)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep -f "python -m" || exit 1

# Default command runs the agent worker
# Override with: docker run <image> python -m file_processor.worker
CMD ["python", "-m", "agent.worker"]
