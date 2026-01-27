package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/glassbox/api/internal/middleware"
	"github.com/glassbox/api/internal/services"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	Health     *HealthHandler
	Auth       *AuthHandler
	Orgs       *OrganizationHandler
	Projects   *ProjectHandler
	Nodes      *NodeHandler
	Files      *FileHandler
	Executions *ExecutionHandler
	Templates  *TemplateHandler
	Users      *UserHandler
	Search     *SearchHandler
}

// NewHandlers creates all handlers with their dependencies
func NewHandlers(svc *services.Services, logger *zap.Logger) *Handlers {
	return &Handlers{
		Health:     NewHealthHandler(),
		Auth:       NewAuthHandler(svc.Auth, logger),
		Orgs:       NewOrganizationHandler(svc.Orgs, logger),
		Projects:   NewProjectHandler(svc.Projects, logger),
		Nodes:      NewNodeHandler(svc.Nodes, logger),
		Files:      NewFileHandler(svc.Files, logger),
		Executions: NewExecutionHandler(svc.Executions, logger),
		Templates:  NewTemplateHandler(svc.Templates, logger),
		Users:      NewUserHandler(svc.Users, logger),
		Search:     NewSearchHandler(svc.Search, logger),
	}
}

// =====================================================
// HEALTH HANDLER
// =====================================================

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

func (h *HealthHandler) Check(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "glassbox-api",
	})
}

// =====================================================
// AUTH HANDLER
// =====================================================

type AuthHandler struct {
	svc    *services.AuthService
	logger *zap.Logger
}

func NewAuthHandler(svc *services.AuthService, logger *zap.Logger) *AuthHandler {
	return &AuthHandler{svc: svc, logger: logger}
}

// DevTokenRequest for generating dev tokens
type DevTokenRequest struct {
	UserID string `json:"userId" binding:"required"`
	Email  string `json:"email" binding:"required"`
}

// GenerateDevToken creates a JWT for local development
func (h *AuthHandler) GenerateDevToken(c *gin.Context) {
	var req DevTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	token, expiresAt, err := h.svc.GenerateDevToken(c.Request.Context(), req.UserID, req.Email)
	if err != nil {
		h.logger.Error("Failed to generate dev token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     token,
		"expiresAt": expiresAt,
	})
}

func (h *AuthHandler) GetWSToken(c *gin.Context) {
	// TODO: Implement WS token generation
	c.JSON(http.StatusOK, gin.H{
		"token":     "ws-token-placeholder",
		"expiresAt": "2024-01-15T10:05:00Z",
	})
}

// =====================================================
// ORGANIZATION HANDLER
// =====================================================

type OrganizationHandler struct {
	svc    *services.OrganizationService
	logger *zap.Logger
}

func NewOrganizationHandler(svc *services.OrganizationService, logger *zap.Logger) *OrganizationHandler {
	return &OrganizationHandler{svc: svc, logger: logger}
}

func (h *OrganizationHandler) List(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	orgs, err := h.svc.ListByUser(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("Failed to list organizations", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list organizations"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orgs})
}

func (h *OrganizationHandler) Create(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req services.CreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	org, err := h.svc.Create(c.Request.Context(), req, userID)
	if err != nil {
		h.logger.Error("Failed to create organization", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}

	c.JSON(http.StatusCreated, org)
}

func (h *OrganizationHandler) Get(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	orgID, err := uuid.Parse(c.Param("orgId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	org, err := h.svc.GetByID(c.Request.Context(), orgID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get organization", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get organization"})
		return
	}

	c.JSON(http.StatusOK, org)
}

func (h *OrganizationHandler) Update(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	orgID, err := uuid.Parse(c.Param("orgId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	var req services.UpdateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	org, err := h.svc.Update(c.Request.Context(), orgID, userID, req)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to update organization", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}

	c.JSON(http.StatusOK, org)
}

func (h *OrganizationHandler) Delete(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	orgID, err := uuid.Parse(c.Param("orgId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	err = h.svc.Delete(c.Request.Context(), orgID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to delete organization", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete organization"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// =====================================================
// PROJECT HANDLER
// =====================================================

type ProjectHandler struct {
	svc    *services.ProjectService
	logger *zap.Logger
}

func NewProjectHandler(svc *services.ProjectService, logger *zap.Logger) *ProjectHandler {
	return &ProjectHandler{svc: svc, logger: logger}
}

func (h *ProjectHandler) List(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *ProjectHandler) Create(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{}) }
func (h *ProjectHandler) Get(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{}) }
func (h *ProjectHandler) Update(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) }
func (h *ProjectHandler) Delete(c *gin.Context) { c.JSON(http.StatusNoContent, nil) }

// =====================================================
// NODE HANDLER
// =====================================================

type NodeHandler struct {
	svc    *services.NodeService
	logger *zap.Logger
}

func NewNodeHandler(svc *services.NodeService, logger *zap.Logger) *NodeHandler {
	return &NodeHandler{svc: svc, logger: logger}
}

func (h *NodeHandler) List(c *gin.Context)             { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *NodeHandler) Create(c *gin.Context)           { c.JSON(http.StatusCreated, gin.H{}) }
func (h *NodeHandler) Get(c *gin.Context)              { c.JSON(http.StatusOK, gin.H{}) }
func (h *NodeHandler) Update(c *gin.Context)           { c.JSON(http.StatusOK, gin.H{}) }
func (h *NodeHandler) Delete(c *gin.Context)           { c.JSON(http.StatusNoContent, nil) }
func (h *NodeHandler) ListVersions(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *NodeHandler) GetVersion(c *gin.Context)       { c.JSON(http.StatusOK, gin.H{}) }
func (h *NodeHandler) Rollback(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{}) }
func (h *NodeHandler) AddInput(c *gin.Context)         { c.JSON(http.StatusCreated, gin.H{}) }
func (h *NodeHandler) RemoveInput(c *gin.Context)      { c.JSON(http.StatusNoContent, nil) }
func (h *NodeHandler) AddOutput(c *gin.Context)        { c.JSON(http.StatusCreated, gin.H{}) }
func (h *NodeHandler) RemoveOutput(c *gin.Context)     { c.JSON(http.StatusNoContent, nil) }
func (h *NodeHandler) ListChildren(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *NodeHandler) ListDependencies(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *NodeHandler) AcquireLock(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{}) }
func (h *NodeHandler) ReleaseLock(c *gin.Context)      { c.JSON(http.StatusNoContent, nil) }

// =====================================================
// FILE HANDLER
// =====================================================

type FileHandler struct {
	svc    *services.FileService
	logger *zap.Logger
}

func NewFileHandler(svc *services.FileService, logger *zap.Logger) *FileHandler {
	return &FileHandler{svc: svc, logger: logger}
}

func (h *FileHandler) GetUploadURL(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{}) }
func (h *FileHandler) ConfirmUpload(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) }
func (h *FileHandler) Get(c *gin.Context)           { c.JSON(http.StatusOK, gin.H{}) }
func (h *FileHandler) Delete(c *gin.Context)        { c.JSON(http.StatusNoContent, nil) }

// =====================================================
// EXECUTION HANDLER
// =====================================================

type ExecutionHandler struct {
	svc    *services.ExecutionService
	logger *zap.Logger
}

func NewExecutionHandler(svc *services.ExecutionService, logger *zap.Logger) *ExecutionHandler {
	return &ExecutionHandler{svc: svc, logger: logger}
}

func (h *ExecutionHandler) Start(c *gin.Context)      { c.JSON(http.StatusAccepted, gin.H{}) }
func (h *ExecutionHandler) GetCurrent(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) }
func (h *ExecutionHandler) Pause(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{}) }
func (h *ExecutionHandler) Resume(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{}) }
func (h *ExecutionHandler) Cancel(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{}) }
func (h *ExecutionHandler) Get(c *gin.Context)        { c.JSON(http.StatusOK, gin.H{}) }
func (h *ExecutionHandler) GetTrace(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }

// =====================================================
// TEMPLATE HANDLER
// =====================================================

type TemplateHandler struct {
	svc    *services.TemplateService
	logger *zap.Logger
}

func NewTemplateHandler(svc *services.TemplateService, logger *zap.Logger) *TemplateHandler {
	return &TemplateHandler{svc: svc, logger: logger}
}

func (h *TemplateHandler) ListPublic(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *TemplateHandler) Get(c *gin.Context)        { c.JSON(http.StatusOK, gin.H{}) }
func (h *TemplateHandler) Apply(c *gin.Context)      { c.JSON(http.StatusCreated, gin.H{}) }

// =====================================================
// USER HANDLER
// =====================================================

type UserHandler struct {
	svc    *services.UserService
	logger *zap.Logger
}

func NewUserHandler(svc *services.UserService, logger *zap.Logger) *UserHandler {
	return &UserHandler{svc: svc, logger: logger}
}

func (h *UserHandler) GetMe(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.svc.GetByID(c.Request.Context(), userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateMe(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req services.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	user, err := h.svc.Update(c.Request.Context(), userID, req)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to update user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) ListNotifications(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	unreadOnly := c.Query("unread") == "true"

	notifications, err := h.svc.ListNotifications(c.Request.Context(), userID, unreadOnly)
	if err != nil {
		h.logger.Error("Failed to list notifications", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": notifications})
}

func (h *UserHandler) MarkNotificationRead(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	notificationID, err := uuid.Parse(c.Param("notificationId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	err = h.svc.MarkNotificationRead(c.Request.Context(), userID, notificationID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to mark notification read", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// =====================================================
// SEARCH HANDLER
// =====================================================

type SearchHandler struct {
	svc    *services.SearchService
	logger *zap.Logger
}

func NewSearchHandler(svc *services.SearchService, logger *zap.Logger) *SearchHandler {
	return &SearchHandler{svc: svc, logger: logger}
}

func (h *SearchHandler) Search(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }
func (h *SearchHandler) SemanticSearch(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"data": []any{}}) }

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// getUserUUID extracts user ID from context and converts to UUID
func getUserUUID(c *gin.Context) (uuid.UUID, error) {
	userIDStr := middleware.GetUserID(c)
	if userIDStr == "" {
		return uuid.Nil, errors.New("user ID not found in context")
	}
	return uuid.Parse(userIDStr)
}
