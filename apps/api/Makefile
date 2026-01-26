.PHONY: build run dev test lint clean

# Build the application
build:
	go build -o bin/api cmd/api/main.go

# Run the application
run: build
	./bin/api

# Run in development mode with hot reload (requires air)
dev:
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "air not installed. Install with: go install github.com/cosmtrek/air@latest"; \
		echo "Running without hot reload..."; \
		go run cmd/api/main.go; \
	fi

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Run linter
lint:
	golangci-lint run

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

# Download dependencies
deps:
	go mod download
	go mod tidy

# Generate mocks (if using mockgen)
mocks:
	@echo "Generate mocks here if needed"
