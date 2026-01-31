# GlassBox V2 Frontend Architecture

This document describes the architecture of the GlassBox frontend application, including system design, component hierarchy, and data flow patterns.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Interface                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Tree View  │  │ Canvas View │  │ Graph View  │  │  Grid View  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                         Component Layer                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐    │
│  │   Layout  │  │   Node    │  │   Agent   │  │   Collaboration   │    │
│  │ Components│  │ Components│  │ Components│  │    Components     │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                          Hooks Layer                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐      │
│  │ Data Queries │  │  Mutations   │  │   Feature Hooks          │      │
│  │  (useNodes)  │  │ (useCreate)  │  │ (useExecution, useSearch)│      │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘      │
├─────────────────────────────────────────────────────────────────────────┤
│                         State Layer                                      │
│  ┌─────────────────────────┐     ┌─────────────────────────────┐       │
│  │    Zustand Stores       │     │      React Query Cache       │       │
│  │  (app, canvas, exec)    │     │   (server state caching)     │       │
│  └─────────────────────────┘     └─────────────────────────────┘       │
├─────────────────────────────────────────────────────────────────────────┤
│                      Communication Layer                                 │
│  ┌─────────────────────────┐     ┌─────────────────────────────┐       │
│  │     REST API Client     │     │     WebSocket Client         │       │
│  │    (lib/api.ts)         │     │   (lib/websocket/)           │       │
│  └───────────┬─────────────┘     └───────────┬─────────────────┘       │
└──────────────┼───────────────────────────────┼─────────────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│      Backend API Server      │   │    WebSocket Server          │
│    (Go - apps/api/)          │   │  (Go - apps/api/ws)          │
└──────────────────────────────┘   └──────────────────────────────┘
```

---

## Component Hierarchy

The frontend consists of **22 component categories** with **118 total files**:

```
components/
├── ui/                    # 20 files - Shadcn/ui primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── command.tsx        # Cmd+K command palette base
│   └── ...
│
├── layout/                # 4 files - Page structure
│   ├── app-shell.tsx      # Main layout wrapper
│   ├── sidebar.tsx        # Navigation sidebar
│   ├── header.tsx         # Top header bar
│   └── breadcrumbs.tsx    # Path navigation
│
├── canvas/                # 8 files - ReactFlow canvas
│   ├── canvas-view.tsx    # Main canvas component
│   ├── canvas-provider.tsx
│   ├── nodes/
│   │   └── glassbox-node.tsx
│   ├── edges/
│   │   ├── parent-child-edge.tsx
│   │   └── dependency-edge.tsx
│   └── controls/
│       ├── canvas-toolbar.tsx
│       └── zoom-indicator.tsx
│
├── graph/                 # 5 files - D3 force graph
│   ├── graph-view.tsx
│   ├── graph-node.tsx
│   ├── graph-toolbar.tsx
│   └── graph-legend.tsx
│
├── tree/                  # 3 files - Hierarchical tree
│   ├── tree-view.tsx
│   ├── tree-branch.tsx
│   └── tree-node.tsx
│
├── grid/                  # 5 files - Card grid
│   ├── grid-view.tsx
│   ├── grid-node-card.tsx
│   └── grid-toolbar.tsx
│
├── node/                  # 13 files - Node UI
│   ├── node-detail-panel.tsx
│   ├── node-status-badge.tsx
│   ├── node-author-badge.tsx
│   ├── node-inputs-list.tsx
│   ├── node-outputs-list.tsx
│   ├── node-evidence-list.tsx
│   ├── version-history-panel.tsx
│   ├── version-diff-viewer.tsx
│   ├── delete-node-dialog.tsx
│   └── forms/
│       ├── create-node-form.tsx
│       ├── edit-node-form.tsx
│       ├── add-input-form.tsx
│       ├── add-output-form.tsx
│       └── add-evidence-form.tsx
│
├── agent/                 # 10 files - Execution UI
│   ├── execution-panel.tsx
│   ├── execution-status-badge.tsx
│   ├── execution-progress.tsx
│   ├── execution-controls.tsx
│   ├── trace-timeline.tsx
│   ├── trace-event.tsx
│   ├── hitl-modal.tsx
│   ├── hitl-input-request.tsx
│   ├── hitl-approval-request.tsx
│   └── hitl-notification-button.tsx
│
├── presence/              # 1 file - User presence
│   └── presence-avatars.tsx
│
├── lock/                  # 1 file - Node locking
│   └── lock-indicator.tsx
│
├── websocket/             # 2 files - Connection status
│   └── connection-status.tsx
│
├── search/                # 4 files - Cmd+K search
│   ├── search-command.tsx
│   ├── search-context.tsx
│   ├── search-result-item.tsx
│   └── index.ts
│
├── notifications/         # 4 files - Notification system
│   ├── notification-bell.tsx
│   ├── notification-item.tsx
│   ├── notification-panel.tsx
│   └── index.ts
│
├── organization/          # 3 files - Org management
│   ├── org-switcher.tsx
│   ├── create-org-dialog.tsx
│   └── org-settings-dialog.tsx
│
├── project/               # 4 files - Project management
│   ├── project-card.tsx
│   ├── project-list.tsx
│   ├── create-project-dialog.tsx
│   └── project-settings-dialog.tsx
│
├── file/                  # 4 files - File upload
│   ├── file-upload-zone.tsx
│   ├── file-preview.tsx
│   ├── file-list-item.tsx
│   └── index.ts
│
├── navigation/            # 1 file - View switching
│   └── view-switcher.tsx
│
├── common/                # 4 files - Shared components
│   ├── empty-state.tsx
│   ├── loading-overlay.tsx
│   ├── spinner.tsx
│   └── confirm-dialog.tsx
│
└── auth/                  # 1 file - Auth components
    └── protected-route.tsx
```

---

## Data Flow Architecture

### REST API + React Query

```
┌─────────────────────────────────────────────────────────────────┐
│                         Component                                │
│  const { data, isLoading } = useNodes(projectId)                │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      React Query                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cache Key: ['nodes', projectId]                         │   │
│  │  Stale Time: 60 seconds                                  │   │
│  │  Refetch on Window Focus: false                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Client                                  │
│  api.nodes.list(projectId, params)                              │
│    → GET /api/v1/projects/{projectId}/nodes                     │
│    → Headers: { Authorization: Bearer {token} }                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mutation Flow

```
User Action (Create Node)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  useCreateNode(projectId)                                        │
│  mutate({ title, description, ... })                            │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Optimistic Update (optional)                                    │
│  - Update local Zustand store immediately                        │
│  - Show new node in UI before server response                    │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Request                                                     │
│  POST /api/v1/projects/{projectId}/nodes                        │
│  Body: { title, description, parentId, ... }                    │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cache Invalidation                                              │
│  queryClient.invalidateQueries(['nodes', projectId])            │
│  → Triggers refetch of nodes list                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Communication

### Connection Flow

```
┌─────────────┐     ┌─────────────────────────────────────────────┐
│   Auth      │     │           WebSocket Flow                     │
│   Ready     │────▶│                                              │
└─────────────┘     │  1. Get WS token: POST /api/v1/auth/ws-token │
                    │  2. Connect: ws://api/ws?token={token}       │
                    │  3. Subscribe: { type: 'subscribe',          │
                    │                  payload: { channel } }      │
                    │  4. Receive updates in real-time              │
                    └─────────────────────────────────────────────┘
```

### Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client                                      │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Subscribe  │  │  Presence   │  │  Lock Acquire/Release   │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Server                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Redis Pub/Sub                         │   │
│  │  (broadcasts across multiple server instances)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────┐
          │                               │                       │
          ▼                               ▼                       ▼
┌─────────────────┐         ┌─────────────────┐     ┌─────────────────┐
│  node_created   │         │ presence_update │     │  lock_acquired  │
│  node_updated   │         │                 │     │  lock_released  │
│  node_deleted   │         │                 │     │                 │
└─────────────────┘         └─────────────────┘     └─────────────────┘
```

---

## View Mode System

```
┌─────────────────────────────────────────────────────────────────┐
│                    View Switcher                                 │
│  ┌──────┐  ┌────────┐  ┌───────┐  ┌──────┐                     │
│  │ Tree │  │ Canvas │  │ Graph │  │ Grid │                     │
│  └───┬──┘  └───┬────┘  └───┬───┘  └───┬──┘                     │
│      │         │           │          │                         │
│      │    URL: ?view=canvas           │                         │
└──────┼─────────┼───────────┼──────────┼─────────────────────────┘
       │         │           │          │
       ▼         ▼           ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│TreeView  │ │CanvasView│ │GraphView │ │ GridView │
│          │ │          │ │          │ │          │
│Recursive │ │ReactFlow │ │D3 Force  │ │Card Grid │
│hierarchy │ │drag/drop │ │directed  │ │folders   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
       │         │           │          │
       └─────────┴─────────┬─┴──────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Shared State         │
              │   - selectedNodeId     │
              │   - Node detail panel  │
              │   - Context menus      │
              └────────────────────────┘
```

All four views share:
- Node selection state (Zustand `useAppStore`)
- Right-side detail panel
- CRUD operations via context menus
- WebSocket subscriptions for live updates

---

## Agent Execution Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Execution Flow                          │
│                                                                  │
│  ┌─────────────┐                                                │
│  │ Agent Node  │  Click "Execute"                               │
│  │ (authorType │────────────────────┐                           │
│  │  = agent)   │                    │                           │
│  └─────────────┘                    ▼                           │
│                          ┌─────────────────────┐                │
│                          │ useExecution()      │                │
│                          │ startExecution()    │                │
│                          └──────────┬──────────┘                │
│                                     │                           │
│                                     ▼                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Execution Store                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  executions: Map<nodeId, AgentExecution>           │  │  │
│  │  │  progressUpdates: Map<nodeId, ExecutionProgress>   │  │  │
│  │  │  hitlRequests: HITLRequest[]                       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                     │                           │
│                     ┌───────────────┴───────────────┐          │
│                     ▼                               ▼          │
│          ┌─────────────────────┐       ┌─────────────────────┐ │
│          │  Execution Panel    │       │    HITL Modal       │ │
│          │  - Status badge     │       │  - Input requests   │ │
│          │  - Progress bar     │       │  - Approval requests│ │
│          │  - Controls         │       │                     │ │
│          └─────────────────────┘       └─────────────────────┘ │
│                     │                               │          │
│                     ▼                               │          │
│          ┌─────────────────────┐                   │          │
│          │   Trace Timeline    │◀──────────────────┘          │
│          │  - LLM calls        │   User responds to HITL      │
│          │  - Tool calls       │                               │
│          │  - Decisions        │                               │
│          │  - Checkpoints      │                               │
│          └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### Execution States

```
┌────────────┐    start     ┌─────────────┐
│  pending   │─────────────▶│   running   │
└────────────┘              └──────┬──────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
       ┌──────────┐         ┌──────────┐        ┌──────────┐
       │  paused  │         │ complete │        │  failed  │
       └────┬─────┘         └──────────┘        └──────────┘
            │
            │ resume
            ▼
       ┌──────────┐
       │ running  │
       └──────────┘
```

---

## File Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      File Upload Flow                            │
│                                                                  │
│  1. User selects file                                           │
│     └─▶ FileUploadZone validates (size, type)                   │
│                                                                  │
│  2. Request presigned URL                                       │
│     └─▶ POST /api/v1/orgs/{orgId}/files/upload                  │
│         Response: { uploadUrl, fileId, fields }                 │
│                                                                  │
│  3. Direct upload to S3                                         │
│     └─▶ PUT {uploadUrl}                                         │
│         Headers: { Content-Type, x-amz-* }                      │
│                                                                  │
│  4. Confirm upload with backend                                 │
│     └─▶ POST /api/v1/files/{fileId}/confirm                     │
│         Response: { file }                                      │
│                                                                  │
│  5. Associate file with node input                              │
│     └─▶ POST /api/v1/nodes/{nodeId}/inputs                      │
│         Body: { inputType: 'file', fileId }                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Search System

```
┌─────────────────────────────────────────────────────────────────┐
│                       Search Flow                                │
│                                                                  │
│  Cmd+K pressed                                                  │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SearchCommand (Command Palette)                         │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  Search Input                                      │  │   │
│  │  │  [                                                ]│  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │                          │                               │   │
│  │            Debounce (300ms)                             │   │
│  │                          │                               │   │
│  │                          ▼                               │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  useSearch Hook                                    │  │   │
│  │  │  - Query caching (30s stale time)                  │  │   │
│  │  │  - Recent items (localStorage)                     │  │   │
│  │  │  - Full-text or Semantic toggle                    │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │                          │                               │   │
│  │                          ▼                               │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  Search Results                                    │  │   │
│  │  │  - Node results with status badges                 │  │   │
│  │  │  - Project results                                 │  │   │
│  │  │  - Recent items (when no query)                    │  │   │
│  │  │  - Quick actions                                   │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Patterns

### 1. Provider Pattern

Context providers are nested in `providers.tsx`:

```tsx
<QueryClientProvider>      // React Query for server state
  <AuthProvider>           // Authentication context
    <TooltipProvider>      // Radix UI tooltips
      <WebSocketWrapper>   // Conditional WebSocket
        <SearchProvider>   // Search dialog state
          {children}
        </SearchProvider>
      </WebSocketWrapper>
    </TooltipProvider>
  </AuthProvider>
</QueryClientProvider>
```

### 2. Compound Components

Complex components use composition:

```tsx
// Tabs compound component
<Tabs defaultValue="evidence">
  <TabsList>
    <TabsTrigger value="evidence">Evidence</TabsTrigger>
    <TabsTrigger value="inputs">Inputs</TabsTrigger>
    <TabsTrigger value="outputs">Outputs</TabsTrigger>
  </TabsList>
  <TabsContent value="evidence">...</TabsContent>
  <TabsContent value="inputs">...</TabsContent>
  <TabsContent value="outputs">...</TabsContent>
</Tabs>
```

### 3. Custom Hooks for Logic

Business logic is extracted into hooks:

```tsx
// Component is thin - just UI
function NodeDetailPanel({ node }) {
  const { users } = useNodePresence(node.id);
  const { isLocked, lockHolder } = useNodeLock(node.id);

  return (
    <div>
      <PresenceAvatars users={users} />
      <LockIndicator isLocked={isLocked} holder={lockHolder} />
    </div>
  );
}
```

### 4. Optimistic Updates

Mutations update UI before server response:

```tsx
const mutation = useMutation({
  mutationFn: api.nodes.create,
  onMutate: async (newNode) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries(['nodes']);

    // Snapshot previous value
    const previous = queryClient.getQueryData(['nodes']);

    // Optimistically update
    queryClient.setQueryData(['nodes'], (old) => [...old, newNode]);

    return { previous };
  },
  onError: (err, newNode, context) => {
    // Rollback on error
    queryClient.setQueryData(['nodes'], context.previous);
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries(['nodes']);
  },
});
```

---

## Backend Integration

### Required API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/ws-token` | POST | Get WebSocket auth token |
| `/api/v1/orgs` | GET, POST | Organization CRUD |
| `/api/v1/orgs/{id}` | GET, PATCH, DELETE | Single org operations |
| `/api/v1/projects` | GET, POST | Project CRUD |
| `/api/v1/projects/{id}` | GET, PATCH, DELETE | Single project ops |
| `/api/v1/projects/{id}/nodes` | GET, POST | Node list/create |
| `/api/v1/nodes/{id}` | GET, PATCH, DELETE | Single node ops |
| `/api/v1/nodes/{id}/lock` | POST, DELETE | Lock acquire/release |
| `/api/v1/executions` | POST | Start execution |
| `/api/v1/executions/{id}` | GET | Get execution status |
| `/api/v1/search` | POST | Full-text search |
| `/api/v1/search/semantic` | POST | Semantic search |
| `/ws` | WebSocket | Real-time connection |

### WebSocket Messages

The backend must handle and emit these message types:
- See [WEBSOCKET.md](./WEBSOCKET.md) for full protocol specification

---

## Next Steps

### Immediate
1. **Connect mock execution to real API** - Replace `useExecution` simulation
2. **HITL API integration** - Wire up approval/input submission
3. **Version diff API** - Implement node version comparison

### Future
1. **Virtual scrolling** - For large node lists
2. **React.memo optimization** - Reduce re-renders
3. **Code splitting** - Per-view lazy loading
4. **E2E testing** - Playwright test suite
