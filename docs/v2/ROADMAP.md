# GlassBox Frontend Roadmap (V2)

This is the master todo list for frontend development. Check items off as they're completed.

**Last Updated:** 2026-01-31

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| Component Library | **Complete** | Shadcn/ui + Glass design system |
| Layout Components | **Complete** | AppShell, Sidebar, Header, Breadcrumbs |
| Common Components | **Complete** | EmptyState, ConfirmDialog, Spinner, etc. |
| Authentication | **Complete** | Cognito OAuth + dev mode + route protection |
| Org/Project Management | **Complete** | OrgSwitcher, ProjectList, Dashboard |
| Tree View | Pending | File explorer style |
| Canvas View | Pending | Figma-like with Reactflow |
| Graph View | Pending | Force-directed dependencies |
| Grid View | Pending | Visual file explorer |
| Agent Execution UI | Pending | HITL, trace visualization |
| Real-Time WebSocket | Pending | Presence, locks, live updates |

---

## Phase 1: Foundation & Component Library ✅ COMPLETE

**Goal:** Set up Shadcn/ui, glass design system, and core reusable components.

### 1.1 Shadcn/ui Setup
- [x] Install Shadcn/ui dependencies (Radix, CVA, Tailwind Animate)
- [x] Configure `components.json` for project
- [x] Update Tailwind config with CSS variables and animations
- [x] Update globals.css with theme variables

### 1.2 Glass Design System
- [x] Define CSS variables for glass effects
- [x] Create `.glass`, `.glass-subtle`, `.glass-strong` utilities
- [x] Create `.glass-card` and `.glass-modal` utilities
- [x] Add custom shadow utilities (`shadow-glass`, `shadow-glass-lg`)
- [x] Configure primary color (sky blue #0ea5e9)

### 1.3 Core UI Components
- [x] Button (with glass variants)
- [x] Input
- [x] Label
- [x] Card (with glass variant)
- [x] Badge (with status variants: success, warning, error, info)
- [x] Avatar
- [x] Dialog (with glass-modal backdrop)
- [x] Dropdown Menu
- [x] Tabs
- [x] Separator
- [x] Skeleton
- [x] Tooltip
- [x] Select
- [x] Popover
- [x] Scroll Area
- [x] Sonner (Toast notifications)
- [x] Index file for exports

### 1.4 Layout Components
- [x] AppShell - Main app wrapper with sidebar/content layout
- [x] Sidebar - Collapsible navigation with tooltips
- [x] Header - Top bar with search, notifications, user menu
- [x] Breadcrumbs - Path navigation

### 1.5 Common Components
- [x] EmptyState - Empty view placeholder with icon and action
- [x] ConfirmDialog - Confirmation modal (default/destructive variants)
- [x] SearchInput - Search input with clear button
- [x] LoadingOverlay - Full-screen loading with glass effect
- [x] Spinner - Loading spinner in multiple sizes

### 1.6 Configuration Updates
- [x] Update app-store.ts with `setSidebarOpen` and `grid` view mode
- [x] Update providers.tsx with Toaster and TooltipProvider
- [x] Build shared-types package for type imports
- [x] Verify TypeScript compilation passes
- [x] Verify production build passes

**Verification:** `pnpm type-check` and `pnpm build` both pass. ✅

---

## Phase 2: Authentication ✅ COMPLETE

**Goal:** Cognito hosted UI integration with protected routes.

### 2.1 Auth Configuration
- [x] Create Cognito client configuration (`lib/auth/config.ts`)
- [x] Create AuthContext with login/logout/refresh (`lib/auth/auth-context.tsx`)
- [x] Create useAuth hook
- [x] Create auth types (`lib/auth/types.ts`)

### 2.2 Auth Routes
- [x] `/auth/login` - Redirect to Cognito hosted UI (or dev-login in dev mode)
- [x] `/auth/callback` - Handle OAuth callback, exchange code for tokens
- [x] `/auth/logout` - Clear session, redirect to Cognito logout
- [x] `/auth/dev-login` - Dev mode login with preset users

### 2.3 API Routes
- [x] `/api/auth/callback` - Token exchange with Cognito
- [x] `/api/auth/refresh` - Token refresh with Cognito
- [x] `/api/auth/ws-token` - WebSocket token exchange

### 2.4 Session Management
- [x] Token storage in localStorage (dev mode compatible)
- [x] Automatic token refresh before expiry (5 min buffer)
- [x] Long session duration (Cognito handles refresh tokens)
- [x] WebSocket token exchange via `getWsToken()`

### 2.5 Route Protection
- [x] Next.js middleware for route matching
- [x] ProtectedRoute wrapper component
- [x] Redirect to login when unauthenticated
- [x] Return URL preservation for post-login redirect

### 2.6 Provider Integration
- [x] AuthProvider added to providers.tsx
- [x] Auth state globally accessible via useAuth

**Verification:** Full auth flow works in dev mode. ✅

---

## Phase 3: Organization & Project Management ✅ COMPLETE

**Goal:** Org switcher, project list, create/edit forms.

### 3.1 Organization Components
- [x] OrgSwitcher - Dropdown to switch organizations
- [x] CreateOrgDialog - Create organization form
- [x] OrgSettingsDialog - Edit organization settings (with tabs for future)

### 3.2 Project Components
- [x] ProjectCard - Project display card with actions menu
- [x] ProjectList - Grid of projects with loading/empty states
- [x] CreateProjectDialog - Create project form
- [x] ProjectSettingsDialog - Edit project settings

### 3.3 React Query Hooks
- [x] useOrganizations - Fetch user's organizations
- [x] useOrganization - Fetch single organization
- [x] useCreateOrganization, useUpdateOrganization, useDeleteOrganization
- [x] useProjects - Fetch organization's projects
- [x] useProject - Fetch single project
- [x] useCreateProject, useUpdateProject, useDeleteProject

### 3.4 Dashboard Route
- [x] `/dashboard` - Dashboard with project list, org switcher in sidebar
- [x] Protected route with ProtectedRoute wrapper

### 3.5 Store Updates
- [x] Added `currentOrgId`, `currentProjectId`, `selectedNodeId` with persistence
- [x] Using zustand persist middleware for localStorage

**Verification:** Dashboard shows projects, org switcher works, create dialogs open. ✅

---

## Phase 4: Tree View

**Goal:** File explorer-style hierarchical node display.

### 4.1 Tree Components
- [ ] TreeView - Main tree container with virtualization
- [ ] TreeNode - Individual tree node item
- [ ] TreeBranch - Collapsible branch container
- [ ] TreeContextMenu - Right-click actions

### 4.2 Node Display Components
- [ ] NodeStatusBadge - Status indicator (draft, in_progress, complete, etc.)
- [ ] NodeAuthorBadge - Human/Agent indicator
- [ ] NodeIcon - Dynamic icon based on node type
- [ ] NodeActions - Quick action buttons

### 4.3 Node Detail Panel
- [ ] NodeDetailPanel - Main detail view (slide-out or split)
- [ ] NodeHeader - Title, status, actions
- [ ] NodeInputsList - Input items display
- [ ] NodeOutputsList - Output items display
- [ ] NodeEvidenceSection - Expandable evidence/traces
- [ ] NodeMetadata - Tags, dates, metadata

### 4.4 Project Route
- [ ] `/projects/[projectId]` - Project main view with tree
- [ ] `/projects/[projectId]/layout.tsx` - Project layout with view switcher

### 4.5 Tree Interactions
- [ ] Expand/collapse with state persistence
- [ ] Node selection with keyboard navigation
- [ ] Drag-and-drop for reparenting nodes
- [ ] Inline rename functionality
- [ ] Context menu actions

**Verification:** Tree displays nodes, expand/collapse works, can select and view details.

---

## Phase 5: Node CRUD Operations

**Goal:** Create, edit, delete nodes with forms and file upload.

### 5.1 Node Forms
- [ ] CreateNodeForm - Full create form
- [ ] EditNodeForm - Edit form with all fields
- [ ] StatusSelect - Workflow status picker
- [ ] AuthorSelect - Author type selection (human/agent)

### 5.2 Input/Output Management
- [ ] AddInputForm - Add input dialog
- [ ] AddOutputForm - Add output dialog
- [ ] NodeReferencePicker - Search and pick other nodes
- [ ] InputItemEditor - Edit/remove input
- [ ] OutputItemEditor - Edit/remove output

### 5.3 File Components
- [ ] FileUploadZone - Drag-drop upload with progress
- [ ] FilePreview - Preview for images, PDFs, text
- [ ] FileListItem - File display with actions
- [ ] useFileUpload hook - S3 presigned URL upload

### 5.4 Version History
- [ ] VersionHistoryPanel - Timeline of versions
- [ ] VersionDiffViewer - Compare versions
- [ ] Rollback functionality
- [ ] DeleteNodeDialog - Confirm delete

**Verification:** Can create/edit/delete nodes, upload files, view versions.

---

## Phase 6: Canvas View (Primary)

**Goal:** Figma-like infinite canvas with Reactflow.

### 6.1 Canvas Core
- [ ] CanvasView - Main canvas container
- [ ] CanvasProvider - Reactflow provider with config
- [ ] canvasUtils - Position calculations, snap logic
- [ ] Canvas-specific Zustand store

### 6.2 Custom Reactflow Nodes
- [ ] GlassboxNode - Main node component with glass styling
- [ ] NodeHandles - Input/output connection handles
- [ ] NodePreviewCard - Compact node view
- [ ] NodeExpandedCard - Expanded view

### 6.3 Custom Edges
- [ ] DependencyEdge - Dependency line style
- [ ] ParentChildEdge - Hierarchy line style
- [ ] EdgeLabel - Connection labels

### 6.4 Canvas Controls
- [ ] CanvasToolbar - Zoom, fit, grid toggle
- [ ] Minimap - Overview with glass styling
- [ ] GridToggle - Snap-to-grid toggle
- [ ] ZoomIndicator - Current zoom level

### 6.5 Canvas Interactions
- [ ] Click-drag to create connections
- [ ] Snap-to-grid positioning
- [ ] Pan and zoom controls
- [ ] Multi-node selection
- [ ] Node group operations
- [ ] Position persistence to backend

**Verification:** Canvas displays nodes, can pan/zoom, snap-to-grid works, minimap works.

---

## Phase 7: Graph View

**Goal:** Force-directed dependency visualization.

### 7.1 Graph Components
- [ ] GraphView - Main graph container
- [ ] GraphNode - Graph node representation
- [ ] GraphToolbar - Layout controls
- [ ] GraphLegend - Relationship legend
- [ ] GraphFilter - Filter by type/status

### 7.2 Force Layout
- [ ] Integrate d3-force for layout algorithm
- [ ] Node clustering visualization
- [ ] Stabilization logic

### 7.3 Graph Interactions
- [ ] Hover to highlight dependencies
- [ ] Click to center and expand node
- [ ] Drag to manually adjust positions
- [ ] Focus mode (highlight specific node's connections)

**Verification:** Graph shows nodes with force layout, dependencies visible.

---

## Phase 8: Grid View

**Goal:** Visual file explorer with snapped nodes.

### 8.1 Grid Components
- [ ] GridView - Main grid container with CSS Grid
- [ ] GridNodeCard - Node card with thumbnail/icon
- [ ] GridToolbar - Sort, filter, view size controls

### 8.2 Grid Features
- [ ] Responsive columns
- [ ] Virtual scrolling for large node counts
- [ ] Sort by name, date, status
- [ ] Size toggle (small/medium/large icons)

### 8.3 Grid Interactions
- [ ] Click to select, double-click to open
- [ ] Multi-select with shift/cmd
- [ ] Drag-and-drop reordering (optional)

**Verification:** Grid displays nodes, sorting works, double-click navigates.

---

## Phase 9: View Switcher

**Goal:** Tab navigation between views in top-left.

### 9.1 Navigation Components
- [ ] ViewSwitcher - Tab container
- [ ] ViewTab - Individual tab (Tree, Canvas, Graph, Grid)

### 9.2 View Integration
- [ ] Conditional view rendering based on viewMode
- [ ] Selected node persists across view switches
- [ ] Keyboard shortcuts (Cmd+1, Cmd+2, etc.)
- [ ] URL sync (`?view=canvas`)
- [ ] User default view preference

**Verification:** Tabs switch views, selected node persists, URL updates.

---

## Phase 10: Agent Execution UI

**Goal:** Execution status, trace visualization, HITL modals.

### 10.1 Execution Status
- [ ] ExecutionStatus - Status badge/indicator
- [ ] ExecutionProgress - Progress display
- [ ] ExecutionControls - Pause/Resume/Cancel buttons

### 10.2 Trace Visualization
- [ ] TraceTimeline - Timeline of execution events
- [ ] TraceEvent - Individual trace event display
- [ ] TraceLLMCall - LLM call details (model, tokens)
- [ ] TraceToolCall - Tool invocation details

### 10.3 HITL Components
- [ ] HITLModal - Intervention modal container
- [ ] HITLInputRequest - Agent asking for human input
- [ ] HITLApprovalRequest - Action approval request
- [ ] HITLTakeover - Human taking over from agent

### 10.4 Execution State
- [ ] useExecution hook - Execution management
- [ ] execution-store.ts - Active executions state
- [ ] Toast notifications for execution events

**Verification:** Can start execution, see status, provide HITL input.

---

## Phase 11: Real-Time WebSocket

**Goal:** Presence, locks, live updates.

### 11.1 WebSocket Core
- [ ] WSClient - WebSocket connection wrapper
- [ ] WSContext - React context for WebSocket
- [ ] useWebSocket, useSubscription hooks
- [ ] Auto-reconnect on disconnect

### 11.2 Subscriptions
- [ ] useProjectSubscription - Subscribe to project channel
- [ ] useNodeSubscription - Subscribe to node channel
- [ ] Auto-subscribe/unsubscribe on route changes

### 11.3 Presence
- [ ] PresenceAvatars - Show who's viewing node/project
- [ ] PresenceIndicator - User presence dot
- [ ] Presence heartbeat

### 11.4 Locks
- [ ] LockIndicator - Lock status display
- [ ] LockWarning - Warning when trying to edit locked node
- [ ] Optimistic lock acquisition
- [ ] Lock conflict handling

### 11.5 Real-Time Updates
- [ ] Handle node_created, node_updated, node_deleted
- [ ] Handle lock_acquired, lock_released
- [ ] Handle execution_update
- [ ] Optimistic UI updates with rollback

**Verification:** WebSocket connects, presence shows, locks prevent concurrent edits.

---

## Phase 12: Search

**Goal:** Global search with Cmd+K modal.

### 12.1 Search Components
- [ ] SearchCommand - Cmd+K modal (command palette)
- [ ] SearchInput - Search input with icon
- [ ] SearchResults - Results list
- [ ] SearchResultItem - Individual result item

### 12.2 Search Features
- [ ] Full-text search across nodes/files
- [ ] Semantic search toggle
- [ ] Filter by type, status, author, date range
- [ ] Recent searches
- [ ] Quick actions (create node, switch project)

### 12.3 Search Hooks
- [ ] useSearch - Search hook with debounce
- [ ] useRecentSearches - Recent search history

**Verification:** Cmd+K opens modal, search returns results, can navigate to result.

---

## Phase 13: Notifications

**Goal:** In-app notification center.

### 13.1 Notification Components
- [ ] NotificationBell - Header bell icon with badge
- [ ] NotificationPanel - Dropdown panel
- [ ] NotificationItem - Single notification
- [ ] NotificationEmpty - Empty state

### 13.2 Notification Features
- [ ] Real-time notifications via WebSocket
- [ ] Mark as read/unread
- [ ] Delete notifications
- [ ] Click to navigate to resource

### 13.3 Notification Hooks
- [ ] useNotifications - Fetch and manage notifications

**Verification:** Bell shows count, notifications appear in real-time.

---

## Phase 14: Polish & Performance

**Goal:** Animations, optimization, accessibility.

### 14.1 Animations
- [ ] Framer Motion for page/component transitions
- [ ] Micro-interactions (hover, click feedback)
- [ ] Loading skeletons for all data states

### 14.2 Performance
- [ ] Virtual scrolling for long lists
- [ ] React.memo and useMemo optimization
- [ ] Code splitting per view
- [ ] Image optimization
- [ ] Bundle size analysis

### 14.3 Error Handling
- [ ] Error boundaries for graceful failures
- [ ] Retry logic for failed requests
- [ ] Offline detection and messaging
- [ ] User-friendly error messages

### 14.4 Accessibility
- [ ] ARIA labels throughout
- [ ] Full keyboard navigation
- [ ] Screen reader testing
- [ ] Color contrast (WCAG AA)

### 14.5 Testing
- [ ] Unit tests for utility functions
- [ ] Integration tests for key flows
- [ ] E2E tests with Playwright

**Verification:** Lighthouse score > 90, keyboard navigation complete.

---

## Quick Reference

### Starting Development

```bash
# Start backend dependencies (if not already running)
cd docker && docker compose up -d

# Build shared types (required once)
cd packages/shared-types && pnpm build

# Start frontend dev server
cd apps/web && pnpm dev
```

### Key Files

| Component | Location |
|-----------|----------|
| UI Components | `apps/web/src/components/ui/` |
| Layout Components | `apps/web/src/components/layout/` |
| Common Components | `apps/web/src/components/common/` |
| Auth Components | `apps/web/src/components/auth/` |
| Auth Library | `apps/web/src/lib/auth/` |
| App Store | `apps/web/src/stores/app-store.ts` |
| API Client | `apps/web/src/lib/api.ts` |
| Node Hooks | `apps/web/src/hooks/use-nodes.ts` |
| Tailwind Config | `apps/web/tailwind.config.ts` |
| CSS Variables | `apps/web/src/app/globals.css` |
| Next.js Middleware | `apps/web/src/middleware.ts` |

### Component Showcase

View all components at: `http://localhost:3000/showcase`

---

## Progress Tracking

When completing tasks:
1. Check the box in this document
2. Add entry to `docs/CHANGELOG.md`
3. Update plan file if architecture changed
