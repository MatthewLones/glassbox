package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/glassbox/api/internal/config"
	"github.com/glassbox/api/internal/database"
	"github.com/glassbox/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

// Execution-specific errors
var (
	ErrExecutionAlreadyActive = errors.New("an execution is already active for this node")
	ErrExecutionNotPausable   = errors.New("execution cannot be paused in its current state")
	ErrExecutionNotResumable  = errors.New("execution cannot be resumed in its current state")
	ErrExecutionNotCancellable = errors.New("execution cannot be cancelled in its current state")
	ErrExecutionNotAwaitingInput = errors.New("execution is not awaiting input")
)

// Active execution statuses
var activeStatuses = []string{"pending", "running", "paused", "awaiting_input"}

// AgentQueueClient interface for dispatching agent jobs
type AgentQueueClient interface {
	DispatchAgentJob(ctx context.Context, job any) error
}

// AgentJobMessage is the message sent to the agent queue
type AgentJobMessage struct {
	ExecutionID uuid.UUID      `json:"executionId"`
	NodeID      uuid.UUID      `json:"nodeId"`
	OrgID       uuid.UUID      `json:"orgId"`
	OrgConfig   map[string]any `json:"orgConfig,omitempty"`
}

// HumanInputRequest represents a request for human input from the agent
type HumanInputRequest struct {
	RequestType string         `json:"requestType"`
	Prompt      string         `json:"prompt"`
	Options     []string       `json:"options,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

// ExecutionCheckpoint stores the state for pause/resume
type ExecutionCheckpoint struct {
	Messages          []map[string]any `json:"messages,omitempty"`
	Iteration         int              `json:"iteration"`
	PendingToolResults []map[string]any `json:"pendingToolResults,omitempty"`
	HumanInputRequest  *HumanInputRequest `json:"humanInputRequest,omitempty"`
	HumanInputResponse map[string]any   `json:"humanInputResponse,omitempty"`
}

// ExecutionServiceFull extends ExecutionService with SQS client
type ExecutionServiceFull struct {
	db     *database.DB
	redis  *database.Redis
	sqs    AgentQueueClient
	cfg    *config.Config
	logger *zap.Logger
}

// NewExecutionServiceFull creates a new execution service with SQS support
func NewExecutionServiceFull(db *database.DB, redis *database.Redis, sqs AgentQueueClient, cfg *config.Config, logger *zap.Logger) *ExecutionServiceFull {
	return &ExecutionServiceFull{db: db, redis: redis, sqs: sqs, cfg: cfg, logger: logger}
}

// Start creates a new execution for a node and dispatches it to the agent queue
func (s *ExecutionServiceFull) Start(ctx context.Context, nodeID, userID uuid.UUID) (*models.AgentExecution, error) {
	// Verify node exists and user has access
	var orgID uuid.UUID
	var orgSettingsJSON []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT n.org_id, o.settings
		FROM nodes n
		JOIN organizations o ON n.org_id = o.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
	`, nodeID, userID).Scan(&orgID, &orgSettingsJSON)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify node access: %w", err)
	}

	// Check for existing active execution
	var existingID uuid.UUID
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id FROM agent_executions
		WHERE node_id = $1 AND status = ANY($2)
		ORDER BY created_at DESC
		LIMIT 1
	`, nodeID, activeStatuses).Scan(&existingID)

	if err == nil {
		return nil, ErrExecutionAlreadyActive
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to check existing executions: %w", err)
	}

	// Create execution record
	execution := &models.AgentExecution{
		ID:        uuid.New(),
		NodeID:    nodeID,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO agent_executions (id, node_id, status)
		VALUES ($1, $2, $3)
		RETURNING created_at
	`, execution.ID, execution.NodeID, execution.Status).Scan(&execution.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create execution: %w", err)
	}

	// Parse org settings for config
	var orgSettings models.OrganizationSettings
	if orgSettingsJSON != nil {
		json.Unmarshal(orgSettingsJSON, &orgSettings)
	}

	// Build org config for the worker
	orgConfig := map[string]any{}
	if orgSettings.DefaultModel != "" {
		orgConfig["defaultModel"] = orgSettings.DefaultModel
	}
	if len(orgSettings.Models) > 0 {
		orgConfig["models"] = orgSettings.Models
	}

	// Dispatch to agent queue
	err = s.sqs.DispatchAgentJob(ctx, AgentJobMessage{
		ExecutionID: execution.ID,
		NodeID:      nodeID,
		OrgID:       orgID,
		OrgConfig:   orgConfig,
	})
	if err != nil {
		// Update execution status to failed since we couldn't dispatch
		s.db.Pool.Exec(ctx, `
			UPDATE agent_executions SET status = 'failed', error_message = $2
			WHERE id = $1
		`, execution.ID, "Failed to dispatch job: "+err.Error())
		return nil, fmt.Errorf("failed to dispatch execution job: %w", err)
	}

	s.logger.Info("Started execution",
		zap.String("executionId", execution.ID.String()),
		zap.String("nodeId", nodeID.String()),
	)

	return execution, nil
}

// GetByID returns an execution by ID
func (s *ExecutionServiceFull) GetByID(ctx context.Context, executionID, userID uuid.UUID) (*models.AgentExecution, error) {
	var exec models.AgentExecution
	var traceSummaryJSON, checkpointJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT e.id, e.node_id, e.status, e.langgraph_thread_id, e.trace_summary,
		       e.langgraph_checkpoint, e.started_at, e.completed_at, e.error_message,
		       e.total_tokens_in, e.total_tokens_out, e.estimated_cost_usd, e.model_id, e.created_at
		FROM agent_executions e
		JOIN nodes n ON e.node_id = n.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE e.id = $1 AND om.user_id = $2
	`, executionID, userID).Scan(
		&exec.ID, &exec.NodeID, &exec.Status, &exec.LanggraphThreadID, &traceSummaryJSON,
		&checkpointJSON, &exec.StartedAt, &exec.CompletedAt, &exec.ErrorMessage,
		&exec.TotalTokensIn, &exec.TotalTokensOut, &exec.EstimatedCostUSD, &exec.ModelID, &exec.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}

	if traceSummaryJSON != nil {
		json.Unmarshal(traceSummaryJSON, &exec.TraceSummary)
	}

	return &exec, nil
}

// ExecutionWithHumanInput extends AgentExecution with HITL fields
type ExecutionWithHumanInput struct {
	models.AgentExecution
	HumanInputRequest  *HumanInputRequest `json:"humanInputRequest,omitempty"`
	HumanInputResponse map[string]any     `json:"humanInputResponse,omitempty"`
}

// GetByIDWithHumanInput returns an execution with human input fields extracted from checkpoint
func (s *ExecutionServiceFull) GetByIDWithHumanInput(ctx context.Context, executionID, userID uuid.UUID) (*ExecutionWithHumanInput, error) {
	var exec ExecutionWithHumanInput
	var traceSummaryJSON, checkpointJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT e.id, e.node_id, e.status, e.langgraph_thread_id, e.trace_summary,
		       e.langgraph_checkpoint, e.started_at, e.completed_at, e.error_message,
		       e.total_tokens_in, e.total_tokens_out, e.estimated_cost_usd, e.model_id, e.created_at
		FROM agent_executions e
		JOIN nodes n ON e.node_id = n.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE e.id = $1 AND om.user_id = $2
	`, executionID, userID).Scan(
		&exec.ID, &exec.NodeID, &exec.Status, &exec.LanggraphThreadID, &traceSummaryJSON,
		&checkpointJSON, &exec.StartedAt, &exec.CompletedAt, &exec.ErrorMessage,
		&exec.TotalTokensIn, &exec.TotalTokensOut, &exec.EstimatedCostUSD, &exec.ModelID, &exec.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}

	if traceSummaryJSON != nil {
		json.Unmarshal(traceSummaryJSON, &exec.TraceSummary)
	}

	// Extract human input fields from checkpoint
	if checkpointJSON != nil {
		var checkpoint ExecutionCheckpoint
		if json.Unmarshal(checkpointJSON, &checkpoint) == nil {
			exec.HumanInputRequest = checkpoint.HumanInputRequest
			exec.HumanInputResponse = checkpoint.HumanInputResponse
		}
	}

	return &exec, nil
}

// GetCurrentForNode returns the current active execution for a node
func (s *ExecutionServiceFull) GetCurrentForNode(ctx context.Context, nodeID, userID uuid.UUID) (*ExecutionWithHumanInput, error) {
	// Verify user has access to the node
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM nodes n
			JOIN org_members om ON n.org_id = om.org_id
			WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
		)
	`, nodeID, userID).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	var exec ExecutionWithHumanInput
	var traceSummaryJSON, checkpointJSON []byte

	err = s.db.Pool.QueryRow(ctx, `
		SELECT id, node_id, status, langgraph_thread_id, trace_summary, langgraph_checkpoint,
		       started_at, completed_at, error_message, total_tokens_in, total_tokens_out,
		       estimated_cost_usd, model_id, created_at
		FROM agent_executions
		WHERE node_id = $1 AND status = ANY($2)
		ORDER BY created_at DESC
		LIMIT 1
	`, nodeID, activeStatuses).Scan(
		&exec.ID, &exec.NodeID, &exec.Status, &exec.LanggraphThreadID, &traceSummaryJSON,
		&checkpointJSON, &exec.StartedAt, &exec.CompletedAt, &exec.ErrorMessage,
		&exec.TotalTokensIn, &exec.TotalTokensOut, &exec.EstimatedCostUSD, &exec.ModelID, &exec.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get current execution: %w", err)
	}

	if traceSummaryJSON != nil {
		json.Unmarshal(traceSummaryJSON, &exec.TraceSummary)
	}

	// Extract human input fields from checkpoint
	if checkpointJSON != nil {
		var checkpoint ExecutionCheckpoint
		if json.Unmarshal(checkpointJSON, &checkpoint) == nil {
			exec.HumanInputRequest = checkpoint.HumanInputRequest
			exec.HumanInputResponse = checkpoint.HumanInputResponse
		}
	}

	return &exec, nil
}

// Pause pauses an active execution
func (s *ExecutionServiceFull) Pause(ctx context.Context, nodeID, userID uuid.UUID) error {
	// Get current execution and verify access
	var execID uuid.UUID
	var status string

	err := s.db.Pool.QueryRow(ctx, `
		SELECT e.id, e.status
		FROM agent_executions e
		JOIN nodes n ON e.node_id = n.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE e.node_id = $1 AND om.user_id = $2 AND e.status = ANY($3)
		ORDER BY e.created_at DESC
		LIMIT 1
	`, nodeID, userID, activeStatuses).Scan(&execID, &status)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get execution: %w", err)
	}

	// Can only pause from 'running' status
	if status != "running" {
		return ErrExecutionNotPausable
	}

	// Update status to paused - the worker will checkpoint on next iteration
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE agent_executions SET status = 'paused'
		WHERE id = $1 AND status = 'running'
	`, execID)
	if err != nil {
		return fmt.Errorf("failed to pause execution: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrExecutionNotPausable
	}

	s.logger.Info("Paused execution", zap.String("executionId", execID.String()))
	return nil
}

// Resume resumes a paused execution
func (s *ExecutionServiceFull) Resume(ctx context.Context, nodeID, userID uuid.UUID) error {
	// Get current execution and verify access
	var execID uuid.UUID
	var orgID uuid.UUID
	var status string
	var orgSettingsJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT e.id, e.status, n.org_id, o.settings
		FROM agent_executions e
		JOIN nodes n ON e.node_id = n.id
		JOIN organizations o ON n.org_id = o.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE e.node_id = $1 AND om.user_id = $2 AND e.status = ANY($3)
		ORDER BY e.created_at DESC
		LIMIT 1
	`, nodeID, userID, activeStatuses).Scan(&execID, &status, &orgID, &orgSettingsJSON)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get execution: %w", err)
	}

	// Can only resume from 'paused' status
	if status != "paused" {
		return ErrExecutionNotResumable
	}

	// Update status back to running
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE agent_executions SET status = 'running'
		WHERE id = $1 AND status = 'paused'
	`, execID)
	if err != nil {
		return fmt.Errorf("failed to resume execution: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrExecutionNotResumable
	}

	// Parse org settings for config
	var orgSettings models.OrganizationSettings
	if orgSettingsJSON != nil {
		json.Unmarshal(orgSettingsJSON, &orgSettings)
	}

	orgConfig := map[string]any{}
	if orgSettings.DefaultModel != "" {
		orgConfig["defaultModel"] = orgSettings.DefaultModel
	}

	// Re-dispatch to agent queue (worker will pick up from checkpoint)
	err = s.sqs.DispatchAgentJob(ctx, AgentJobMessage{
		ExecutionID: execID,
		NodeID:      nodeID,
		OrgID:       orgID,
		OrgConfig:   orgConfig,
	})
	if err != nil {
		// Revert status back to paused
		s.db.Pool.Exec(ctx, `UPDATE agent_executions SET status = 'paused' WHERE id = $1`, execID)
		return fmt.Errorf("failed to dispatch resume job: %w", err)
	}

	s.logger.Info("Resumed execution", zap.String("executionId", execID.String()))
	return nil
}

// Cancel cancels an active execution
func (s *ExecutionServiceFull) Cancel(ctx context.Context, nodeID, userID uuid.UUID) error {
	// Get current execution and verify access
	var execID uuid.UUID
	var status string

	err := s.db.Pool.QueryRow(ctx, `
		SELECT e.id, e.status
		FROM agent_executions e
		JOIN nodes n ON e.node_id = n.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE e.node_id = $1 AND om.user_id = $2 AND e.status = ANY($3)
		ORDER BY e.created_at DESC
		LIMIT 1
	`, nodeID, userID, activeStatuses).Scan(&execID, &status)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get execution: %w", err)
	}

	// Update status to cancelled
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE agent_executions SET status = 'cancelled', completed_at = NOW()
		WHERE id = $1 AND status = ANY($2)
	`, execID, activeStatuses)
	if err != nil {
		return fmt.Errorf("failed to cancel execution: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrExecutionNotCancellable
	}

	s.logger.Info("Cancelled execution", zap.String("executionId", execID.String()))
	return nil
}

// ProvideInput provides human input for an execution awaiting input
func (s *ExecutionServiceFull) ProvideInput(ctx context.Context, executionID, userID uuid.UUID, input map[string]any) error {
	// Get execution and verify access and status
	var nodeID, orgID uuid.UUID
	var status string
	var checkpointJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT e.node_id, e.status, e.langgraph_checkpoint, n.org_id
		FROM agent_executions e
		JOIN nodes n ON e.node_id = n.id
		JOIN org_members om ON n.org_id = om.org_id
		WHERE e.id = $1 AND om.user_id = $2
	`, executionID, userID).Scan(&nodeID, &status, &checkpointJSON, &orgID)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get execution: %w", err)
	}

	if status != "awaiting_input" {
		return ErrExecutionNotAwaitingInput
	}

	// Update checkpoint with human input response
	var checkpoint ExecutionCheckpoint
	if checkpointJSON != nil {
		json.Unmarshal(checkpointJSON, &checkpoint)
	}
	checkpoint.HumanInputResponse = input

	newCheckpointJSON, _ := json.Marshal(checkpoint)

	// Update execution with input and change status to running
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE agent_executions
		SET status = 'running', langgraph_checkpoint = $2
		WHERE id = $1
	`, executionID, newCheckpointJSON)
	if err != nil {
		return fmt.Errorf("failed to update execution: %w", err)
	}

	// Get org settings for config
	var orgSettingsJSON []byte
	s.db.Pool.QueryRow(ctx, `SELECT settings FROM organizations WHERE id = $1`, orgID).Scan(&orgSettingsJSON)

	var orgSettings models.OrganizationSettings
	if orgSettingsJSON != nil {
		json.Unmarshal(orgSettingsJSON, &orgSettings)
	}

	orgConfig := map[string]any{}
	if orgSettings.DefaultModel != "" {
		orgConfig["defaultModel"] = orgSettings.DefaultModel
	}

	// Re-dispatch to agent queue
	err = s.sqs.DispatchAgentJob(ctx, AgentJobMessage{
		ExecutionID: executionID,
		NodeID:      nodeID,
		OrgID:       orgID,
		OrgConfig:   orgConfig,
	})
	if err != nil {
		// Revert status
		s.db.Pool.Exec(ctx, `UPDATE agent_executions SET status = 'awaiting_input' WHERE id = $1`, executionID)
		return fmt.Errorf("failed to dispatch job after input: %w", err)
	}

	s.logger.Info("Provided human input",
		zap.String("executionId", executionID.String()),
	)
	return nil
}

// GetTrace returns all trace events for an execution
func (s *ExecutionServiceFull) GetTrace(ctx context.Context, executionID, userID uuid.UUID) ([]models.TraceEvent, error) {
	// Verify user has access to the execution
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM agent_executions e
			JOIN nodes n ON e.node_id = n.id
			JOIN org_members om ON n.org_id = om.org_id
			WHERE e.id = $1 AND om.user_id = $2
		)
	`, executionID, userID).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, execution_id, event_type, event_data, timestamp, duration_ms,
		       model, tokens_in, tokens_out, sequence_number
		FROM agent_trace_events
		WHERE execution_id = $1
		ORDER BY sequence_number ASC
	`, executionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get trace events: %w", err)
	}
	defer rows.Close()

	var events []models.TraceEvent
	for rows.Next() {
		var event models.TraceEvent
		var eventDataJSON []byte

		if err := rows.Scan(
			&event.ID, &event.ExecutionID, &event.EventType, &eventDataJSON,
			&event.Timestamp, &event.DurationMs, &event.Model, &event.TokensIn,
			&event.TokensOut, &event.SequenceNumber,
		); err != nil {
			return nil, fmt.Errorf("failed to scan trace event: %w", err)
		}

		if eventDataJSON != nil {
			json.Unmarshal(eventDataJSON, &event.EventData)
		}
		events = append(events, event)
	}

	return events, nil
}
