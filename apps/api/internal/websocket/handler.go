package websocket

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glassbox/api/internal/database"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: In production, validate origin against allowed origins
		return true
	},
}

// WSTokenData contains validated WS token information
type WSTokenData struct {
	UserID    string
	UserEmail string
	OrgID     string
	ExpiresAt time.Time
}

// TokenValidator is a function type for validating WS tokens
type TokenValidator func(ctx context.Context, token string) (*WSTokenData, error)

// Handler handles WebSocket upgrade requests
type Handler struct {
	hub           *Hub
	redis         *database.Redis
	logger        *zap.Logger
	validateToken TokenValidator
}

// NewHandler creates a new WebSocket handler
func NewHandler(hub *Hub, redis *database.Redis, validateToken TokenValidator, logger *zap.Logger) *Handler {
	return &Handler{
		hub:           hub,
		redis:         redis,
		logger:        logger,
		validateToken: validateToken,
	}
}

// ServeWS handles WebSocket upgrade requests
// Expected: GET /ws?token=<ws_token>
func (h *Handler) ServeWS(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
		return
	}

	// Validate WS token
	tokenData, err := h.validateToken(c.Request.Context(), token)
	if err != nil {
		h.logger.Warn("Invalid WS token", zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
		return
	}

	// Create client
	client := NewClient(h.hub, conn, tokenData.UserID, tokenData.UserEmail, h.logger)

	// Register with hub
	h.hub.register <- client

	h.logger.Info("WebSocket connection established",
		zap.String("userId", tokenData.UserID),
		zap.String("email", tokenData.UserEmail),
	)

	// Start goroutines for reading and writing
	go client.WritePump()
	go client.ReadPump()
}
