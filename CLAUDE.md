# GlassBox Development Rules

This file contains instructions for Claude Code when working on this repository.

## Change Logging Protocol

**IMPORTANT**: Every time you make significant changes to the codebase, you MUST:

1. **Update the Changelog** (`docs/CHANGELOG.md`)
   - Add a new dated entry at the top (below the header)
   - Include: Summary, Justification, Technical Details, Files Modified
   - Use the template provided in the changelog file

2. **Update Technical Documentation** (`docs/TECHNICAL.md`)
   - If the change affects architecture, APIs, schemas, or infrastructure
   - Keep this as a living document reflecting current state
   - Update diagrams if system communication patterns change

3. **Log Entry Requirements**
   Each changelog entry must explain:
   - **What**: Brief summary of the change
   - **Why**: Business or technical justification
   - **How**: Technical implementation details
   - **Where**: All files created, modified, or deleted

## What Counts as "Significant Changes"

Log these types of changes:
- New features or components
- API endpoint additions or modifications
- Database schema changes
- New dependencies added
- Infrastructure or configuration changes
- Bug fixes (with root cause noted)
- Refactoring that affects multiple files

Skip logging for:
- Typo fixes
- Comment updates
- Formatting-only changes
- Local development tweaks

## Development Guidelines

### Code Style
- Go: Follow standard Go conventions, use `gofmt`
- TypeScript/React: Follow existing patterns in codebase
- Python: Follow PEP 8, use type hints
- SQL: Use lowercase keywords, snake_case for identifiers

### Testing Requirements
- Write tests for new features before marking complete
- Run existing tests before committing changes
- Note test coverage changes in changelog

### Commit Discipline
- Atomic commits with clear messages
- Reference changelog entry in commit message when applicable

## Project Context

- **Primary docs**: `docs/PRD.md` (product requirements), `docs/TECHNICAL.md` (implementation spec)
- **Monorepo**: pnpm workspaces with apps/ and packages/
- **Stack**: Go (API/WebSocket), Python (workers), Next.js (frontend), PostgreSQL, Redis
- **Local dev**: Docker Compose for dependencies, native for services

## Quick Reference

| Component | Location | Tech |
|-----------|----------|------|
| API | `apps/api/` | Go + Gin |
| Frontend | `apps/web/` | Next.js 14 |
| Workers | `apps/workers/` | Python + LangGraph |
| DB Schema | `packages/db-schema/` | PostgreSQL + pgvector |
| Types | `packages/shared-types/` | TypeScript |
| Docker | `docker/` | Compose for local deps |
