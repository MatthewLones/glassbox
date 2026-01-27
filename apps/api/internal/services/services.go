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
	Executions *ExecutionService
	Templates  *TemplateService
	Users      *UserService
	Search     *SearchService
	Auth       *AuthService
}

// NewServices creates all services with their dependencies
func NewServices(db *database.DB, redis *database.Redis, cfg *config.Config, logger *zap.Logger) *Services {
	return &Services{
		Orgs:       NewOrganizationService(db, logger),
		Projects:   NewProjectService(db, logger),
		Nodes:      NewNodeService(db, redis, logger),
		Files:      NewFileService(db, cfg, logger),
		Executions: NewExecutionService(db, redis, cfg, logger),
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

// NodeService handles node operations
type NodeService struct {
	db     *database.DB
	redis  *database.Redis
	logger *zap.Logger
}

func NewNodeService(db *database.DB, redis *database.Redis, logger *zap.Logger) *NodeService {
	return &NodeService{db: db, redis: redis, logger: logger}
}

// FileService handles file operations
type FileService struct {
	db     *database.DB
	cfg    *config.Config
	logger *zap.Logger
}

func NewFileService(db *database.DB, cfg *config.Config, logger *zap.Logger) *FileService {
	return &FileService{db: db, cfg: cfg, logger: logger}
}

// ExecutionService handles agent execution operations
type ExecutionService struct {
	db     *database.DB
	redis  *database.Redis
	cfg    *config.Config
	logger *zap.Logger
}

func NewExecutionService(db *database.DB, redis *database.Redis, cfg *config.Config, logger *zap.Logger) *ExecutionService {
	return &ExecutionService{db: db, redis: redis, cfg: cfg, logger: logger}
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
