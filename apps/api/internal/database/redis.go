package database

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Redis struct {
	Client *redis.Client
}

func NewRedisClient(redisURL string) (*Redis, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping Redis: %w", err)
	}

	return &Redis{Client: client}, nil
}

func (r *Redis) Close() error {
	return r.Client.Close()
}

// Publish publishes a message to a Redis channel
func (r *Redis) Publish(ctx context.Context, channel string, message interface{}) error {
	return r.Client.Publish(ctx, channel, message).Err()
}

// Subscribe subscribes to a Redis channel
func (r *Redis) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return r.Client.Subscribe(ctx, channels...)
}

// Rate limiting helpers
func (r *Redis) IncrementRateLimit(ctx context.Context, key string, window time.Duration) (int64, error) {
	pipe := r.Client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

// Lock helpers for distributed locking
func (r *Redis) AcquireLock(ctx context.Context, key string, value string, expiration time.Duration) (bool, error) {
	return r.Client.SetNX(ctx, key, value, expiration).Result()
}

func (r *Redis) ReleaseLock(ctx context.Context, key string, value string) error {
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	return r.Client.Eval(ctx, script, []string{key}, value).Err()
}

// Session cache helpers
func (r *Redis) SetSession(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return r.Client.Set(ctx, key, value, expiration).Err()
}

func (r *Redis) GetSession(ctx context.Context, key string) (string, error) {
	return r.Client.Get(ctx, key).Result()
}

func (r *Redis) DeleteSession(ctx context.Context, key string) error {
	return r.Client.Del(ctx, key).Err()
}
