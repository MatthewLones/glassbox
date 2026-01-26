package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glassbox/api/internal/config"
	"golang.org/x/time/rate"
)

// In-memory rate limiter for development
// In production, use Redis-based rate limiting
var limiter = rate.NewLimiter(rate.Every(time.Minute/100), 100)

func RateLimit(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID for per-user rate limiting
		userID := GetUserID(c)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		// For development, use simple in-memory rate limiter
		if cfg.IsDevelopment() {
			if !limiter.Allow() {
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error":       "Rate limit exceeded",
					"retry_after": 60,
				})
				return
			}
			c.Next()
			return
		}

		// For production, implement Redis-based rate limiting
		// This is a placeholder - implement with Redis in services
		key := fmt.Sprintf("ratelimit:%s:%d", userID, time.Now().Unix()/60)
		_ = key // Use in Redis implementation

		c.Next()
	}
}
