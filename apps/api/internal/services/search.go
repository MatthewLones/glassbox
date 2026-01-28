package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/glassbox/api/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// SearchRequest contains parameters for text search
type SearchRequest struct {
	Query      string     `json:"query" binding:"required"`
	ProjectID  *uuid.UUID `json:"projectId,omitempty"`
	Status     *string    `json:"status,omitempty"`
	AuthorType *string    `json:"authorType,omitempty"`
	Limit      int        `json:"limit,omitempty"`
	Offset     int        `json:"offset,omitempty"`
}

// SemanticSearchRequest contains parameters for semantic search
type SemanticSearchRequest struct {
	Query       string     `json:"query" binding:"required"`
	ProjectID   *uuid.UUID `json:"projectId,omitempty"`
	Limit       int        `json:"limit,omitempty"`
	Threshold   *float64   `json:"threshold,omitempty"` // Minimum similarity score
	IncludeText bool       `json:"includeText,omitempty"`
}

// SearchResult represents a search result item
type SearchResult struct {
	ID           uuid.UUID      `json:"id"`
	Type         string         `json:"type"` // "node" or "file"
	Title        string         `json:"title"`
	Description  *string        `json:"description,omitempty"`
	Snippet      *string        `json:"snippet,omitempty"`
	ProjectID    *uuid.UUID     `json:"projectId,omitempty"`
	Status       *string        `json:"status,omitempty"`
	AuthorType   *string        `json:"authorType,omitempty"`
	Score        *float64       `json:"score,omitempty"` // Similarity score for semantic search
	Metadata     map[string]any `json:"metadata,omitempty"`
	HighlightedFields []string  `json:"highlightedFields,omitempty"`
}

// SearchResponse contains search results and metadata
type SearchResponse struct {
	Results    []SearchResult `json:"results"`
	Total      int            `json:"total"`
	Limit      int            `json:"limit"`
	Offset     int            `json:"offset"`
	Query      string         `json:"query"`
}

// TextSearch performs full-text search on nodes and files
func (s *SearchService) TextSearch(ctx context.Context, orgID, userID uuid.UUID, req SearchRequest) (*SearchResponse, error) {
	// Verify user has access to org
	var hasAccess bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2)
	`, orgID, userID).Scan(&hasAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}
	if !hasAccess {
		return nil, ErrForbidden
	}

	// Set defaults
	limit := 20
	if req.Limit > 0 && req.Limit <= 100 {
		limit = req.Limit
	}
	offset := 0
	if req.Offset > 0 {
		offset = req.Offset
	}

	// Build search query with filters
	// Using ILIKE for simple text search; for production, consider PostgreSQL full-text search
	searchPattern := "%" + strings.ToLower(req.Query) + "%"

	// Search nodes
	nodeQuery := `
		SELECT n.id, n.title, n.description, n.project_id, n.status, n.author_type, n.metadata
		FROM nodes n
		WHERE n.org_id = $1 AND n.deleted_at IS NULL
		  AND (LOWER(n.title) LIKE $2 OR LOWER(COALESCE(n.description, '')) LIKE $2)
	`
	nodeArgs := []any{orgID, searchPattern}
	argIdx := 3

	if req.ProjectID != nil {
		nodeQuery += fmt.Sprintf(" AND n.project_id = $%d", argIdx)
		nodeArgs = append(nodeArgs, *req.ProjectID)
		argIdx++
	}
	if req.Status != nil {
		nodeQuery += fmt.Sprintf(" AND n.status = $%d", argIdx)
		nodeArgs = append(nodeArgs, *req.Status)
		argIdx++
	}
	if req.AuthorType != nil {
		nodeQuery += fmt.Sprintf(" AND n.author_type = $%d", argIdx)
		nodeArgs = append(nodeArgs, *req.AuthorType)
		argIdx++
	}

	nodeQuery += " ORDER BY n.updated_at DESC"
	nodeQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	nodeArgs = append(nodeArgs, limit, offset)

	rows, err := s.db.Pool.Query(ctx, nodeQuery, nodeArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to search nodes: %w", err)
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		var metadataJSON []byte
		if err := rows.Scan(&r.ID, &r.Title, &r.Description, &r.ProjectID, &r.Status, &r.AuthorType, &metadataJSON); err != nil {
			return nil, fmt.Errorf("failed to scan node result: %w", err)
		}
		r.Type = "node"
		if metadataJSON != nil {
			json.Unmarshal(metadataJSON, &r.Metadata)
		}

		// Generate snippet from description
		if r.Description != nil && len(*r.Description) > 0 {
			snippet := *r.Description
			if len(snippet) > 200 {
				snippet = snippet[:200] + "..."
			}
			r.Snippet = &snippet
		}

		results = append(results, r)
	}

	// Search files with extracted text
	fileQuery := `
		SELECT f.id, f.filename, f.extracted_text, f.content_type, f.metadata
		FROM files f
		WHERE f.org_id = $1
		  AND (LOWER(f.filename) LIKE $2 OR LOWER(COALESCE(f.extracted_text, '')) LIKE $2)
		ORDER BY f.created_at DESC
		LIMIT $3 OFFSET $4
	`
	fileRows, err := s.db.Pool.Query(ctx, fileQuery, orgID, searchPattern, limit, offset)
	if err != nil {
		s.logger.Warn("Failed to search files", zap.Error(err))
	} else {
		defer fileRows.Close()
		for fileRows.Next() {
			var r SearchResult
			var extractedText *string
			var contentType *string
			var metadataJSON []byte
			if err := fileRows.Scan(&r.ID, &r.Title, &extractedText, &contentType, &metadataJSON); err != nil {
				continue
			}
			r.Type = "file"
			if metadataJSON != nil {
				json.Unmarshal(metadataJSON, &r.Metadata)
			}
			if extractedText != nil && len(*extractedText) > 0 {
				snippet := *extractedText
				if len(snippet) > 200 {
					snippet = snippet[:200] + "..."
				}
				r.Snippet = &snippet
			}
			results = append(results, r)
		}
	}

	// Count total results (simplified - just return results count)
	total := len(results)

	return &SearchResponse{
		Results: results,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		Query:   req.Query,
	}, nil
}

// SemanticSearch performs vector similarity search using pgvector
func (s *SearchService) SemanticSearch(ctx context.Context, orgID, userID uuid.UUID, embedding []float64, req SemanticSearchRequest) (*SearchResponse, error) {
	// Verify user has access to org
	var hasAccess bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2)
	`, orgID, userID).Scan(&hasAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access: %w", err)
	}
	if !hasAccess {
		return nil, ErrForbidden
	}

	// Set defaults
	limit := 10
	if req.Limit > 0 && req.Limit <= 50 {
		limit = req.Limit
	}
	threshold := 0.7
	if req.Threshold != nil && *req.Threshold > 0 && *req.Threshold < 1 {
		threshold = *req.Threshold
	}

	// Format embedding as pgvector string
	embeddingStr := "[" + strings.Join(float64SliceToStringSlice(embedding), ",") + "]"

	// Search files with embeddings using cosine similarity
	query := `
		SELECT
			f.id,
			f.filename,
			f.extracted_text,
			f.content_type,
			f.metadata,
			1 - (f.embedding <=> $1::vector) AS similarity
		FROM files f
		WHERE f.org_id = $2
		  AND f.embedding IS NOT NULL
		  AND 1 - (f.embedding <=> $1::vector) > $3
		ORDER BY similarity DESC
		LIMIT $4
	`

	rows, err := s.db.Pool.Query(ctx, query, embeddingStr, orgID, threshold, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to perform semantic search: %w", err)
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		var extractedText *string
		var contentType *string
		var metadataJSON []byte
		var similarity float64

		if err := rows.Scan(&r.ID, &r.Title, &extractedText, &contentType, &metadataJSON, &similarity); err != nil {
			return nil, fmt.Errorf("failed to scan semantic result: %w", err)
		}

		r.Type = "file"
		r.Score = &similarity
		if metadataJSON != nil {
			json.Unmarshal(metadataJSON, &r.Metadata)
		}

		if req.IncludeText && extractedText != nil && len(*extractedText) > 0 {
			snippet := *extractedText
			if len(snippet) > 500 {
				snippet = snippet[:500] + "..."
			}
			r.Snippet = &snippet
		}

		results = append(results, r)
	}

	return &SearchResponse{
		Results: results,
		Total:   len(results),
		Limit:   limit,
		Offset:  0,
		Query:   req.Query,
	}, nil
}

// GetNodeContext retrieves context about a node for RAG
func (s *SearchService) GetNodeContext(ctx context.Context, nodeID, userID uuid.UUID) (*models.NodeContext, error) {
	// Get the node with access check
	var node models.Node
	var metadataJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT n.id, n.org_id, n.project_id, n.parent_id, n.title, n.description,
		       n.status, n.author_type, n.metadata
		FROM nodes n
		JOIN org_members om ON n.org_id = om.org_id
		WHERE n.id = $1 AND om.user_id = $2 AND n.deleted_at IS NULL
	`, nodeID, userID).Scan(
		&node.ID, &node.OrgID, &node.ProjectID, &node.ParentID, &node.Title,
		&node.Description, &node.Status, &node.AuthorType, &metadataJSON,
	)
	if err != nil {
		return nil, ErrNotFound
	}
	json.Unmarshal(metadataJSON, &node.Metadata)

	// Get inputs with their content
	inputsQuery := `
		SELECT ni.id, ni.input_type, ni.label, ni.text_content,
		       f.filename, f.extracted_text
		FROM node_inputs ni
		LEFT JOIN files f ON ni.file_id = f.id
		WHERE ni.node_id = $1
		ORDER BY ni.sort_order
	`
	inputRows, _ := s.db.Pool.Query(ctx, inputsQuery, nodeID)
	defer inputRows.Close()

	var inputs []models.ContextInput
	for inputRows.Next() {
		var input models.ContextInput
		var filename, extractedText *string
		inputRows.Scan(&input.ID, &input.Type, &input.Label, &input.TextContent, &filename, &extractedText)
		if filename != nil {
			input.Filename = filename
		}
		if extractedText != nil {
			input.ExtractedText = extractedText
		}
		inputs = append(inputs, input)
	}

	// Get outputs
	outputsQuery := `
		SELECT no.id, no.output_type, no.label, no.text_content, no.structured_data,
		       f.filename, f.extracted_text
		FROM node_outputs no
		LEFT JOIN files f ON no.file_id = f.id
		WHERE no.node_id = $1
		ORDER BY no.sort_order
	`
	outputRows, _ := s.db.Pool.Query(ctx, outputsQuery, nodeID)
	defer outputRows.Close()

	var outputs []models.ContextOutput
	for outputRows.Next() {
		var output models.ContextOutput
		var structuredDataJSON []byte
		var filename, extractedText *string
		outputRows.Scan(&output.ID, &output.Type, &output.Label, &output.TextContent,
			&structuredDataJSON, &filename, &extractedText)
		if structuredDataJSON != nil {
			json.Unmarshal(structuredDataJSON, &output.StructuredData)
		}
		if filename != nil {
			output.Filename = filename
		}
		if extractedText != nil {
			output.ExtractedText = extractedText
		}
		outputs = append(outputs, output)
	}

	// Get parent chain for hierarchical context
	var parentChain []models.NodeSummary
	if node.ParentID != nil {
		parentChain = s.getParentChain(ctx, *node.ParentID)
	}

	// Get sibling nodes
	var siblings []models.NodeSummary
	if node.ParentID != nil {
		siblings = s.getSiblings(ctx, *node.ParentID, nodeID)
	}

	return &models.NodeContext{
		Node: models.NodeSummary{
			ID:          node.ID,
			Title:       node.Title,
			Description: node.Description,
			Status:      node.Status,
			AuthorType:  node.AuthorType,
		},
		Inputs:      inputs,
		Outputs:     outputs,
		ParentChain: parentChain,
		Siblings:    siblings,
	}, nil
}

// getParentChain retrieves the parent hierarchy of a node
func (s *SearchService) getParentChain(ctx context.Context, parentID uuid.UUID) []models.NodeSummary {
	var chain []models.NodeSummary
	currentID := parentID

	for i := 0; i < 10; i++ { // Limit depth to prevent infinite loops
		var node models.NodeSummary
		var nextParentID *uuid.UUID
		err := s.db.Pool.QueryRow(ctx, `
			SELECT id, parent_id, title, description, status, author_type
			FROM nodes WHERE id = $1 AND deleted_at IS NULL
		`, currentID).Scan(&node.ID, &nextParentID, &node.Title, &node.Description, &node.Status, &node.AuthorType)

		if err != nil {
			break
		}
		chain = append([]models.NodeSummary{node}, chain...) // Prepend to get root-first order

		if nextParentID == nil {
			break
		}
		currentID = *nextParentID
	}

	return chain
}

// getSiblings retrieves sibling nodes
func (s *SearchService) getSiblings(ctx context.Context, parentID, excludeID uuid.UUID) []models.NodeSummary {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, title, description, status, author_type
		FROM nodes
		WHERE parent_id = $1 AND id != $2 AND deleted_at IS NULL
		ORDER BY created_at
		LIMIT 10
	`, parentID, excludeID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var siblings []models.NodeSummary
	for rows.Next() {
		var node models.NodeSummary
		rows.Scan(&node.ID, &node.Title, &node.Description, &node.Status, &node.AuthorType)
		siblings = append(siblings, node)
	}
	return siblings
}

// Helper function to convert float64 slice to string slice
func float64SliceToStringSlice(floats []float64) []string {
	result := make([]string, len(floats))
	for i, f := range floats {
		result[i] = fmt.Sprintf("%f", f)
	}
	return result
}
