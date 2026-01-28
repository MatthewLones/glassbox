package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

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
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get user email from context
	userEmail := middleware.GetEmail(c)
	if userEmail == "" {
		userEmail = "unknown@unknown.com"
	}

	token, expiresAt, err := h.svc.GenerateWSToken(c.Request.Context(), userID.String(), userEmail)
	if err != nil {
		h.logger.Error("Failed to generate WS token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     token,
		"expiresAt": expiresAt.Format(time.RFC3339),
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

func (h *ProjectHandler) List(c *gin.Context) {
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

	projects, err := h.svc.ListByOrg(c.Request.Context(), orgID, userID)
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to list projects", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list projects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": projects})
}

func (h *ProjectHandler) Create(c *gin.Context) {
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

	var req services.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	project, err := h.svc.Create(c.Request.Context(), orgID, userID, req)
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to create project", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) Get(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	project, err := h.svc.GetByID(c.Request.Context(), projectID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get project", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get project"})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Update(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	var req services.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	project, err := h.svc.Update(c.Request.Context(), projectID, userID, req)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to update project", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Delete(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	err = h.svc.Delete(c.Request.Context(), projectID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to delete project", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

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

func (h *NodeHandler) List(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	var filters services.ListNodesRequest
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid query parameters"})
		return
	}

	nodes, err := h.svc.ListByProject(c.Request.Context(), projectID, userID, filters)
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to list nodes", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list nodes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": nodes})
}

func (h *NodeHandler) Create(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	var req services.CreateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	node, err := h.svc.Create(c.Request.Context(), projectID, userID, req)
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to create node", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create node"})
		return
	}

	c.JSON(http.StatusCreated, node)
}

func (h *NodeHandler) Get(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	node, err := h.svc.GetByID(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get node", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get node"})
		return
	}

	c.JSON(http.StatusOK, node)
}

func (h *NodeHandler) Update(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	var req services.UpdateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	node, err := h.svc.Update(c.Request.Context(), nodeID, userID, req)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if errors.Is(err, services.ErrLockConflict) {
		c.JSON(http.StatusConflict, gin.H{"error": "Node is locked by another user"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to update node", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update node"})
		return
	}

	c.JSON(http.StatusOK, node)
}

func (h *NodeHandler) Delete(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	err = h.svc.Delete(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to delete node", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete node"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *NodeHandler) ListVersions(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	versions, err := h.svc.ListVersions(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to list versions", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list versions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": versions})
}

func (h *NodeHandler) GetVersion(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	var version int
	if _, err := fmt.Sscanf(c.Param("version"), "%d", &version); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
		return
	}

	nodeVersion, err := h.svc.GetVersion(c.Request.Context(), nodeID, userID, version)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get version", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get version"})
		return
	}

	c.JSON(http.StatusOK, nodeVersion)
}

func (h *NodeHandler) Rollback(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	var version int
	if _, err := fmt.Sscanf(c.Param("version"), "%d", &version); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
		return
	}

	node, err := h.svc.Rollback(c.Request.Context(), nodeID, userID, version)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to rollback", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rollback"})
		return
	}

	c.JSON(http.StatusOK, node)
}

func (h *NodeHandler) AddInput(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	var req services.AddInputRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	input, err := h.svc.AddInput(c.Request.Context(), nodeID, userID, req)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to add input", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add input"})
		return
	}

	c.JSON(http.StatusCreated, input)
}

func (h *NodeHandler) RemoveInput(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	inputID, err := uuid.Parse(c.Param("inputId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input ID"})
		return
	}

	err = h.svc.RemoveInput(c.Request.Context(), nodeID, inputID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Input not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to remove input", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove input"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *NodeHandler) AddOutput(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	var req services.AddOutputRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	output, err := h.svc.AddOutput(c.Request.Context(), nodeID, userID, req)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to add output", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add output"})
		return
	}

	c.JSON(http.StatusCreated, output)
}

func (h *NodeHandler) RemoveOutput(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	outputID, err := uuid.Parse(c.Param("outputId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid output ID"})
		return
	}

	err = h.svc.RemoveOutput(c.Request.Context(), nodeID, outputID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Output not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to remove output", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove output"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *NodeHandler) ListChildren(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	children, err := h.svc.ListChildren(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to list children", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list children"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": children})
}

func (h *NodeHandler) ListDependencies(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	deps, err := h.svc.ListDependencies(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to list dependencies", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list dependencies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": deps})
}

func (h *NodeHandler) AcquireLock(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	err = h.svc.AcquireLock(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrLockConflict) {
		c.JSON(http.StatusConflict, gin.H{"error": "Node is locked by another user"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to acquire lock", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to acquire lock"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Lock acquired"})
}

func (h *NodeHandler) ReleaseLock(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	err = h.svc.ReleaseLock(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lock not found or not owned by you"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to release lock", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to release lock"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

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

// GetUploadURL generates a presigned URL for file upload
func (h *FileHandler) GetUploadURL(c *gin.Context) {
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

	var req services.UploadURLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	resp, err := h.svc.GetUploadURL(c.Request.Context(), orgID, userID, req)
	if err != nil {
		h.logger.Error("Failed to get upload URL", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate upload URL"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ConfirmUpload confirms that a file has been uploaded to S3
func (h *FileHandler) ConfirmUpload(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	fileID, err := uuid.Parse(c.Param("fileId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	file, err := h.svc.ConfirmUpload(c.Request.Context(), fileID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to confirm upload", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, file)
}

// Get returns file metadata and a download URL
func (h *FileHandler) Get(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	fileID, err := uuid.Parse(c.Param("fileId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	file, err := h.svc.GetByID(c.Request.Context(), fileID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get file", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file"})
		return
	}

	c.JSON(http.StatusOK, file)
}

// Delete deletes a file from S3 and the database
func (h *FileHandler) Delete(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	fileID, err := uuid.Parse(c.Param("fileId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	err = h.svc.Delete(c.Request.Context(), fileID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to delete file", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// =====================================================
// EXECUTION HANDLER
// =====================================================

type ExecutionHandler struct {
	svc    *services.ExecutionServiceFull
	logger *zap.Logger
}

func NewExecutionHandler(svc *services.ExecutionServiceFull, logger *zap.Logger) *ExecutionHandler {
	return &ExecutionHandler{svc: svc, logger: logger}
}

// Start starts a new agent execution for a node
func (h *ExecutionHandler) Start(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	execution, err := h.svc.Start(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if errors.Is(err, services.ErrExecutionAlreadyActive) {
		c.JSON(http.StatusConflict, gin.H{"error": "An execution is already running for this node"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to start execution", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start execution"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"execution": execution})
}

// GetCurrent returns the current active execution for a node
func (h *ExecutionHandler) GetCurrent(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	execution, err := h.svc.GetCurrentForNode(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active execution found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get current execution", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get execution"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"execution": execution})
}

// Pause pauses a running execution
func (h *ExecutionHandler) Pause(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	err = h.svc.Pause(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active execution found"})
		return
	}
	if errors.Is(err, services.ErrExecutionNotPausable) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution cannot be paused in its current state"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to pause execution", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to pause execution"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Execution pausing"})
}

// Resume resumes a paused execution
func (h *ExecutionHandler) Resume(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	err = h.svc.Resume(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "No paused execution found"})
		return
	}
	if errors.Is(err, services.ErrExecutionNotResumable) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution cannot be resumed in its current state"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to resume execution", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resume execution"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Execution resumed"})
}

// Cancel cancels an active execution
func (h *ExecutionHandler) Cancel(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	err = h.svc.Cancel(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active execution found"})
		return
	}
	if errors.Is(err, services.ErrExecutionNotCancellable) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution cannot be cancelled in its current state"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to cancel execution", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel execution"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Execution cancelled"})
}

// Get returns an execution by ID
func (h *ExecutionHandler) Get(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	execution, err := h.svc.GetByIDWithHumanInput(c.Request.Context(), executionID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get execution", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get execution"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"execution": execution})
}

// GetTrace returns the full trace for an execution
func (h *ExecutionHandler) GetTrace(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	events, err := h.svc.GetTrace(c.Request.Context(), executionID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get trace", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get trace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"events": events})
}

// ProvideInputRequest for human input
type ProvideInputRequest struct {
	Input map[string]any `json:"input" binding:"required"`
}

// ProvideInput provides human input to an execution awaiting input
func (h *ExecutionHandler) ProvideInput(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	executionID, err := uuid.Parse(c.Param("executionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	var req ProvideInputRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err = h.svc.ProvideInput(c.Request.Context(), executionID, userID, req.Input)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}
	if errors.Is(err, services.ErrExecutionNotAwaitingInput) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution is not awaiting input"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to provide input", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to provide input"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Input received, execution resuming"})
}

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

// Search performs text search across nodes and files
func (h *SearchHandler) Search(c *gin.Context) {
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

	var req services.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	resp, err := h.svc.TextSearch(c.Request.Context(), orgID, userID, req)
	if errors.Is(err, services.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to perform text search", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to perform search"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// SemanticSearchRequest for the API - includes query for embedding generation
type SemanticSearchAPIRequest struct {
	Query       string     `json:"query" binding:"required"`
	ProjectID   *uuid.UUID `json:"projectId,omitempty"`
	Limit       int        `json:"limit,omitempty"`
	Threshold   *float64   `json:"threshold,omitempty"`
	IncludeText bool       `json:"includeText,omitempty"`
}

// SemanticSearch performs vector similarity search
func (h *SearchHandler) SemanticSearch(c *gin.Context) {
	_, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	_, err = uuid.Parse(c.Param("orgId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	var req SemanticSearchAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// For semantic search, the embedding needs to be generated from the query
	// This would typically be done via an embedding service
	// For now, return an error indicating embeddings are not yet configured
	// In production, you'd call an embedding API (OpenAI, Voyage, etc.)
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error":   "Semantic search requires embedding generation",
		"message": "Configure OPENAI_API_KEY or another embedding provider to use semantic search",
		"query":   req.Query,
	})
}

// GetNodeContext returns context information for a node (for RAG)
func (h *SearchHandler) GetNodeContext(c *gin.Context) {
	userID, err := getUserUUID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("nodeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node ID"})
		return
	}

	ctx, err := h.svc.GetNodeContext(c.Request.Context(), nodeID, userID)
	if errors.Is(err, services.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	if err != nil {
		h.logger.Error("Failed to get node context", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get node context"})
		return
	}

	c.JSON(http.StatusOK, ctx)
}

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
