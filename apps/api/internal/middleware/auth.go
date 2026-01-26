package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/glassbox/api/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	CognitoSub string `json:"sub"`
	jwt.RegisteredClaims
}

const (
	ContextUserID     = "user_id"
	ContextEmail      = "email"
	ContextCognitoSub = "cognito_sub"
)

func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
			})
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
			})
			return
		}

		tokenString := parts[1]

		// In production, validate against Cognito JWKS
		// For development, we'll use a simple JWT secret
		if cfg.IsDevelopment() {
			claims, err := validateDevToken(tokenString, cfg.JWTSecret)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "Invalid token",
				})
				return
			}
			c.Set(ContextUserID, claims.UserID)
			c.Set(ContextEmail, claims.Email)
			c.Set(ContextCognitoSub, claims.CognitoSub)
		} else {
			claims, err := validateCognitoToken(tokenString, cfg)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "Invalid token",
				})
				return
			}
			c.Set(ContextUserID, claims.UserID)
			c.Set(ContextEmail, claims.Email)
			c.Set(ContextCognitoSub, claims.CognitoSub)
		}

		c.Next()
	}
}

func validateDevToken(tokenString string, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, jwt.ErrSignatureInvalid
}

func validateCognitoToken(tokenString string, cfg *config.Config) (*Claims, error) {
	// TODO: Implement Cognito JWKS validation
	// 1. Fetch JWKS from https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
	// 2. Validate token signature using the appropriate public key
	// 3. Verify claims (iss, aud, exp, etc.)

	// For now, fall back to dev validation
	return validateDevToken(tokenString, cfg.JWTSecret)
}

// GetUserID extracts the user ID from the Gin context
func GetUserID(c *gin.Context) string {
	if userID, exists := c.Get(ContextUserID); exists {
		return userID.(string)
	}
	return ""
}

// GetEmail extracts the email from the Gin context
func GetEmail(c *gin.Context) string {
	if email, exists := c.Get(ContextEmail); exists {
		return email.(string)
	}
	return ""
}

// GetCognitoSub extracts the Cognito sub from the Gin context
func GetCognitoSub(c *gin.Context) string {
	if sub, exists := c.Get(ContextCognitoSub); exists {
		return sub.(string)
	}
	return ""
}
