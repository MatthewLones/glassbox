package services

import (
	"github.com/glassbox/api/internal/config"
	"github.com/glassbox/api/internal/database"
	"go.uber.org/zap"
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
