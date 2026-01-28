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
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

// Common errors
var (
	ErrNotFound      = errors.New("resource not found")
	ErrForbidden     = errors.New("access forbidden")
	ErrAlreadyExists = errors.New("resource already exists")
)

// Services contains all service dependencies
type Services struct {
	Orgs       *OrganizationService
	Projects   *ProjectService
	Nodes      *NodeService
	Files      *FileService
	Executions *ExecutionServiceFull
	Templates  *TemplateService
	Users      *UserService
	Search     *SearchService
	Auth       *AuthService
}

// NewServices creates all services with their dependencies
func NewServices(db *database.DB, redis *database.Redis, s3 S3Client, sqs SQSClient, cfg *config.Config, logger *zap.Logger) *Services {
	return &Services{
		Orgs:       NewOrganizationService(db, logger),
		Projects:   NewProjectService(db, logger),
		Nodes:      NewNodeService(db, redis, logger),
		Files:      NewFileService(db, s3, sqs, cfg, logger),
		Executions: NewExecutionServiceFull(db, redis, sqs, cfg, logger),
		Templates:  NewTemplateService(db, logger),
		Users:      NewUserService(db, logger),
		Search:     NewSearchService(db, logger),
		Auth:       NewAuthService(db, redis, cfg, logger),
	}
}

// OrganizationService handles organization operations
type OrganizationService struct {
	db     *database.DB
	logger *zap.Logger
}

func NewOrganizationService(db *database.DB, logger *zap.Logger) *OrganizationService {
	return &OrganizationService{db: db, logger: logger}
}

// ListByUser returns all organizations the user is a member of
func (s *OrganizationService) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.Organization, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT o.id, o.name, o.slug, o.settings, o.event_sourcing_level, o.created_at, o.updated_at
		FROM organizations o
		JOIN org_members om ON o.id = om.org_id
		WHERE om.user_id = $1
		ORDER BY o.name
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list organizations: %w", err)
	}
	defer rows.Close()

	var orgs []models.Organization
	for rows.Next() {
		var org models.Organization
		var settingsJSON []byte

		if err := rows.Scan(
			&org.ID, &org.Name, &org.Slug, &settingsJSON,
			&org.EventSourcingLevel, &org.CreatedAt, &org.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan organization: %w", err)
		}

		json.Unmarshal(settingsJSON, &org.Settings)
		orgs = append(orgs, org)
	}

	return orgs, nil
}

// GetByID returns an organization by ID if the user has access
func (s *OrganizationService) GetByID(ctx context.Context, orgID, userID uuid.UUID) (*models.Organization, error) {
	var org models.Organization
	var settingsJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT o.id, o.name, o.slug, o.settings, o.event_sourcing_level, o.created_at, o.updated_at
		FROM organizations o
		JOIN org_members om ON o.id = om.org_id
		WHERE o.id = $1 AND om.user_id = $2
	`, orgID, userID).Scan(
		&org.ID, &org.Name, &org.Slug, &settingsJSON,
		&org.EventSourcingLevel, &org.CreatedAt, &org.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get organization: %w", err)
	}

	json.Unmarshal(settingsJSON, &org.Settings)
	return &org, nil
}

// CreateOrgRequest contains data for creating an organization
type CreateOrgRequest struct {
	Name string `json:"name" binding:"required"`
	Slug string `json:"slug" binding:"required"`
}

// Create creates a new organization and adds the creator as owner
func (s *OrganizationService) Create(ctx context.Context, req CreateOrgRequest, creatorID uuid.UUID) (*models.Organization, error) {
	org := &models.Organization{
		ID:                 uuid.New(),
		Name:               req.Name,
		Slug:               req.Slug,
		Settings:           models.OrganizationSettings{},
		EventSourcingLevel: "snapshot",
	}

	settingsJSON, _ := json.Marshal(org.Settings)

	// Use transaction to create org and membership atomically
	err := s.db.WithTransaction(ctx, func(tx pgx.Tx) error {
		// Create organization
		err := tx.QueryRow(ctx, `
			INSERT INTO organizations (id, name, slug, settings, event_sourcing_level)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING created_at, updated_at
		`, org.ID, org.Name, org.Slug, settingsJSON, org.EventSourcingLevel).Scan(
			&org.CreatedAt, &org.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to create organization: %w", err)
		}

		// Add creator as owner
		_, err = tx.Exec(ctx, `
			INSERT INTO org_members (id, org_id, user_id, role)
			VALUES ($1, $2, $3, 'owner')
		`, uuid.New(), org.ID, creatorID)
		if err != nil {
			return fmt.Errorf("failed to add owner: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return org, nil
}

// UpdateOrgRequest contains data for updating an organization
type UpdateOrgRequest struct {
	Name               *string                      `json:"name,omitempty"`
	Settings           *models.OrganizationSettings `json:"settings,omitempty"`
	EventSourcingLevel *string                      `json:"eventSourcingLevel,omitempty"`
}

// Update updates an organization (requires admin/owner role)
func (s *OrganizationService) Update(ctx context.Context, orgID, userID uuid.UUID, req UpdateOrgRequest) (*models.Organization, error) {
	// Check user has admin or owner role
	var role string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to check membership: %w", err)
	}
	if role != "owner" && role != "admin" {
		return nil, ErrForbidden
	}

	// Build dynamic update query
	var org models.Organization
	var settingsJSON []byte

	if req.Settings != nil {
		settingsJSON, _ = json.Marshal(req.Settings)
	}

	err = s.db.Pool.QueryRow(ctx, `
		UPDATE organizations SET
			name = COALESCE($2, name),
			settings = COALESCE($3, settings),
			event_sourcing_level = COALESCE($4, event_sourcing_level),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, slug, settings, event_sourcing_level, created_at, updated_at
	`, orgID, req.Name, settingsJSON, req.EventSourcingLevel).Scan(
		&org.ID, &org.Name, &org.Slug, &settingsJSON,
		&org.EventSourcingLevel, &org.CreatedAt, &org.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update organization: %w", err)
	}

	json.Unmarshal(settingsJSON, &org.Settings)
	return &org, nil
}

// Delete deletes an organization (requires owner role)
func (s *OrganizationService) Delete(ctx context.Context, orgID, userID uuid.UUID) error {
	// Check user is owner
	var role string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if role != "owner" {
		return ErrForbidden
	}

	// Delete organization (cascades to all related data)
	result, err := s.db.Pool.Exec(ctx, `DELETE FROM organizations WHERE id = $1`, orgID)
	if err != nil {
		return fmt.Errorf("failed to delete organization: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// GetUserRole returns the user's role in the organization
func (s *OrganizationService) GetUserRole(ctx context.Context, orgID, userID uuid.UUID) (string, error) {
	var role string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)

	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("failed to get role: %w", err)
	}

	return role, nil
}

// ProjectService handles project operations
type ProjectService struct {
	db     *database.DB
	logger *zap.Logger
}

func NewProjectService(db *database.DB, logger *zap.Logger) *ProjectService {
	return &ProjectService{db: db, logger: logger}
}

// ListByOrg returns all projects in an organization
func (s *ProjectService) ListByOrg(ctx context.Context, orgID, userID uuid.UUID) ([]models.Project, error) {
	// First verify user has access to the org
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2)
	`, orgID, userID).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("failed to check org membership: %w", err)
	}
	if !exists {
		return nil, ErrForbidden
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, org_id, name, description, settings, workflow_states, created_at, updated_at
		FROM projects
		WHERE org_id = $1
		ORDER BY name
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		var settingsJSON, workflowStatesJSON []byte

		if err := rows.Scan(
			&p.ID, &p.OrgID, &p.Name, &p.Description, &settingsJSON,
			&workflowStatesJSON, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan project: %w", err)
		}

		json.Unmarshal(settingsJSON, &p.Settings)
		json.Unmarshal(workflowStatesJSON, &p.WorkflowStates)
		projects = append(projects, p)
	}

	return projects, nil
}

// GetByID returns a project by ID if user has access
func (s *ProjectService) GetByID(ctx context.Context, projectID, userID uuid.UUID) (*models.Project, error) {
	var p models.Project
	var settingsJSON, workflowStatesJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT p.id, p.org_id, p.name, p.description, p.settings, p.workflow_states, p.created_at, p.updated_at
		FROM projects p
		JOIN org_members om ON p.org_id = om.org_id
		WHERE p.id = $1 AND om.user_id = $2
	`, projectID, userID).Scan(
		&p.ID, &p.OrgID, &p.Name, &p.Description, &settingsJSON,
		&workflowStatesJSON, &p.CreatedAt, &p.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get project: %w", err)
	}

	json.Unmarshal(settingsJSON, &p.Settings)
	json.Unmarshal(workflowStatesJSON, &p.WorkflowStates)
	return &p, nil
}

// CreateProjectRequest contains data for creating a project
type CreateProjectRequest struct {
	Name           string                 `json:"name" binding:"required"`
	Description    *string                `json:"description,omitempty"`
	Settings       *models.ProjectSettings `json:"settings,omitempty"`
	WorkflowStates []string               `json:"workflowStates,omitempty"`
}

// Create creates a new project in an organization
func (s *ProjectService) Create(ctx context.Context, orgID, userID uuid.UUID, req CreateProjectRequest) (*models.Project, error) {
	// Check user has access to org
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2)
	`, orgID, userID).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("failed to check org membership: %w", err)
	}
	if !exists {
		return nil, ErrForbidden
	}

	// Set defaults
	workflowStates := req.WorkflowStates
	if len(workflowStates) == 0 {
		workflowStates = []string{"draft", "in_progress", "complete"}
	}

	settings := models.ProjectSettings{}
	if req.Settings != nil {
		settings = *req.Settings
	}

	p := &models.Project{
		ID:             uuid.New(),
		OrgID:          orgID,
		Name:           req.Name,
		Description:    req.Description,
		Settings:       settings,
		WorkflowStates: workflowStates,
	}

	settingsJSON, _ := json.Marshal(p.Settings)
	workflowStatesJSON, _ := json.Marshal(p.WorkflowStates)

	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO projects (id, org_id, name, description, settings, workflow_states)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`, p.ID, p.OrgID, p.Name, p.Description, settingsJSON, workflowStatesJSON).Scan(
		&p.CreatedAt, &p.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	return p, nil
}

// UpdateProjectRequest contains data for updating a project
type UpdateProjectRequest struct {
	Name           *string                 `json:"name,omitempty"`
	Description    *string                 `json:"description,omitempty"`
	Settings       *models.ProjectSettings `json:"settings,omitempty"`
	WorkflowStates []string                `json:"workflowStates,omitempty"`
}

// Update updates a project
func (s *ProjectService) Update(ctx context.Context, projectID, userID uuid.UUID, req UpdateProjectRequest) (*models.Project, error) {
	// Verify user has access
	var orgID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT p.org_id FROM projects p
		JOIN org_members om ON p.org_id = om.org_id
		WHERE p.id = $1 AND om.user_id = $2
	`, projectID, userID).Scan(&orgID)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to check access: %w", err)
	}

	var p models.Project
	var settingsJSON, workflowStatesJSON []byte

	if req.Settings != nil {
		settingsJSON, _ = json.Marshal(req.Settings)
	}
	if len(req.WorkflowStates) > 0 {
		workflowStatesJSON, _ = json.Marshal(req.WorkflowStates)
	}

	err = s.db.Pool.QueryRow(ctx, `
		UPDATE projects SET
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			settings = COALESCE($4, settings),
			workflow_states = COALESCE($5, workflow_states),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, org_id, name, description, settings, workflow_states, created_at, updated_at
	`, projectID, req.Name, req.Description, settingsJSON, workflowStatesJSON).Scan(
		&p.ID, &p.OrgID, &p.Name, &p.Description, &settingsJSON,
		&workflowStatesJSON, &p.CreatedAt, &p.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update project: %w", err)
	}

	json.Unmarshal(settingsJSON, &p.Settings)
	json.Unmarshal(workflowStatesJSON, &p.WorkflowStates)
	return &p, nil
}

// Delete deletes a project (cascades to nodes)
func (s *ProjectService) Delete(ctx context.Context, projectID, userID uuid.UUID) error {
	// Verify user has access (must be org admin/owner)
	var role string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT om.role FROM projects p
		JOIN org_members om ON p.org_id = om.org_id
		WHERE p.id = $1 AND om.user_id = $2
	`, projectID, userID).Scan(&role)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to check access: %w", err)
	}
	if role != "owner" && role != "admin" {
		return ErrForbidden
	}

	result, err := s.db.Pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, projectID)
	if err != nil {
		return fmt.Errorf("failed to delete project: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// NodeService handles node operations
type NodeService struct {
	db     *database.DB
	redis  *database.Redis
	logger *zap.Logger
}

func NewNodeService(db *database.DB, redis *database.Redis, logger *zap.Logger) *NodeService {
	return &NodeService{db: db, redis: redis, logger: logger}
}

// ErrLockConflict indicates the node is locked by another user
var ErrLockConflict = errors.New("node is locked by another user")

// ListNodesRequest contains filters for listing nodes
type ListNodesRequest struct {
	Status     *string `form:"status"`
	AuthorType *string `form:"authorType"`
	ParentID   *string `form:"parentId"`
}

// ListByProject returns all nodes in a project
func (s *NodeService) ListByProject(ctx context.Context, projectID, userID uuid.UUID, filters ListNodesRequest) ([]models.Node, error) {
	// Verify user has access to the project
	var orgID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT p.org_id FROM projects p
		JOIN org_members om ON p.org_id = om.org_id
		WHERE p.id = $1 AND om.user_id = $2
	`, projectID, userID).Scan(&orgID)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}

	// Build query with filters
	query := `
		SELECT id, org_id, project_id, parent_id, title, description, status, author_type,
		       author_user_id, supervisor_user_id, version, metadata, position,
		       locked_by, locked_at, lock_expires_at, created_at, updated_at, deleted_at
		FROM nodes
		WHERE project_id = $1 AND deleted_at IS NULL
	`
	args := []any{projectID}
	argIdx := 2

	if filters.Status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filters.Status)
		argIdx++
	}
	if filters.AuthorType != nil {
		query += fmt.Sprintf(" AND author_type = $%d", argIdx)
		args = append(args, *filters.AuthorType)
		argIdx++
	}
	if filters.ParentID != nil {
		if *filters.ParentID == "null" {
			query += " AND parent_id IS NULL"
		} else {
			query += fmt.Sprintf(" AND parent_id = $%d", argIdx)
			args = append(args, *filters.ParentID)
			argIdx++
		}
	}

	query += " ORDER BY created_at DESC"

	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}
	defer rows.Close()

	var nodes []models.Node
	for rows.Next() {
		node, err := s.scanNode(rows)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, *node)
	}

	return nodes, nil
}

// GetByID returns a node by ID with its inputs and outputs
func (s *NodeService) GetByID(ctx context.Context, nodeID, userID uuid.UUID) (*models.Node, error) {
	// Verify user has access via org membership
	var node models.Node
	var metadataJSON, positionJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT n.id, n.org_id, n.project_id, n.parent_id, n.title, n.description, n.status, n.author_type,
		       n.author_user_id, n.supervisor_user_id, n.version, n.metadata, n.position,
		       n.locked_by, n.locked_at, n.lock_expires_at, n.created_at, n.updated_at, n.deleted_at
		FROM nodes n
		JOIN org_members om ON n.org_id = om.org_id
		WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
	`, nodeID, userID).Scan(
		&node.ID, &node.OrgID, &node.ProjectID, &node.ParentID, &node.Title, &node.Description,
		&node.Status, &node.AuthorType, &node.AuthorUserID, &node.SupervisorUserID, &node.Version,
		&metadataJSON, &positionJSON, &node.LockedBy, &node.LockedAt, &node.LockExpiresAt,
		&node.CreatedAt, &node.UpdatedAt, &node.DeletedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get node: %w", err)
	}

	json.Unmarshal(metadataJSON, &node.Metadata)
	json.Unmarshal(positionJSON, &node.Position)

	// Fetch inputs
	inputs, err := s.getNodeInputs(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	node.Inputs = inputs

	// Fetch outputs
	outputs, err := s.getNodeOutputs(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	node.Outputs = outputs

	return &node, nil
}

// CreateNodeRequest contains data for creating a node
type CreateNodeRequest struct {
	Title            string               `json:"title" binding:"required"`
	Description      *string              `json:"description,omitempty"`
	Status           *string              `json:"status,omitempty"`
	AuthorType       *string              `json:"authorType,omitempty"`
	ParentID         *uuid.UUID           `json:"parentId,omitempty"`
	SupervisorUserID *uuid.UUID           `json:"supervisorUserId,omitempty"`
	Metadata         *models.NodeMetadata `json:"metadata,omitempty"`
	Position         *models.NodePosition `json:"position,omitempty"`
}

// Create creates a new node
func (s *NodeService) Create(ctx context.Context, projectID, userID uuid.UUID, req CreateNodeRequest) (*models.Node, error) {
	// Verify user has access and get org_id
	var orgID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT p.org_id FROM projects p
		JOIN org_members om ON p.org_id = om.org_id
		WHERE p.id = $1 AND om.user_id = $2
	`, projectID, userID).Scan(&orgID)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}

	// Set defaults
	status := "draft"
	if req.Status != nil {
		status = *req.Status
	}
	authorType := "human"
	if req.AuthorType != nil {
		authorType = *req.AuthorType
	}
	metadata := models.NodeMetadata{}
	if req.Metadata != nil {
		metadata = *req.Metadata
	}
	position := models.NodePosition{X: 0, Y: 0}
	if req.Position != nil {
		position = *req.Position
	}

	node := &models.Node{
		ID:               uuid.New(),
		OrgID:            orgID,
		ProjectID:        projectID,
		ParentID:         req.ParentID,
		Title:            req.Title,
		Description:      req.Description,
		Status:           status,
		AuthorType:       authorType,
		AuthorUserID:     &userID,
		SupervisorUserID: req.SupervisorUserID,
		Version:          1,
		Metadata:         metadata,
		Position:         position,
	}

	metadataJSON, _ := json.Marshal(node.Metadata)
	positionJSON, _ := json.Marshal(node.Position)

	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO nodes (id, org_id, project_id, parent_id, title, description, status, author_type,
		                   author_user_id, supervisor_user_id, version, metadata, position)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING created_at, updated_at
	`, node.ID, node.OrgID, node.ProjectID, node.ParentID, node.Title, node.Description,
		node.Status, node.AuthorType, node.AuthorUserID, node.SupervisorUserID, node.Version,
		metadataJSON, positionJSON).Scan(&node.CreatedAt, &node.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create node: %w", err)
	}

	return node, nil
}

// UpdateNodeRequest contains data for updating a node
type UpdateNodeRequest struct {
	Title            *string              `json:"title,omitempty"`
	Description      *string              `json:"description,omitempty"`
	Status           *string              `json:"status,omitempty"`
	ParentID         *uuid.UUID           `json:"parentId,omitempty"`
	SupervisorUserID *uuid.UUID           `json:"supervisorUserId,omitempty"`
	Metadata         *models.NodeMetadata `json:"metadata,omitempty"`
	Position         *models.NodePosition `json:"position,omitempty"`
}

// Update updates a node and creates a version snapshot
func (s *NodeService) Update(ctx context.Context, nodeID, userID uuid.UUID, req UpdateNodeRequest) (*models.Node, error) {
	// Use transaction to update node and create version atomically
	var node *models.Node

	err := s.db.WithTransaction(ctx, func(tx pgx.Tx) error {
		// Get current node state (and verify access)
		var current models.Node
		var metadataJSON, positionJSON []byte

		err := tx.QueryRow(ctx, `
			SELECT n.id, n.org_id, n.project_id, n.parent_id, n.title, n.description, n.status, n.author_type,
			       n.author_user_id, n.supervisor_user_id, n.version, n.metadata, n.position,
			       n.locked_by, n.locked_at, n.lock_expires_at, n.created_at, n.updated_at
			FROM nodes n
			JOIN org_members om ON n.org_id = om.org_id
			WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
			FOR UPDATE
		`, nodeID, userID).Scan(
			&current.ID, &current.OrgID, &current.ProjectID, &current.ParentID, &current.Title,
			&current.Description, &current.Status, &current.AuthorType, &current.AuthorUserID,
			&current.SupervisorUserID, &current.Version, &metadataJSON, &positionJSON,
			&current.LockedBy, &current.LockedAt, &current.LockExpiresAt, &current.CreatedAt, &current.UpdatedAt,
		)

		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("failed to get node: %w", err)
		}

		json.Unmarshal(metadataJSON, &current.Metadata)
		json.Unmarshal(positionJSON, &current.Position)

		// Check lock - if locked by another user, reject
		if current.LockedBy != nil && *current.LockedBy != userID {
			if current.LockExpiresAt != nil && current.LockExpiresAt.After(time.Now()) {
				return ErrLockConflict
			}
		}

		// Create version snapshot of current state
		snapshotJSON, _ := json.Marshal(current)
		_, err = tx.Exec(ctx, `
			INSERT INTO node_versions (id, node_id, version, snapshot, change_type, changed_by)
			VALUES ($1, $2, $3, $4, 'update', $5)
		`, uuid.New(), nodeID, current.Version, snapshotJSON, userID)
		if err != nil {
			return fmt.Errorf("failed to create version: %w", err)
		}

		// Build update
		newVersion := current.Version + 1
		if req.Metadata != nil {
			metadataJSON, _ = json.Marshal(req.Metadata)
		} else {
			metadataJSON = nil
		}
		if req.Position != nil {
			positionJSON, _ = json.Marshal(req.Position)
		} else {
			positionJSON = nil
		}

		// Update node
		var updated models.Node
		var updatedMetaJSON, updatedPosJSON []byte
		err = tx.QueryRow(ctx, `
			UPDATE nodes SET
				title = COALESCE($2, title),
				description = COALESCE($3, description),
				status = COALESCE($4, status),
				parent_id = COALESCE($5, parent_id),
				supervisor_user_id = COALESCE($6, supervisor_user_id),
				metadata = COALESCE($7, metadata),
				position = COALESCE($8, position),
				version = $9,
				updated_at = NOW()
			WHERE id = $1
			RETURNING id, org_id, project_id, parent_id, title, description, status, author_type,
			          author_user_id, supervisor_user_id, version, metadata, position,
			          locked_by, locked_at, lock_expires_at, created_at, updated_at
		`, nodeID, req.Title, req.Description, req.Status, req.ParentID, req.SupervisorUserID,
			metadataJSON, positionJSON, newVersion).Scan(
			&updated.ID, &updated.OrgID, &updated.ProjectID, &updated.ParentID, &updated.Title,
			&updated.Description, &updated.Status, &updated.AuthorType, &updated.AuthorUserID,
			&updated.SupervisorUserID, &updated.Version, &updatedMetaJSON, &updatedPosJSON,
			&updated.LockedBy, &updated.LockedAt, &updated.LockExpiresAt, &updated.CreatedAt, &updated.UpdatedAt,
		)

		if err != nil {
			return fmt.Errorf("failed to update node: %w", err)
		}

		json.Unmarshal(updatedMetaJSON, &updated.Metadata)
		json.Unmarshal(updatedPosJSON, &updated.Position)
		node = &updated
		return nil
	})

	if err != nil {
		return nil, err
	}

	return node, nil
}

// Delete soft-deletes a node
func (s *NodeService) Delete(ctx context.Context, nodeID, userID uuid.UUID) error {
	// Verify access
	var role string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT om.role FROM nodes n
		JOIN org_members om ON n.org_id = om.org_id
		WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
	`, nodeID, userID).Scan(&role)

	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to verify access: %w", err)
	}

	// Soft delete
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE nodes SET deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, nodeID)
	if err != nil {
		return fmt.Errorf("failed to delete node: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// =====================================================
// NODE INPUTS & OUTPUTS
// =====================================================

// AddInputRequest contains data for adding an input
type AddInputRequest struct {
	InputType         string         `json:"inputType" binding:"required"`
	FileID            *uuid.UUID     `json:"fileId,omitempty"`
	SourceNodeID      *uuid.UUID     `json:"sourceNodeId,omitempty"`
	SourceNodeVersion *int           `json:"sourceNodeVersion,omitempty"`
	ExternalURL       *string        `json:"externalUrl,omitempty"`
	TextContent       *string        `json:"textContent,omitempty"`
	Label             *string        `json:"label,omitempty"`
	Metadata          map[string]any `json:"metadata,omitempty"`
}

// AddInput adds an input to a node
func (s *NodeService) AddInput(ctx context.Context, nodeID, userID uuid.UUID, req AddInputRequest) (*models.NodeInput, error) {
	// Verify access
	var orgID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT n.org_id FROM nodes n
		JOIN org_members om ON n.org_id = om.org_id
		WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
	`, nodeID, userID).Scan(&orgID)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}

	// Get next sort order
	var maxOrder int
	s.db.Pool.QueryRow(ctx, `SELECT COALESCE(MAX(sort_order), -1) FROM node_inputs WHERE node_id = $1`, nodeID).Scan(&maxOrder)

	input := &models.NodeInput{
		ID:                uuid.New(),
		NodeID:            nodeID,
		InputType:         req.InputType,
		FileID:            req.FileID,
		SourceNodeID:      req.SourceNodeID,
		SourceNodeVersion: req.SourceNodeVersion,
		ExternalURL:       req.ExternalURL,
		TextContent:       req.TextContent,
		Label:             req.Label,
		Metadata:          req.Metadata,
		SortOrder:         maxOrder + 1,
	}

	if input.Metadata == nil {
		input.Metadata = map[string]any{}
	}
	metadataJSON, _ := json.Marshal(input.Metadata)

	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO node_inputs (id, node_id, input_type, file_id, source_node_id, source_node_version,
		                         external_url, text_content, label, metadata, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at
	`, input.ID, input.NodeID, input.InputType, input.FileID, input.SourceNodeID,
		input.SourceNodeVersion, input.ExternalURL, input.TextContent, input.Label,
		metadataJSON, input.SortOrder).Scan(&input.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to add input: %w", err)
	}

	return input, nil
}

// RemoveInput removes an input from a node
func (s *NodeService) RemoveInput(ctx context.Context, nodeID, inputID, userID uuid.UUID) error {
	// Verify access
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM node_inputs ni
			JOIN nodes n ON ni.node_id = n.id
			JOIN org_members om ON n.org_id = om.org_id
			WHERE ni.id = $1 AND ni.node_id = $2 AND om.user_id = $3 AND n.deleted_at IS NULL
		)
	`, inputID, nodeID, userID).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to verify access: %w", err)
	}
	if !exists {
		return ErrNotFound
	}

	result, err := s.db.Pool.Exec(ctx, `DELETE FROM node_inputs WHERE id = $1`, inputID)
	if err != nil {
		return fmt.Errorf("failed to remove input: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// AddOutputRequest contains data for adding an output
type AddOutputRequest struct {
	OutputType     string         `json:"outputType" binding:"required"`
	FileID         *uuid.UUID     `json:"fileId,omitempty"`
	StructuredData map[string]any `json:"structuredData,omitempty"`
	TextContent    *string        `json:"textContent,omitempty"`
	ExternalURL    *string        `json:"externalUrl,omitempty"`
	Label          *string        `json:"label,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

// AddOutput adds an output to a node
func (s *NodeService) AddOutput(ctx context.Context, nodeID, userID uuid.UUID, req AddOutputRequest) (*models.NodeOutput, error) {
	// Verify access
	var orgID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT n.org_id FROM nodes n
		JOIN org_members om ON n.org_id = om.org_id
		WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
	`, nodeID, userID).Scan(&orgID)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}

	// Get next sort order
	var maxOrder int
	s.db.Pool.QueryRow(ctx, `SELECT COALESCE(MAX(sort_order), -1) FROM node_outputs WHERE node_id = $1`, nodeID).Scan(&maxOrder)

	output := &models.NodeOutput{
		ID:             uuid.New(),
		NodeID:         nodeID,
		OutputType:     req.OutputType,
		FileID:         req.FileID,
		StructuredData: req.StructuredData,
		TextContent:    req.TextContent,
		ExternalURL:    req.ExternalURL,
		Label:          req.Label,
		Metadata:       req.Metadata,
		SortOrder:      maxOrder + 1,
	}

	if output.Metadata == nil {
		output.Metadata = map[string]any{}
	}
	metadataJSON, _ := json.Marshal(output.Metadata)
	structuredDataJSON, _ := json.Marshal(output.StructuredData)

	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO node_outputs (id, node_id, output_type, file_id, structured_data, text_content,
		                          external_url, label, metadata, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at
	`, output.ID, output.NodeID, output.OutputType, output.FileID, structuredDataJSON,
		output.TextContent, output.ExternalURL, output.Label, metadataJSON, output.SortOrder).Scan(&output.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to add output: %w", err)
	}

	return output, nil
}

// RemoveOutput removes an output from a node
func (s *NodeService) RemoveOutput(ctx context.Context, nodeID, outputID, userID uuid.UUID) error {
	// Verify access
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM node_outputs no
			JOIN nodes n ON no.node_id = n.id
			JOIN org_members om ON n.org_id = om.org_id
			WHERE no.id = $1 AND no.node_id = $2 AND om.user_id = $3 AND n.deleted_at IS NULL
		)
	`, outputID, nodeID, userID).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to verify access: %w", err)
	}
	if !exists {
		return ErrNotFound
	}

	result, err := s.db.Pool.Exec(ctx, `DELETE FROM node_outputs WHERE id = $1`, outputID)
	if err != nil {
		return fmt.Errorf("failed to remove output: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// =====================================================
// NODE VERSIONING
// =====================================================

// ListVersions returns version history for a node
func (s *NodeService) ListVersions(ctx context.Context, nodeID, userID uuid.UUID) ([]models.NodeVersion, error) {
	// Verify access
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM nodes n
			JOIN org_members om ON n.org_id = om.org_id
			WHERE n.id = $1 AND om.user_id = $2
		)
	`, nodeID, userID).Scan(&exists)

	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, node_id, version, snapshot, change_type, change_summary, changed_by, created_at
		FROM node_versions
		WHERE node_id = $1
		ORDER BY version DESC
	`, nodeID)
	if err != nil {
		return nil, fmt.Errorf("failed to list versions: %w", err)
	}
	defer rows.Close()

	var versions []models.NodeVersion
	for rows.Next() {
		var v models.NodeVersion
		var snapshotJSON []byte
		if err := rows.Scan(&v.ID, &v.NodeID, &v.Version, &snapshotJSON, &v.ChangeType,
			&v.ChangeSummary, &v.ChangedBy, &v.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan version: %w", err)
		}
		json.Unmarshal(snapshotJSON, &v.Snapshot)
		versions = append(versions, v)
	}

	return versions, nil
}

// GetVersion returns a specific version of a node
func (s *NodeService) GetVersion(ctx context.Context, nodeID, userID uuid.UUID, version int) (*models.NodeVersion, error) {
	// Verify access
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM nodes n
			JOIN org_members om ON n.org_id = om.org_id
			WHERE n.id = $1 AND om.user_id = $2
		)
	`, nodeID, userID).Scan(&exists)

	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	var v models.NodeVersion
	var snapshotJSON []byte
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id, node_id, version, snapshot, change_type, change_summary, changed_by, created_at
		FROM node_versions
		WHERE node_id = $1 AND version = $2
	`, nodeID, version).Scan(&v.ID, &v.NodeID, &v.Version, &snapshotJSON, &v.ChangeType,
		&v.ChangeSummary, &v.ChangedBy, &v.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}

	json.Unmarshal(snapshotJSON, &v.Snapshot)
	return &v, nil
}

// Rollback restores a node to a previous version
func (s *NodeService) Rollback(ctx context.Context, nodeID, userID uuid.UUID, targetVersion int) (*models.Node, error) {
	var node *models.Node

	err := s.db.WithTransaction(ctx, func(tx pgx.Tx) error {
		// Get target version
		var snapshotJSON []byte
		err := tx.QueryRow(ctx, `
			SELECT nv.snapshot FROM node_versions nv
			JOIN nodes n ON nv.node_id = n.id
			JOIN org_members om ON n.org_id = om.org_id
			WHERE nv.node_id = $1 AND nv.version = $2 AND om.user_id = $3
		`, nodeID, targetVersion, userID).Scan(&snapshotJSON)

		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("failed to get target version: %w", err)
		}

		var snapshot models.Node
		json.Unmarshal(snapshotJSON, &snapshot)

		// Get current version number
		var currentVersion int
		err = tx.QueryRow(ctx, `SELECT version FROM nodes WHERE id = $1 FOR UPDATE`, nodeID).Scan(&currentVersion)
		if err != nil {
			return fmt.Errorf("failed to get current version: %w", err)
		}

		// Create version snapshot of current state before rollback
		var currentSnapshot models.Node
		var metaJSON, posJSON []byte
		tx.QueryRow(ctx, `
			SELECT id, org_id, project_id, parent_id, title, description, status, author_type,
			       author_user_id, supervisor_user_id, version, metadata, position, created_at, updated_at
			FROM nodes WHERE id = $1
		`, nodeID).Scan(
			&currentSnapshot.ID, &currentSnapshot.OrgID, &currentSnapshot.ProjectID, &currentSnapshot.ParentID,
			&currentSnapshot.Title, &currentSnapshot.Description, &currentSnapshot.Status, &currentSnapshot.AuthorType,
			&currentSnapshot.AuthorUserID, &currentSnapshot.SupervisorUserID, &currentSnapshot.Version,
			&metaJSON, &posJSON, &currentSnapshot.CreatedAt, &currentSnapshot.UpdatedAt,
		)
		json.Unmarshal(metaJSON, &currentSnapshot.Metadata)
		json.Unmarshal(posJSON, &currentSnapshot.Position)

		currentSnapshotJSON, _ := json.Marshal(currentSnapshot)
		_, err = tx.Exec(ctx, `
			INSERT INTO node_versions (id, node_id, version, snapshot, change_type, change_summary, changed_by)
			VALUES ($1, $2, $3, $4, 'rollback', $5, $6)
		`, uuid.New(), nodeID, currentVersion, currentSnapshotJSON,
			fmt.Sprintf("Rolled back to version %d", targetVersion), userID)
		if err != nil {
			return fmt.Errorf("failed to create rollback version: %w", err)
		}

		// Restore from snapshot
		newVersion := currentVersion + 1
		metadataJSON, _ := json.Marshal(snapshot.Metadata)
		positionJSON, _ := json.Marshal(snapshot.Position)

		var restored models.Node
		var restoredMetaJSON, restoredPosJSON []byte
		err = tx.QueryRow(ctx, `
			UPDATE nodes SET
				title = $2, description = $3, status = $4, parent_id = $5,
				supervisor_user_id = $6, metadata = $7, position = $8,
				version = $9, updated_at = NOW()
			WHERE id = $1
			RETURNING id, org_id, project_id, parent_id, title, description, status, author_type,
			          author_user_id, supervisor_user_id, version, metadata, position, created_at, updated_at
		`, nodeID, snapshot.Title, snapshot.Description, snapshot.Status, snapshot.ParentID,
			snapshot.SupervisorUserID, metadataJSON, positionJSON, newVersion).Scan(
			&restored.ID, &restored.OrgID, &restored.ProjectID, &restored.ParentID, &restored.Title,
			&restored.Description, &restored.Status, &restored.AuthorType, &restored.AuthorUserID,
			&restored.SupervisorUserID, &restored.Version, &restoredMetaJSON, &restoredPosJSON,
			&restored.CreatedAt, &restored.UpdatedAt,
		)

		if err != nil {
			return fmt.Errorf("failed to restore node: %w", err)
		}

		json.Unmarshal(restoredMetaJSON, &restored.Metadata)
		json.Unmarshal(restoredPosJSON, &restored.Position)
		node = &restored
		return nil
	})

	if err != nil {
		return nil, err
	}

	return node, nil
}

// =====================================================
// NODE RELATIONSHIPS
// =====================================================

// ListChildren returns child nodes
func (s *NodeService) ListChildren(ctx context.Context, nodeID, userID uuid.UUID) ([]models.Node, error) {
	// Verify access
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

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, org_id, project_id, parent_id, title, description, status, author_type,
		       author_user_id, supervisor_user_id, version, metadata, position,
		       locked_by, locked_at, lock_expires_at, created_at, updated_at, deleted_at
		FROM nodes
		WHERE parent_id = $1 AND deleted_at IS NULL
		ORDER BY created_at
	`, nodeID)
	if err != nil {
		return nil, fmt.Errorf("failed to list children: %w", err)
	}
	defer rows.Close()

	var children []models.Node
	for rows.Next() {
		node, err := s.scanNode(rows)
		if err != nil {
			return nil, err
		}
		children = append(children, *node)
	}

	return children, nil
}

// ListDependencies returns nodes this node depends on (via inputs)
func (s *NodeService) ListDependencies(ctx context.Context, nodeID, userID uuid.UUID) ([]models.Node, error) {
	// Verify access
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

	// Get nodes that this node depends on via node_inputs.source_node_id
	rows, err := s.db.Pool.Query(ctx, `
		SELECT DISTINCT n.id, n.org_id, n.project_id, n.parent_id, n.title, n.description, n.status, n.author_type,
		       n.author_user_id, n.supervisor_user_id, n.version, n.metadata, n.position,
		       n.locked_by, n.locked_at, n.lock_expires_at, n.created_at, n.updated_at, n.deleted_at
		FROM nodes n
		JOIN node_inputs ni ON n.id = ni.source_node_id
		WHERE ni.node_id = $1 AND n.deleted_at IS NULL
	`, nodeID)
	if err != nil {
		return nil, fmt.Errorf("failed to list dependencies: %w", err)
	}
	defer rows.Close()

	var deps []models.Node
	for rows.Next() {
		node, err := s.scanNode(rows)
		if err != nil {
			return nil, err
		}
		deps = append(deps, *node)
	}

	return deps, nil
}

// =====================================================
// NODE LOCKING
// =====================================================

const lockDuration = 5 * time.Minute
const lockKeyPrefix = "node_lock:"

// AcquireLock acquires a lock on a node
func (s *NodeService) AcquireLock(ctx context.Context, nodeID, userID uuid.UUID) error {
	// Use Redis for distributed lock + DB for persistence
	lockKey := lockKeyPrefix + nodeID.String()

	// Try to acquire Redis lock first (distributed coordination)
	acquired, err := s.redis.Client.SetNX(ctx, lockKey, userID.String(), lockDuration).Result()
	if err != nil {
		s.logger.Warn("Redis lock failed, falling back to DB only", zap.Error(err))
	} else if !acquired {
		// Check if we already own the lock
		owner, _ := s.redis.Client.Get(ctx, lockKey).Result()
		if owner != userID.String() {
			return ErrLockConflict
		}
		// We own it, extend the lock
		s.redis.Client.Expire(ctx, lockKey, lockDuration)
	}

	// Update DB lock status
	expiresAt := time.Now().Add(lockDuration)
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE nodes SET
			locked_by = $2,
			locked_at = NOW(),
			lock_expires_at = $3,
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		  AND (locked_by IS NULL OR locked_by = $2 OR lock_expires_at < NOW())
	`, nodeID, userID, expiresAt)

	if err != nil {
		// Clean up Redis lock on failure
		s.redis.Client.Del(ctx, lockKey)
		return fmt.Errorf("failed to acquire lock: %w", err)
	}

	if result.RowsAffected() == 0 {
		// Clean up Redis lock
		s.redis.Client.Del(ctx, lockKey)
		return ErrLockConflict
	}

	return nil
}

// ReleaseLock releases a lock on a node
func (s *NodeService) ReleaseLock(ctx context.Context, nodeID, userID uuid.UUID) error {
	// Release Redis lock
	lockKey := lockKeyPrefix + nodeID.String()
	owner, _ := s.redis.Client.Get(ctx, lockKey).Result()
	if owner == userID.String() {
		s.redis.Client.Del(ctx, lockKey)
	}

	// Release DB lock
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE nodes SET
			locked_by = NULL,
			locked_at = NULL,
			lock_expires_at = NULL,
			updated_at = NOW()
		WHERE id = $1 AND locked_by = $2
	`, nodeID, userID)

	if err != nil {
		return fmt.Errorf("failed to release lock: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// scanNode scans a node row into a Node struct
func (s *NodeService) scanNode(rows pgx.Rows) (*models.Node, error) {
	var node models.Node
	var metadataJSON, positionJSON []byte

	if err := rows.Scan(
		&node.ID, &node.OrgID, &node.ProjectID, &node.ParentID, &node.Title, &node.Description,
		&node.Status, &node.AuthorType, &node.AuthorUserID, &node.SupervisorUserID, &node.Version,
		&metadataJSON, &positionJSON, &node.LockedBy, &node.LockedAt, &node.LockExpiresAt,
		&node.CreatedAt, &node.UpdatedAt, &node.DeletedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to scan node: %w", err)
	}

	json.Unmarshal(metadataJSON, &node.Metadata)
	json.Unmarshal(positionJSON, &node.Position)
	return &node, nil
}

// getNodeInputs fetches all inputs for a node
func (s *NodeService) getNodeInputs(ctx context.Context, nodeID uuid.UUID) ([]models.NodeInput, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, node_id, input_type, file_id, source_node_id, source_node_version,
		       external_url, text_content, label, metadata, sort_order, created_at
		FROM node_inputs
		WHERE node_id = $1
		ORDER BY sort_order
	`, nodeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get inputs: %w", err)
	}
	defer rows.Close()

	var inputs []models.NodeInput
	for rows.Next() {
		var input models.NodeInput
		var metadataJSON []byte
		if err := rows.Scan(&input.ID, &input.NodeID, &input.InputType, &input.FileID,
			&input.SourceNodeID, &input.SourceNodeVersion, &input.ExternalURL, &input.TextContent,
			&input.Label, &metadataJSON, &input.SortOrder, &input.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan input: %w", err)
		}
		json.Unmarshal(metadataJSON, &input.Metadata)
		inputs = append(inputs, input)
	}

	return inputs, nil
}

// getNodeOutputs fetches all outputs for a node
func (s *NodeService) getNodeOutputs(ctx context.Context, nodeID uuid.UUID) ([]models.NodeOutput, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, node_id, output_type, file_id, structured_data, text_content,
		       external_url, label, metadata, sort_order, created_at
		FROM node_outputs
		WHERE node_id = $1
		ORDER BY sort_order
	`, nodeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get outputs: %w", err)
	}
	defer rows.Close()

	var outputs []models.NodeOutput
	for rows.Next() {
		var output models.NodeOutput
		var metadataJSON, structuredDataJSON []byte
		if err := rows.Scan(&output.ID, &output.NodeID, &output.OutputType, &output.FileID,
			&structuredDataJSON, &output.TextContent, &output.ExternalURL, &output.Label,
			&metadataJSON, &output.SortOrder, &output.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan output: %w", err)
		}
		json.Unmarshal(metadataJSON, &output.Metadata)
		json.Unmarshal(structuredDataJSON, &output.StructuredData)
		outputs = append(outputs, output)
	}

	return outputs, nil
}

// FileService handles file operations
type FileService struct {
	db     *database.DB
	s3     S3Client
	sqs    SQSClient
	cfg    *config.Config
	logger *zap.Logger
}

// S3Client interface for S3 operations (allows mocking in tests)
type S3Client interface {
	PresignedUploadURL(ctx context.Context, key, contentType string, expiration time.Duration) (string, error)
	PresignedDownloadURL(ctx context.Context, key string, expiration time.Duration) (string, error)
	HeadObject(ctx context.Context, key string) (int64, error)
	DeleteObject(ctx context.Context, key string) error
	Bucket() string
}

// SQSClient interface for SQS operations (allows mocking in tests)
type SQSClient interface {
	DispatchFileProcessingJob(ctx context.Context, job any) error
	DispatchAgentJob(ctx context.Context, job any) error
}

// FileProcessingJobMessage is the message sent to the file processing queue
type FileProcessingJobMessage struct {
	FileID      uuid.UUID  `json:"fileId"`
	OrgID       uuid.UUID  `json:"orgId"`
	StorageKey  string     `json:"storageKey"`
	Filename    string     `json:"filename"`
	ContentType string     `json:"contentType"`
	UploadedBy  *uuid.UUID `json:"uploadedBy,omitempty"`
}

func NewFileService(db *database.DB, s3 S3Client, sqs SQSClient, cfg *config.Config, logger *zap.Logger) *FileService {
	return &FileService{db: db, s3: s3, sqs: sqs, cfg: cfg, logger: logger}
}

// UploadURLRequest contains data for requesting an upload URL
type UploadURLRequest struct {
	Filename    string `json:"filename" binding:"required"`
	ContentType string `json:"contentType" binding:"required"`
	SizeBytes   *int64 `json:"sizeBytes,omitempty"`
}

// UploadURLResponse contains the presigned URL and file metadata
type UploadURLResponse struct {
	FileID    uuid.UUID `json:"fileId"`
	UploadURL string    `json:"uploadUrl"`
	ExpiresIn int       `json:"expiresIn"` // seconds
}

// GetUploadURL creates a file record and returns a presigned upload URL
func (s *FileService) GetUploadURL(ctx context.Context, orgID, userID uuid.UUID, req UploadURLRequest) (*UploadURLResponse, error) {
	// Generate file ID and storage key
	fileID := uuid.New()
	storageKey := fmt.Sprintf("orgs/%s/files/%s/%s", orgID.String(), fileID.String(), req.Filename)

	// Create file record in pending status
	metadataJSON, _ := json.Marshal(map[string]any{})
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO files (id, org_id, storage_key, storage_bucket, filename, content_type, size_bytes, processing_status, metadata, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
	`, fileID, orgID, storageKey, s.s3.Bucket(), req.Filename, req.ContentType, req.SizeBytes, metadataJSON, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to create file record: %w", err)
	}

	// Generate presigned URL (15 minutes expiration)
	expiration := 15 * time.Minute
	uploadURL, err := s.s3.PresignedUploadURL(ctx, storageKey, req.ContentType, expiration)
	if err != nil {
		return nil, fmt.Errorf("failed to generate upload URL: %w", err)
	}

	return &UploadURLResponse{
		FileID:    fileID,
		UploadURL: uploadURL,
		ExpiresIn: int(expiration.Seconds()),
	}, nil
}

// ConfirmUpload confirms a file upload and dispatches processing job
func (s *FileService) ConfirmUpload(ctx context.Context, fileID, userID uuid.UUID) (*models.File, error) {
	// Get file record
	file, err := s.getFileByID(ctx, fileID)
	if err != nil {
		return nil, err
	}

	// Verify user has access (same org)
	hasAccess, err := s.userHasOrgAccess(ctx, userID, file.OrgID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, ErrForbidden
	}

	// Verify file is in pending status
	if file.ProcessingStatus != "pending" {
		return nil, fmt.Errorf("file is not in pending status")
	}

	// Verify file exists in S3 and get size
	sizeBytes, err := s.s3.HeadObject(ctx, file.StorageKey)
	if err != nil {
		return nil, fmt.Errorf("file not found in storage: %w", err)
	}

	// Update file status to uploaded and set size
	err = s.db.Pool.QueryRow(ctx, `
		UPDATE files SET
			processing_status = 'uploaded',
			size_bytes = $2
		WHERE id = $1
		RETURNING id, org_id, storage_key, storage_bucket, filename, content_type, size_bytes,
		          processing_status, extracted_text, processing_error, metadata, created_at, uploaded_by
	`, fileID, sizeBytes).Scan(
		&file.ID, &file.OrgID, &file.StorageKey, &file.StorageBucket, &file.Filename,
		&file.ContentType, &file.SizeBytes, &file.ProcessingStatus, &file.ExtractedText,
		&file.ProcessingError, &file.Metadata, &file.CreatedAt, &file.UploadedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update file status: %w", err)
	}

	// Dispatch file processing job
	contentType := ""
	if file.ContentType != nil {
		contentType = *file.ContentType
	}
	err = s.sqs.DispatchFileProcessingJob(ctx, FileProcessingJobMessage{
		FileID:      file.ID,
		OrgID:       file.OrgID,
		StorageKey:  file.StorageKey,
		Filename:    file.Filename,
		ContentType: contentType,
		UploadedBy:  file.UploadedBy,
	})
	if err != nil {
		s.logger.Error("Failed to dispatch file processing job", zap.Error(err), zap.String("fileId", fileID.String()))
		// Don't fail the request - file is uploaded, processing can be retried
	}

	return file, nil
}

// FileWithDownloadURL contains file metadata and a download URL
type FileWithDownloadURL struct {
	models.File
	DownloadURL string `json:"downloadUrl,omitempty"`
}

// GetByID returns a file by ID with a download URL
func (s *FileService) GetByID(ctx context.Context, fileID, userID uuid.UUID) (*FileWithDownloadURL, error) {
	file, err := s.getFileByID(ctx, fileID)
	if err != nil {
		return nil, err
	}

	// Verify user has access
	hasAccess, err := s.userHasOrgAccess(ctx, userID, file.OrgID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, ErrForbidden
	}

	result := &FileWithDownloadURL{File: *file}

	// Generate download URL if file is uploaded or processed
	if file.ProcessingStatus == "uploaded" || file.ProcessingStatus == "processed" {
		downloadURL, err := s.s3.PresignedDownloadURL(ctx, file.StorageKey, 1*time.Hour)
		if err != nil {
			s.logger.Error("Failed to generate download URL", zap.Error(err))
		} else {
			result.DownloadURL = downloadURL
		}
	}

	return result, nil
}

// Delete deletes a file from S3 and the database
func (s *FileService) Delete(ctx context.Context, fileID, userID uuid.UUID) error {
	file, err := s.getFileByID(ctx, fileID)
	if err != nil {
		return err
	}

	// Verify user has access
	hasAccess, err := s.userHasOrgAccess(ctx, userID, file.OrgID)
	if err != nil {
		return err
	}
	if !hasAccess {
		return ErrForbidden
	}

	// Delete from S3
	err = s.s3.DeleteObject(ctx, file.StorageKey)
	if err != nil {
		s.logger.Error("Failed to delete file from S3", zap.Error(err), zap.String("key", file.StorageKey))
		// Continue to delete DB record even if S3 delete fails
	}

	// Delete from database
	_, err = s.db.Pool.Exec(ctx, `DELETE FROM files WHERE id = $1`, fileID)
	if err != nil {
		return fmt.Errorf("failed to delete file record: %w", err)
	}

	return nil
}

// getFileByID is a helper to get file by ID
func (s *FileService) getFileByID(ctx context.Context, fileID uuid.UUID) (*models.File, error) {
	var file models.File
	var metadataJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, org_id, storage_key, storage_bucket, filename, content_type, size_bytes,
		       processing_status, extracted_text, processing_error, metadata, created_at, uploaded_by
		FROM files WHERE id = $1
	`, fileID).Scan(
		&file.ID, &file.OrgID, &file.StorageKey, &file.StorageBucket, &file.Filename,
		&file.ContentType, &file.SizeBytes, &file.ProcessingStatus, &file.ExtractedText,
		&file.ProcessingError, &metadataJSON, &file.CreatedAt, &file.UploadedBy,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get file: %w", err)
	}

	if metadataJSON != nil {
		json.Unmarshal(metadataJSON, &file.Metadata)
	}

	return &file, nil
}

// userHasOrgAccess checks if a user has access to an organization
func (s *FileService) userHasOrgAccess(ctx context.Context, userID, orgID uuid.UUID) (bool, error) {
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM org_members WHERE user_id = $1 AND org_id = $2)
	`, userID, orgID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check org access: %w", err)
	}
	return exists, nil
}

// TemplateService handles template operations
type TemplateService struct {
	db     *database.DB
	logger *zap.Logger
}

func NewTemplateService(db *database.DB, logger *zap.Logger) *TemplateService {
	return &TemplateService{db: db, logger: logger}
}

// UserService handles user operations
type UserService struct {
	db     *database.DB
	logger *zap.Logger
}

func NewUserService(db *database.DB, logger *zap.Logger) *UserService {
	return &UserService{db: db, logger: logger}
}

// GetByID returns a user by ID
func (s *UserService) GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	var user models.User
	var settingsJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, cognito_sub, email, name, avatar_url, settings, created_at, updated_at
		FROM users WHERE id = $1
	`, userID).Scan(
		&user.ID, &user.CognitoSub, &user.Email, &user.Name, &user.AvatarURL,
		&settingsJSON, &user.CreatedAt, &user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	json.Unmarshal(settingsJSON, &user.Settings)
	return &user, nil
}

// UpdateUserRequest contains data for updating a user
type UpdateUserRequest struct {
	Name     *string              `json:"name,omitempty"`
	Settings *models.UserSettings `json:"settings,omitempty"`
}

// Update updates the current user's profile
func (s *UserService) Update(ctx context.Context, userID uuid.UUID, req UpdateUserRequest) (*models.User, error) {
	var user models.User
	var settingsJSON []byte

	if req.Settings != nil {
		settingsJSON, _ = json.Marshal(req.Settings)
	}

	err := s.db.Pool.QueryRow(ctx, `
		UPDATE users SET
			name = COALESCE($2, name),
			settings = COALESCE($3, settings),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, cognito_sub, email, name, avatar_url, settings, created_at, updated_at
	`, userID, req.Name, settingsJSON).Scan(
		&user.ID, &user.CognitoSub, &user.Email, &user.Name, &user.AvatarURL,
		&settingsJSON, &user.CreatedAt, &user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	json.Unmarshal(settingsJSON, &user.Settings)
	return &user, nil
}

// ListNotifications returns notifications for a user
func (s *UserService) ListNotifications(ctx context.Context, userID uuid.UUID, unreadOnly bool) ([]models.Notification, error) {
	query := `
		SELECT id, user_id, org_id, type, title, body, resource_type, resource_id, read_at, created_at
		FROM notifications
		WHERE user_id = $1
	`
	if unreadOnly {
		query += " AND read_at IS NULL"
	}
	query += " ORDER BY created_at DESC LIMIT 50"

	rows, err := s.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list notifications: %w", err)
	}
	defer rows.Close()

	var notifications []models.Notification
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.OrgID, &n.Type, &n.Title, &n.Body,
			&n.ResourceType, &n.ResourceID, &n.ReadAt, &n.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		notifications = append(notifications, n)
	}

	return notifications, nil
}

// MarkNotificationRead marks a notification as read
func (s *UserService) MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE notifications SET read_at = NOW()
		WHERE id = $1 AND user_id = $2 AND read_at IS NULL
	`, notificationID, userID)

	if err != nil {
		return fmt.Errorf("failed to mark notification read: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

// SearchService handles search operations
type SearchService struct {
	db     *database.DB
	logger *zap.Logger
}

func NewSearchService(db *database.DB, logger *zap.Logger) *SearchService {
	return &SearchService{db: db, logger: logger}
}

// AuthService handles authentication operations
type AuthService struct {
	db     *database.DB
	redis  *database.Redis
	cfg    *config.Config
	logger *zap.Logger
}

func NewAuthService(db *database.DB, redis *database.Redis, cfg *config.Config, logger *zap.Logger) *AuthService {
	return &AuthService{db: db, redis: redis, cfg: cfg, logger: logger}
}

// DevTokenClaims for generating dev tokens
type DevTokenClaims struct {
	UserID     string `json:"user_id"`
	Email      string `json:"email"`
	CognitoSub string `json:"sub"`
	jwt.RegisteredClaims
}

// GenerateDevToken creates a JWT token for development/testing
func (s *AuthService) GenerateDevToken(ctx context.Context, userID, email string) (string, time.Time, error) {
	expiresAt := time.Now().Add(24 * time.Hour)

	claims := DevTokenClaims{
		UserID:     userID,
		Email:      email,
		CognitoSub: "dev-" + userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "glassbox-dev",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, expiresAt, nil
}

// GetOrCreateUser finds a user by cognito sub or creates them if they don't exist
func (s *AuthService) GetOrCreateUser(ctx context.Context, cognitoSub, email string) (*models.User, error) {
	// Try to find existing user
	user, err := s.getUserByCognitoSub(ctx, cognitoSub)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	// Create new user
	user = &models.User{
		ID:         uuid.New(),
		CognitoSub: cognitoSub,
		Email:      email,
		Settings:   models.UserSettings{},
	}

	settingsJSON, _ := json.Marshal(user.Settings)

	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO users (id, cognito_sub, email, settings)
		VALUES ($1, $2, $3, $4)
	`, user.ID, user.CognitoSub, user.Email, settingsJSON)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (s *AuthService) getUserByCognitoSub(ctx context.Context, cognitoSub string) (*models.User, error) {
	var user models.User
	var settingsJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, cognito_sub, email, name, avatar_url, settings, created_at, updated_at
		FROM users WHERE cognito_sub = $1
	`, cognitoSub).Scan(
		&user.ID, &user.CognitoSub, &user.Email, &user.Name, &user.AvatarURL,
		&settingsJSON, &user.CreatedAt, &user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	json.Unmarshal(settingsJSON, &user.Settings)
	return &user, nil
}
