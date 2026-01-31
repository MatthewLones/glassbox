package database

import (
	"context"
	_ "embed"
	"fmt"
	"time"

	"go.uber.org/zap"
)

//go:embed schema.sql
var schemaSQL string

// RunMigrations executes the database schema migration
// This is idempotent - safe to run multiple times due to IF NOT EXISTS clauses
func RunMigrations(db *DB, logger *zap.Logger) error {
	logger.Info("Running database migrations...")

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Execute the schema SQL
	_, err := db.Pool.Exec(ctx, schemaSQL)
	if err != nil {
		return fmt.Errorf("failed to execute migrations: %w", err)
	}

	logger.Info("Database migrations completed successfully")
	return nil
}
