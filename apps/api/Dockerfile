# Build stage
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/api \
    ./cmd/api

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies (wget needed for health check)
RUN apk add --no-cache ca-certificates tzdata wget

# Create non-root user
RUN addgroup -g 1000 -S glassbox && \
    adduser -u 1000 -S glassbox -G glassbox

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/api /app/api

# Change ownership
RUN chown -R glassbox:glassbox /app

# Switch to non-root user
USER glassbox

# Expose port
EXPOSE 8080

# Health check - ECS overrides this with task definition health check
# Using longer start period to allow for database/redis connection initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD wget --no-verbose --tries=1 -O /dev/null http://localhost:8080/health || exit 1

# Run the binary
ENTRYPOINT ["/app/api"]
