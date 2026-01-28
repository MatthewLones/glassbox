package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/glassbox/api/internal/config"
	"github.com/glassbox/api/internal/database"
	"github.com/glassbox/api/internal/handlers"
	"github.com/glassbox/api/internal/middleware"
	"github.com/glassbox/api/internal/queue"
	"github.com/glassbox/api/internal/services"
	"github.com/glassbox/api/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

func main() {
	// Load .env file in development
	if os.Getenv("GO_ENV") != "production" {
		if err := godotenv.Load(); err != nil {
			log.Println("No .env file found")
		}
	}

	// Initialize logger
	logger, err := initLogger()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// Initialize database connection
	db, err := database.NewConnection(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Initialize Redis connection
	redis, err := database.NewRedisClient(cfg.RedisURL)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", zap.Error(err))
	}
	defer redis.Close()

	// Initialize S3 client
	s3Client, err := storage.NewS3Client(cfg, logger)
	if err != nil {
		logger.Fatal("Failed to initialize S3 client", zap.Error(err))
	}

	// Initialize SQS client
	sqsClient, err := queue.NewSQSClient(cfg, logger)
	if err != nil {
		logger.Fatal("Failed to initialize SQS client", zap.Error(err))
	}

	// Initialize services
	svc := services.NewServices(db, redis, s3Client, sqsClient, cfg, logger)

	// Initialize handlers
	h := handlers.NewHandlers(svc, logger)

	// Setup router
	router := setupRouter(cfg, h, logger)

	// Create server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		logger.Info("Starting server", zap.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
}

func initLogger() (*zap.Logger, error) {
	if os.Getenv("GO_ENV") == "production" {
		return zap.NewProduction()
	}
	return zap.NewDevelopment()
}

func setupRouter(cfg *config.Config, h *handlers.Handlers, logger *zap.Logger) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Global middleware
	r.Use(gin.Recovery())
	r.Use(middleware.Logger(logger))
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.RequestID())

	// Health check (no auth required)
	r.GET("/health", h.Health.Check)

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		// Auth routes
		auth := v1.Group("/auth")
		{
			// Dev token endpoint (no auth required - for local development only)
			if cfg.IsDevelopment() {
				auth.POST("/dev-token", h.Auth.GenerateDevToken)
			}
			auth.POST("/ws-token", middleware.Auth(cfg), h.Auth.GetWSToken)
		}

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.Auth(cfg))
		protected.Use(middleware.RateLimit(cfg))
		{
			// Organizations
			orgs := protected.Group("/orgs")
			{
				orgs.GET("", h.Orgs.List)
				orgs.POST("", h.Orgs.Create)
				orgs.GET("/:orgId", h.Orgs.Get)
				orgs.PATCH("/:orgId", h.Orgs.Update)
				orgs.DELETE("/:orgId", h.Orgs.Delete)

				// Projects under org
				orgs.GET("/:orgId/projects", h.Projects.List)
				orgs.POST("/:orgId/projects", h.Projects.Create)

				// Files under org
				orgs.POST("/:orgId/files/upload", h.Files.GetUploadURL)

				// Search under org
				orgs.POST("/:orgId/search", h.Search.Search)
				orgs.POST("/:orgId/search/semantic", h.Search.SemanticSearch)
			}

			// Projects
			projects := protected.Group("/projects")
			{
				projects.GET("/:projectId", h.Projects.Get)
				projects.PATCH("/:projectId", h.Projects.Update)
				projects.DELETE("/:projectId", h.Projects.Delete)

				// Nodes under project
				projects.GET("/:projectId/nodes", h.Nodes.List)
				projects.POST("/:projectId/nodes", h.Nodes.Create)
			}

			// Nodes
			nodes := protected.Group("/nodes")
			{
				nodes.GET("/:nodeId", h.Nodes.Get)
				nodes.PATCH("/:nodeId", h.Nodes.Update)
				nodes.DELETE("/:nodeId", h.Nodes.Delete)

				// Node versions
				nodes.GET("/:nodeId/versions", h.Nodes.ListVersions)
				nodes.GET("/:nodeId/versions/:version", h.Nodes.GetVersion)
				nodes.POST("/:nodeId/rollback/:version", h.Nodes.Rollback)

				// Node inputs/outputs
				nodes.POST("/:nodeId/inputs", h.Nodes.AddInput)
				nodes.DELETE("/:nodeId/inputs/:inputId", h.Nodes.RemoveInput)
				nodes.POST("/:nodeId/outputs", h.Nodes.AddOutput)
				nodes.DELETE("/:nodeId/outputs/:outputId", h.Nodes.RemoveOutput)

				// Node children and dependencies
				nodes.GET("/:nodeId/children", h.Nodes.ListChildren)
				nodes.GET("/:nodeId/dependencies", h.Nodes.ListDependencies)

				// Node locking
				nodes.POST("/:nodeId/lock", h.Nodes.AcquireLock)
				nodes.DELETE("/:nodeId/lock", h.Nodes.ReleaseLock)

				// Agent execution
				nodes.POST("/:nodeId/execute", h.Executions.Start)
				nodes.GET("/:nodeId/execution", h.Executions.GetCurrent)
				nodes.POST("/:nodeId/execution/pause", h.Executions.Pause)
				nodes.POST("/:nodeId/execution/resume", h.Executions.Resume)
				nodes.POST("/:nodeId/execution/cancel", h.Executions.Cancel)
			}

			// Executions
			executions := protected.Group("/executions")
			{
				executions.GET("/:executionId", h.Executions.Get)
				executions.GET("/:executionId/trace", h.Executions.GetTrace)
			}

			// Files
			files := protected.Group("/files")
			{
				files.POST("/:fileId/confirm", h.Files.ConfirmUpload)
				files.GET("/:fileId", h.Files.Get)
				files.DELETE("/:fileId", h.Files.Delete)
			}

			// Templates
			templates := protected.Group("/templates")
			{
				templates.GET("", h.Templates.ListPublic)
				templates.GET("/:templateId", h.Templates.Get)
				templates.POST("/:templateId/apply", h.Templates.Apply)
			}

			// User
			user := protected.Group("/users")
			{
				user.GET("/me", h.Users.GetMe)
				user.PATCH("/me", h.Users.UpdateMe)
				user.GET("/me/notifications", h.Users.ListNotifications)
				user.POST("/me/notifications/:notificationId/read", h.Users.MarkNotificationRead)
			}
		}
	}

	return r
}
