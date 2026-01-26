package models

import (
	"time"

	"github.com/google/uuid"
)

// =====================================================
// BASE TYPES
// =====================================================

type UUID = uuid.UUID

// =====================================================
// ORGANIZATIONS
// =====================================================

type Organization struct {
	ID                  UUID                 `json:"id" db:"id"`
	Name                string               `json:"name" db:"name"`
	Slug                string               `json:"slug" db:"slug"`
	Settings            OrganizationSettings `json:"settings" db:"settings"`
	EventSourcingLevel  string               `json:"eventSourcingLevel" db:"event_sourcing_level"`
	CreatedAt           time.Time            `json:"createdAt" db:"created_at"`
	UpdatedAt           time.Time            `json:"updatedAt" db:"updated_at"`
}

type OrganizationSettings struct {
	Models             []ModelConfig  `json:"models,omitempty"`
	SelfHostedEndpoint string         `json:"selfHostedEndpoint,omitempty"`
	DefaultModel       string         `json:"defaultModel,omitempty"`
	AgentPolicies      []AgentPolicy  `json:"agentPolicies,omitempty"`
}

type ModelConfig struct {
	Name        string `json:"name"`
	LiteLLMModel string `json:"litellmModel"`
	APIKey      string `json:"apiKey,omitempty"`
	APIBase     string `json:"apiBase,omitempty"`
}

type AgentPolicy struct {
	Action          string `json:"action"`
	Allowed         bool   `json:"allowed"`
	RequiresApproval bool  `json:"requiresApproval,omitempty"`
}

// =====================================================
// USERS
// =====================================================

type User struct {
	ID         UUID         `json:"id" db:"id"`
	CognitoSub string       `json:"cognitoSub" db:"cognito_sub"`
	Email      string       `json:"email" db:"email"`
	Name       *string      `json:"name,omitempty" db:"name"`
	AvatarURL  *string      `json:"avatarUrl,omitempty" db:"avatar_url"`
	Settings   UserSettings `json:"settings" db:"settings"`
	CreatedAt  time.Time    `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time    `json:"updatedAt" db:"updated_at"`
}

type UserSettings struct {
	Theme         string                   `json:"theme,omitempty"`
	Notifications *NotificationPreferences `json:"notifications,omitempty"`
}

type NotificationPreferences struct {
	Email bool `json:"email"`
	InApp bool `json:"inApp"`
	Slack bool `json:"slack,omitempty"`
}

type OrgMember struct {
	ID        UUID      `json:"id" db:"id"`
	OrgID     UUID      `json:"orgId" db:"org_id"`
	UserID    UUID      `json:"userId" db:"user_id"`
	Role      string    `json:"role" db:"role"`
	User      *User     `json:"user,omitempty"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// =====================================================
// PROJECTS
// =====================================================

type Project struct {
	ID             UUID            `json:"id" db:"id"`
	OrgID          UUID            `json:"orgId" db:"org_id"`
	Name           string          `json:"name" db:"name"`
	Description    *string         `json:"description,omitempty" db:"description"`
	Settings       ProjectSettings `json:"settings" db:"settings"`
	WorkflowStates []string        `json:"workflowStates" db:"workflow_states"`
	CreatedAt      time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time       `json:"updatedAt" db:"updated_at"`
}

type ProjectSettings struct {
	DefaultNodeStatus string `json:"defaultNodeStatus,omitempty"`
	AutoAssignAgent   bool   `json:"autoAssignAgent,omitempty"`
}

// =====================================================
// FILES
// =====================================================

type File struct {
	ID               UUID                  `json:"id" db:"id"`
	OrgID            UUID                  `json:"orgId" db:"org_id"`
	StorageKey       string                `json:"storageKey" db:"storage_key"`
	StorageBucket    string                `json:"storageBucket" db:"storage_bucket"`
	Filename         string                `json:"filename" db:"filename"`
	ContentType      *string               `json:"contentType,omitempty" db:"content_type"`
	SizeBytes        *int64                `json:"sizeBytes,omitempty" db:"size_bytes"`
	ProcessingStatus string                `json:"processingStatus" db:"processing_status"`
	ExtractedText    *string               `json:"extractedText,omitempty" db:"extracted_text"`
	ProcessingError  *string               `json:"processingError,omitempty" db:"processing_error"`
	Metadata         map[string]any        `json:"metadata" db:"metadata"`
	CreatedAt        time.Time             `json:"createdAt" db:"created_at"`
	UploadedBy       *UUID                 `json:"uploadedBy,omitempty" db:"uploaded_by"`
}

// =====================================================
// NODES
// =====================================================

type Node struct {
	ID               UUID            `json:"id" db:"id"`
	OrgID            UUID            `json:"orgId" db:"org_id"`
	ProjectID        UUID            `json:"projectId" db:"project_id"`
	ParentID         *UUID           `json:"parentId,omitempty" db:"parent_id"`
	Title            string          `json:"title" db:"title"`
	Description      *string         `json:"description,omitempty" db:"description"`
	Status           string          `json:"status" db:"status"`
	AuthorType       string          `json:"authorType" db:"author_type"`
	AuthorUserID     *UUID           `json:"authorUserId,omitempty" db:"author_user_id"`
	SupervisorUserID *UUID           `json:"supervisorUserId,omitempty" db:"supervisor_user_id"`
	Version          int             `json:"version" db:"version"`
	Metadata         NodeMetadata    `json:"metadata" db:"metadata"`
	Position         NodePosition    `json:"position" db:"position"`
	LockedBy         *UUID           `json:"lockedBy,omitempty" db:"locked_by"`
	LockedAt         *time.Time      `json:"lockedAt,omitempty" db:"locked_at"`
	LockExpiresAt    *time.Time      `json:"lockExpiresAt,omitempty" db:"lock_expires_at"`
	CreatedAt        time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time       `json:"updatedAt" db:"updated_at"`
	DeletedAt        *time.Time      `json:"deletedAt,omitempty" db:"deleted_at"`

	// Populated relations
	Inputs     []NodeInput  `json:"inputs,omitempty"`
	Outputs    []NodeOutput `json:"outputs,omitempty"`
	Children   []Node       `json:"children,omitempty"`
	Author     *User        `json:"author,omitempty"`
	Supervisor *User        `json:"supervisor,omitempty"`
}

type NodeMetadata struct {
	Tags     []string `json:"tags,omitempty"`
	Priority string   `json:"priority,omitempty"`
	DueDate  *string  `json:"dueDate,omitempty"`
}

type NodePosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type NodeVersion struct {
	ID            UUID      `json:"id" db:"id"`
	NodeID        UUID      `json:"nodeId" db:"node_id"`
	Version       int       `json:"version" db:"version"`
	Snapshot      Node      `json:"snapshot" db:"snapshot"`
	ChangeType    string    `json:"changeType" db:"change_type"`
	ChangeSummary *string   `json:"changeSummary,omitempty" db:"change_summary"`
	ChangedBy     *UUID     `json:"changedBy,omitempty" db:"changed_by"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// =====================================================
// NODE INPUTS & OUTPUTS
// =====================================================

type NodeInput struct {
	ID                UUID           `json:"id" db:"id"`
	NodeID            UUID           `json:"nodeId" db:"node_id"`
	InputType         string         `json:"inputType" db:"input_type"`
	FileID            *UUID          `json:"fileId,omitempty" db:"file_id"`
	SourceNodeID      *UUID          `json:"sourceNodeId,omitempty" db:"source_node_id"`
	SourceNodeVersion *int           `json:"sourceNodeVersion,omitempty" db:"source_node_version"`
	ExternalURL       *string        `json:"externalUrl,omitempty" db:"external_url"`
	TextContent       *string        `json:"textContent,omitempty" db:"text_content"`
	Label             *string        `json:"label,omitempty" db:"label"`
	Metadata          map[string]any `json:"metadata" db:"metadata"`
	SortOrder         int            `json:"sortOrder" db:"sort_order"`
	CreatedAt         time.Time      `json:"createdAt" db:"created_at"`

	// Relations
	File       *File `json:"file,omitempty"`
	SourceNode *Node `json:"sourceNode,omitempty"`
}

type NodeOutput struct {
	ID             UUID           `json:"id" db:"id"`
	NodeID         UUID           `json:"nodeId" db:"node_id"`
	OutputType     string         `json:"outputType" db:"output_type"`
	FileID         *UUID          `json:"fileId,omitempty" db:"file_id"`
	StructuredData map[string]any `json:"structuredData,omitempty" db:"structured_data"`
	TextContent    *string        `json:"textContent,omitempty" db:"text_content"`
	ExternalURL    *string        `json:"externalUrl,omitempty" db:"external_url"`
	Label          *string        `json:"label,omitempty" db:"label"`
	Metadata       map[string]any `json:"metadata" db:"metadata"`
	SortOrder      int            `json:"sortOrder" db:"sort_order"`
	CreatedAt      time.Time      `json:"createdAt" db:"created_at"`

	// Relations
	File *File `json:"file,omitempty"`
}

// =====================================================
// AGENT EXECUTIONS
// =====================================================

type AgentExecution struct {
	ID                 UUID         `json:"id" db:"id"`
	NodeID             UUID         `json:"nodeId" db:"node_id"`
	Status             string       `json:"status" db:"status"`
	LanggraphThreadID  *string      `json:"langgraphThreadId,omitempty" db:"langgraph_thread_id"`
	TraceSummary       []TraceEvent `json:"traceSummary" db:"trace_summary"`
	StartedAt          *time.Time   `json:"startedAt,omitempty" db:"started_at"`
	CompletedAt        *time.Time   `json:"completedAt,omitempty" db:"completed_at"`
	ErrorMessage       *string      `json:"errorMessage,omitempty" db:"error_message"`
	TotalTokensIn      int          `json:"totalTokensIn" db:"total_tokens_in"`
	TotalTokensOut     int          `json:"totalTokensOut" db:"total_tokens_out"`
	EstimatedCostUSD   float64      `json:"estimatedCostUsd" db:"estimated_cost_usd"`
	ModelID            *string      `json:"modelId,omitempty" db:"model_id"`
	CreatedAt          time.Time    `json:"createdAt" db:"created_at"`
}

type TraceEvent struct {
	ID             UUID           `json:"id" db:"id"`
	ExecutionID    UUID           `json:"executionId" db:"execution_id"`
	EventType      string         `json:"eventType" db:"event_type"`
	EventData      map[string]any `json:"eventData" db:"event_data"`
	Timestamp      time.Time      `json:"timestamp" db:"timestamp"`
	DurationMs     *int           `json:"durationMs,omitempty" db:"duration_ms"`
	Model          *string        `json:"model,omitempty" db:"model"`
	TokensIn       *int           `json:"tokensIn,omitempty" db:"tokens_in"`
	TokensOut      *int           `json:"tokensOut,omitempty" db:"tokens_out"`
	SequenceNumber int            `json:"sequenceNumber" db:"sequence_number"`
}

// =====================================================
// TEMPLATES
// =====================================================

type Template struct {
	ID          UUID              `json:"id" db:"id"`
	OrgID       *UUID             `json:"orgId,omitempty" db:"org_id"`
	Name        string            `json:"name" db:"name"`
	Description *string           `json:"description,omitempty" db:"description"`
	Structure   TemplateStructure `json:"structure" db:"structure"`
	AgentConfig AgentConfig       `json:"agentConfig" db:"agent_config"`
	IsPublic    bool              `json:"isPublic" db:"is_public"`
	CreatedAt   time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time         `json:"updatedAt" db:"updated_at"`
	CreatedBy   *UUID             `json:"createdBy,omitempty" db:"created_by"`
}

type TemplateStructure struct {
	Inputs                 []TemplateInput   `json:"inputs"`
	Outputs                []TemplateOutput  `json:"outputs"`
	SubNodes               []TemplateSubNode `json:"subNodes,omitempty"`
	SuggestedWorkflowStates []string         `json:"suggestedWorkflowStates,omitempty"`
}

type TemplateInput struct {
	Label       string `json:"label"`
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Description string `json:"description,omitempty"`
}

type TemplateOutput struct {
	Label       string `json:"label"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

type TemplateSubNode struct {
	Title      string `json:"title"`
	AuthorType string `json:"authorType"`
	TemplateID *UUID  `json:"templateId,omitempty"`
}

type AgentConfig struct {
	Model        string   `json:"model,omitempty"`
	MaxTokens    int      `json:"maxTokens,omitempty"`
	Temperature  float64  `json:"temperature,omitempty"`
	SystemPrompt string   `json:"systemPrompt,omitempty"`
	Tools        []string `json:"tools,omitempty"`
}

// =====================================================
// NOTIFICATIONS
// =====================================================

type Notification struct {
	ID           UUID       `json:"id" db:"id"`
	UserID       UUID       `json:"userId" db:"user_id"`
	OrgID        UUID       `json:"orgId" db:"org_id"`
	Type         string     `json:"type" db:"type"`
	Title        string     `json:"title" db:"title"`
	Body         *string    `json:"body,omitempty" db:"body"`
	ResourceType *string    `json:"resourceType,omitempty" db:"resource_type"`
	ResourceID   *UUID      `json:"resourceId,omitempty" db:"resource_id"`
	ReadAt       *time.Time `json:"readAt,omitempty" db:"read_at"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
}
