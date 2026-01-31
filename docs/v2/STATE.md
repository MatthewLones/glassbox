# GlassBox V2 Frontend State Management

This document covers state management in the GlassBox frontend, including Zustand stores, React Query integration, and state flow patterns.

---

## Overview

GlassBox uses a hybrid state management approach:

| Type | Library | Purpose |
|------|---------|---------|
| **Client State** | Zustand | UI state, selections, preferences |
| **Server State** | React Query | API data caching and synchronization |
| **Context State** | React Context | Auth, WebSocket, Search dialog |

---

## State Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Component                                 │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐│
│  │  const nodes =       │  │  const { selectedNodeId } =     ││
│  │    useNodes(projectId)│  │    useAppStore()                ││
│  │                       │  │                                  ││
│  │  (React Query)        │  │  (Zustand)                       ││
│  └──────────┬───────────┘  └──────────────┬───────────────────┘│
└─────────────┼──────────────────────────────┼────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────┐  ┌─────────────────────────────────┐
│     React Query Cache       │  │        Zustand Store            │
│                             │  │                                 │
│  ['nodes', projectId]       │  │  selectedNodeId: 'abc123'      │
│  ['project', projectId]     │  │  currentOrgId: 'org-1'         │
│  ['orgs']                   │  │  sidebarOpen: true             │
│                             │  │  viewMode: 'canvas'            │
│  Stale time: 60s            │  │                                 │
│  Refetch on mount: true     │  │  Persisted to localStorage     │
└─────────────────────────────┘  └─────────────────────────────────┘
```

---

## Zustand Stores

### App Store

**Location:** `apps/web/src/stores/app-store.ts`

The app store manages global application state including user context, organization/project selection, and UI preferences.

```typescript
interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // Organization
  currentOrgId: string;
  setCurrentOrgId: (id: string) => void;
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;

  // Project
  currentProjectId: string;
  setCurrentProjectId: (id: string) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Node Selection
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // View Mode
  viewMode: 'tree' | 'canvas' | 'graph' | 'grid';
  setViewMode: (mode: ViewMode) => void;
}
```

#### Usage

```tsx
import { useAppStore } from '@/stores/app-store';

function Sidebar() {
  const { currentOrgId, sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside className={sidebarOpen ? 'w-64' : 'w-16'}>
      <button onClick={toggleSidebar}>Toggle</button>
      <OrgList selectedId={currentOrgId} />
    </aside>
  );
}
```

#### Persistence

The app store persists selected keys to localStorage:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ... state and actions
    }),
    {
      name: 'glassbox-app-store',
      partialize: (state) => ({
        currentOrgId: state.currentOrgId,
        currentProjectId: state.currentProjectId,
        sidebarOpen: state.sidebarOpen,
        viewMode: state.viewMode,
      }),
    }
  )
);
```

---

### Canvas Store

**Location:** `apps/web/src/stores/canvas-store.ts`

The canvas store manages ReactFlow canvas state.

```typescript
interface CanvasState {
  // Viewport
  viewport: { x: number; y: number; zoom: number };
  setViewport: (viewport: Viewport) => void;

  // Grid
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  gridSize: number;
  setGridSize: (size: number) => void;

  // Minimap
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;

  // Selection
  multiSelectEnabled: boolean;
  setMultiSelectEnabled: (enabled: boolean) => void;

  // Interaction Mode
  interactionMode: 'pan' | 'select';
  setInteractionMode: (mode: InteractionMode) => void;

  // Zoom
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
}
```

#### Usage

```tsx
import { useCanvasStore } from '@/stores/canvas-store';

function CanvasToolbar() {
  const { showGrid, setShowGrid, snapToGrid, setSnapToGrid } = useCanvasStore();

  return (
    <div className="toolbar">
      <Toggle pressed={showGrid} onPressedChange={setShowGrid}>
        Grid
      </Toggle>
      <Toggle pressed={snapToGrid} onPressedChange={setSnapToGrid}>
        Snap
      </Toggle>
    </div>
  );
}
```

---

### Execution Store

**Location:** `apps/web/src/stores/execution-store.ts`

The execution store manages agent execution state and HITL requests.

```typescript
interface ExecutionState {
  // Active Executions
  executions: Map<string, AgentExecution>;
  setExecution: (nodeId: string, execution: AgentExecution) => void;
  removeExecution: (nodeId: string) => void;

  // Progress Updates
  progressUpdates: Map<string, ExecutionProgress>;
  updateProgress: (nodeId: string, progress: ExecutionProgress) => void;

  // HITL Requests
  hitlRequests: HITLRequest[];
  addHITLRequest: (request: HITLRequest) => void;
  removeHITLRequest: (requestId: string) => void;

  // Active Execution
  activeExecutionId: string | null;
  setActiveExecutionId: (id: string | null) => void;

  // Actions
  updateExecutionStatus: (nodeId: string, status: AgentExecutionStatus) => void;
  addTraceEvent: (nodeId: string, event: TraceEvent) => void;
}

interface HITLRequest {
  id: string;
  executionId: string;
  nodeId: string;
  type: 'input' | 'approval';
  prompt: string;
  options?: string[];
  timestamp: string;
}
```

#### Selectors

```typescript
// Get active execution
export const selectActiveExecution = (state: ExecutionState) =>
  state.activeExecutionId
    ? state.executions.get(state.activeExecutionId)
    : null;

// Get running executions
export const selectRunningExecutions = (state: ExecutionState) =>
  Array.from(state.executions.values()).filter(
    (e) => e.status === 'running' || e.status === 'paused'
  );

// Get pending HITL count
export const selectPendingHITLCount = (state: ExecutionState) =>
  state.hitlRequests.length;
```

#### Usage

```tsx
import { useExecutionStore, selectPendingHITLCount } from '@/stores/execution-store';

function HITLNotification() {
  const pendingCount = useExecutionStore(selectPendingHITLCount);

  return (
    <Badge variant={pendingCount > 0 ? 'destructive' : 'secondary'}>
      {pendingCount}
    </Badge>
  );
}
```

---

## React Query Integration

### Configuration

**Location:** `apps/web/src/app/providers.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,          // 1 minute
      refetchOnWindowFocus: false,   // Disable refetch on focus
      retry: 1,                       // Retry once on failure
    },
    mutations: {
      onError: (error) => {
        toast.error(error.message);
      },
    },
  },
});
```

### Query Keys

```typescript
// Organization queries
['orgs']                           // List all orgs
['org', orgId]                     // Single org

// Project queries
['projects', orgId]                // List projects in org
['project', projectId]             // Single project

// Node queries
['nodes', projectId]               // List nodes in project
['nodes', projectId, { parentId }] // List children of node
['node', nodeId]                   // Single node
['node', nodeId, 'versions']       // Node version history

// Search queries
['search', orgId, query, types]    // Search results
```

### Cache Invalidation Patterns

```typescript
// After creating a node
queryClient.invalidateQueries(['nodes', projectId]);

// After updating a node
queryClient.invalidateQueries(['node', nodeId]);
queryClient.invalidateQueries(['nodes', projectId]);

// After deleting a node
queryClient.invalidateQueries(['nodes', projectId]);
// Also invalidate parent if exists
if (node.parentId) {
  queryClient.invalidateQueries(['nodes', projectId, { parentId: node.parentId }]);
}
```

---

## State Flow Patterns

### User Selects Node

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User clicks node in tree/canvas/graph/grid                  │
│                                                                  │
│  2. View component calls:                                       │
│     setSelectedNodeId(nodeId)                                   │
│                                                                  │
│  3. Zustand updates state                                       │
│     selectedNodeId: 'node-123'                                  │
│                                                                  │
│  4. All subscribing components re-render                        │
│     - NodeDetailPanel shows node info                           │
│     - Tree highlights selected item                             │
│     - Canvas highlights selected node                           │
│                                                                  │
│  5. Presence hook sends update                                  │
│     useNodePresence(selectedNodeId)                             │
│     → WebSocket: presence { nodeId, action: 'viewing' }         │
└─────────────────────────────────────────────────────────────────┘
```

### User Creates Node

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User fills create form, clicks Submit                       │
│                                                                  │
│  2. Mutation fires:                                             │
│     createNode.mutate({ title, description, ... })              │
│                                                                  │
│  3. Optimistic update (optional):                               │
│     - Add temp node to cache                                    │
│     - Show in UI immediately                                    │
│                                                                  │
│  4. API request:                                                │
│     POST /api/v1/projects/{projectId}/nodes                     │
│                                                                  │
│  5. On success:                                                 │
│     - Replace temp node with real data                          │
│     - Invalidate ['nodes', projectId]                           │
│     - Close form dialog                                         │
│     - Select new node                                           │
│                                                                  │
│  6. WebSocket broadcast (from backend):                         │
│     { type: 'node_created', payload: { node } }                 │
│                                                                  │
│  7. Other clients receive update:                               │
│     - Invalidate their cache                                    │
│     - Show toast notification                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Real-Time Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  WebSocket receives: node_updated                               │
│                                                                  │
│  1. WebSocket hook processes message:                           │
│     useProjectSubscription(projectId, {                         │
│       onNodeUpdated: (nodeId, changes) => { ... }               │
│     })                                                          │
│                                                                  │
│  2. Invalidate React Query cache:                               │
│     queryClient.invalidateQueries(['node', nodeId])             │
│                                                                  │
│  3. Components re-fetch and re-render                           │
│                                                                  │
│  4. Optional: Show toast notification                           │
│     toast.info(`Node updated: ${changes.title}`)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Synchronization

### Cross-View Synchronization

All four views (tree, canvas, graph, grid) share the same state:

```typescript
// All views use the same selectedNodeId
const { selectedNodeId, setSelectedNodeId } = useAppStore();

// Selection in one view updates all others
<TreeView onSelect={(node) => setSelectedNodeId(node.id)} />
<CanvasView selectedNodeId={selectedNodeId} />
<GraphView selectedNodeId={selectedNodeId} />
<GridView selectedNodeId={selectedNodeId} />
```

### URL Synchronization

View mode is synchronized with URL:

```typescript
// Read from URL
const searchParams = useSearchParams();
const viewMode = searchParams.get('view') || 'tree';

// Update URL when view changes
const setViewMode = (mode: ViewMode) => {
  const params = new URLSearchParams(searchParams);
  params.set('view', mode);
  router.push(`?${params.toString()}`);
};
```

---

## Best Practices

### 1. Use Appropriate State Type

```typescript
// UI-only state → Zustand
const { sidebarOpen } = useAppStore();

// Server data → React Query
const { data: nodes } = useNodes(projectId);

// Shared across components → Context or Zustand
const { isAuthenticated } = useAuth();
```

### 2. Avoid Duplicate State

```typescript
// Bad - duplicating server state
const [nodes, setNodes] = useState([]);
useEffect(() => {
  api.nodes.list(projectId).then(setNodes);
}, [projectId]);

// Good - using React Query
const { data: nodes } = useNodes(projectId);
```

### 3. Use Selectors for Derived State

```typescript
// Define selector once
const selectRunningCount = (state: ExecutionState) =>
  Array.from(state.executions.values())
    .filter(e => e.status === 'running')
    .length;

// Use in component
const runningCount = useExecutionStore(selectRunningCount);
```

### 4. Batch Related Updates

```typescript
// Instead of multiple setState calls
setSelectedNodeId(nodeId);
setSelectedNode(node);

// Combine in a single action
setSelection: (nodeId, node) => set({
  selectedNodeId: nodeId,
  selectedNode: node,
}),
```

### 5. Persist Only Essential State

```typescript
// Persist user preferences, not transient state
partialize: (state) => ({
  // Persist
  currentOrgId: state.currentOrgId,
  sidebarOpen: state.sidebarOpen,
  viewMode: state.viewMode,

  // Don't persist
  // selectedNodeId - context-dependent
  // user - comes from auth
}),
```

---

## Debugging

### React Query DevTools

```tsx
// Included in development
<ReactQueryDevtools initialIsOpen={false} />
```

### Zustand DevTools

```typescript
// Add devtools middleware
import { devtools } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({ ... }),
      { name: 'glassbox-app-store' }
    ),
    { name: 'AppStore' }
  )
);
```

### Logging State Changes

```typescript
// Debug middleware
const log = (config) => (set, get, api) =>
  config(
    (...args) => {
      console.log('  applying', args);
      set(...args);
      console.log('  new state', get());
    },
    get,
    api
  );
```
