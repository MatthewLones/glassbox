# GlassBox V2 Frontend Custom Hooks

This document covers all custom React hooks in the GlassBox frontend, including data fetching, WebSocket integration, and feature-specific hooks.

---

## Overview

GlassBox uses custom hooks to encapsulate reusable logic:

| Category | Hooks | Purpose |
|----------|-------|---------|
| **Data Query** | useNodes, useProjects, useOrgs | React Query wrappers for fetching |
| **Data Mutation** | useCreateNode, useUpdateNode, useDeleteNode | CRUD operations with cache invalidation |
| **WebSocket** | useProjectSubscription, useNodePresence | Real-time updates |
| **Features** | useSearch, useExecution, useNotifications | Feature-specific logic |
| **Utilities** | useFileUpload, useDebounce | Helper functionality |

---

## Hook Files

```
apps/web/src/hooks/
├── use-nodes.ts              # Node CRUD hooks
├── use-projects.ts           # Project CRUD hooks
├── use-execution.ts          # Agent execution (mocked)
├── use-search.ts             # Search functionality
├── use-notifications.ts      # Notification state
└── use-file-upload.ts        # S3 presigned upload
```

---

## Data Query Hooks

### useNodes

**Location:** `apps/web/src/hooks/use-nodes.ts`

Fetches nodes for a project with optional filtering.

```typescript
function useNodes(
  projectId: string,
  params?: {
    parentId?: string;
    status?: NodeStatus;
  }
): UseQueryResult<{ data: Node[] }>
```

#### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | `string` | Yes | Project to fetch nodes from |
| `params.parentId` | `string` | No | Filter by parent node |
| `params.status` | `NodeStatus` | No | Filter by status |

#### Return Value

Returns React Query's `UseQueryResult` with:
- `data.data` - Array of Node objects
- `isLoading` - Loading state
- `error` - Error if request failed
- `refetch` - Function to manually refetch

#### Usage

```tsx
function NodeList({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useNodes(projectId);

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;

  return (
    <ul>
      {data?.data.map(node => (
        <li key={node.id}>{node.title}</li>
      ))}
    </ul>
  );
}
```

#### Query Key

```typescript
['nodes', projectId, params]
```

---

### useNode

Fetches a single node by ID.

```typescript
function useNode(nodeId: string): UseQueryResult<Node>
```

#### Usage

```tsx
function NodeDetail({ nodeId }: { nodeId: string }) {
  const { data: node, isLoading } = useNode(nodeId);

  if (isLoading) return <Skeleton />;
  return <h1>{node?.title}</h1>;
}
```

#### Query Key

```typescript
['node', nodeId]
```

---

### useNodeChildren

Fetches child nodes of a parent node.

```typescript
function useNodeChildren(nodeId: string): UseQueryResult<{ data: Node[] }>
```

#### Usage

```tsx
function ChildNodes({ parentId }: { parentId: string }) {
  const { data } = useNodeChildren(parentId);

  return (
    <div>
      {data?.data.map(child => (
        <NodeCard key={child.id} node={child} />
      ))}
    </div>
  );
}
```

---

### useProjects

**Location:** `apps/web/src/hooks/use-projects.ts`

Fetches projects for an organization.

```typescript
function useProjects(orgId: string): UseQueryResult<{ data: Project[] }>
```

#### Usage

```tsx
function ProjectList({ orgId }: { orgId: string }) {
  const { data: projects } = useProjects(orgId);

  return (
    <select>
      {projects?.data.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
```

---

### useProject

Fetches a single project by ID.

```typescript
function useProject(projectId: string): UseQueryResult<Project>
```

---

### useOrganizations

Fetches all organizations for the current user.

```typescript
function useOrganizations(): UseQueryResult<{ data: Organization[] }>
```

---

## Data Mutation Hooks

### useCreateNode

Creates a new node with automatic cache invalidation.

```typescript
function useCreateNode(projectId: string): UseMutationResult<
  Node,
  APIError,
  CreateNodeRequest
>
```

#### Usage

```tsx
function CreateNodeForm({ projectId }: { projectId: string }) {
  const createNode = useCreateNode(projectId);

  const handleSubmit = async (data: CreateNodeRequest) => {
    const node = await createNode.mutateAsync(data);
    console.log('Created:', node.id);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" />
      <button type="submit" disabled={createNode.isPending}>
        {createNode.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

#### Cache Invalidation

On success:
```typescript
queryClient.invalidateQueries(['nodes', projectId]);
```

---

### useUpdateNode

Updates an existing node.

```typescript
function useUpdateNode(nodeId: string): UseMutationResult<
  Node,
  APIError,
  UpdateNodeRequest
>
```

#### Usage

```tsx
function NodeEditor({ node }: { node: Node }) {
  const updateNode = useUpdateNode(node.id);

  const handleSave = async (changes: Partial<Node>) => {
    await updateNode.mutateAsync(changes);
  };

  return (
    <Editor
      initialValue={node.description}
      onSave={(description) => handleSave({ description })}
      isSaving={updateNode.isPending}
    />
  );
}
```

#### Cache Invalidation

On success:
```typescript
queryClient.invalidateQueries(['node', nodeId]);
queryClient.invalidateQueries(['nodes', node.projectId]);
```

---

### useDeleteNode

Deletes a node.

```typescript
function useDeleteNode(nodeId: string): UseMutationResult<void, APIError, void>
```

#### Usage

```tsx
function DeleteButton({ node }: { node: Node }) {
  const deleteNode = useDeleteNode(node.id);

  const handleDelete = async () => {
    if (confirm('Delete this node?')) {
      await deleteNode.mutateAsync();
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={handleDelete}
      disabled={deleteNode.isPending}
    >
      Delete
    </Button>
  );
}
```

---

### useNodeLock

Acquires and releases edit locks on nodes.

```typescript
function useNodeLock(nodeId: string): {
  acquireLock: () => Promise<void>;
  releaseLock: () => Promise<void>;
  isLocking: boolean;
  isLocked: boolean;
  lockHolder: User | null;
}
```

#### Usage

```tsx
function EditableNode({ node }: { node: Node }) {
  const { acquireLock, releaseLock, isLocked, lockHolder } = useNodeLock(node.id);

  const handleEdit = async () => {
    await acquireLock();
    // Start editing...
  };

  useEffect(() => {
    return () => {
      releaseLock(); // Release on unmount
    };
  }, []);

  if (isLocked && lockHolder) {
    return <p>Locked by {lockHolder.name}</p>;
  }

  return <button onClick={handleEdit}>Edit</button>;
}
```

---

## WebSocket Hooks

### useProjectSubscription

**Location:** `apps/web/src/lib/websocket/hooks.ts`

Subscribes to real-time project updates.

```typescript
function useProjectSubscription(
  projectId: string | null,
  handlers: {
    onNodeCreated?: (node: Node) => void;
    onNodeUpdated?: (nodeId: string, changes: Partial<Node>) => void;
    onNodeDeleted?: (nodeId: string) => void;
    onPresenceUpdate?: (presence: PresenceInfo[]) => void;
  }
): void
```

#### Usage

```tsx
function ProjectWorkspace({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  useProjectSubscription(projectId, {
    onNodeCreated: (node) => {
      queryClient.invalidateQueries(['nodes', projectId]);
      toast.info(`New node: ${node.title}`);
    },
    onNodeUpdated: (nodeId, changes) => {
      queryClient.invalidateQueries(['node', nodeId]);
    },
    onNodeDeleted: (nodeId) => {
      queryClient.invalidateQueries(['nodes', projectId]);
    },
  });

  return <NodeCanvas projectId={projectId} />;
}
```

---

### useNodePresence

Tracks and broadcasts presence on a specific node.

```typescript
function useNodePresence(nodeId: string | null): {
  viewers: PresenceInfo[];
  editors: PresenceInfo[];
  setAction: (action: 'viewing' | 'editing' | 'idle') => void;
}
```

#### Usage

```tsx
function NodeDetailPanel({ nodeId }: { nodeId: string }) {
  const { viewers, editors, setAction } = useNodePresence(nodeId);

  useEffect(() => {
    setAction('viewing');
    return () => setAction('idle');
  }, [nodeId]);

  return (
    <div>
      <PresenceAvatars users={[...viewers, ...editors]} />
      {/* Node content */}
    </div>
  );
}
```

---

### useExecutionUpdates

Subscribes to agent execution progress updates.

```typescript
function useExecutionUpdates(
  nodeId: string | null,
  handlers: {
    onProgress?: (progress: ExecutionProgress) => void;
    onStatusChange?: (status: AgentExecutionStatus) => void;
    onTraceEvent?: (event: TraceEvent) => void;
    onHITLRequest?: (request: HITLRequest) => void;
  }
): void
```

#### Usage

```tsx
function ExecutionMonitor({ nodeId }: { nodeId: string }) {
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);

  useExecutionUpdates(nodeId, {
    onProgress: setProgress,
    onStatusChange: (status) => {
      if (status === 'completed') {
        toast.success('Execution complete!');
      }
    },
    onHITLRequest: (request) => {
      // Show HITL modal
    },
  });

  return progress ? (
    <ProgressBar value={progress.percentage} />
  ) : null;
}
```

---

### useConnectionStatus

Returns WebSocket connection state.

```typescript
function useConnectionStatus(): {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
}
```

#### Usage

```tsx
function ConnectionIndicator() {
  const { isConnected, isConnecting, error } = useConnectionStatus();

  if (error) return <Badge variant="destructive">Disconnected</Badge>;
  if (isConnecting) return <Badge variant="secondary">Connecting...</Badge>;
  if (isConnected) return <Badge variant="success">Connected</Badge>;

  return null;
}
```

---

## Feature Hooks

### useSearch

**Location:** `apps/web/src/hooks/use-search.ts`

Provides debounced search with React Query caching.

```typescript
function useSearch(
  orgId: string,
  options?: {
    debounceMs?: number;
    types?: SearchResultType[];
  }
): {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  clear: () => void;
}
```

#### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `orgId` | `string` | - | Organization to search within |
| `debounceMs` | `number` | `300` | Debounce delay in milliseconds |
| `types` | `SearchResultType[]` | `['node', 'project']` | Result types to include |

#### Usage

```tsx
function SearchInput({ orgId }: { orgId: string }) {
  const { query, setQuery, results, isSearching, clear } = useSearch(orgId);

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {isSearching && <Spinner />}
      <SearchResults results={results} onSelect={clear} />
    </div>
  );
}
```

---

### useSearchNavigation

Keyboard navigation for search results.

```typescript
function useSearchNavigation(
  results: SearchResult[],
  onSelect: (result: SearchResult) => void
): {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
}
```

#### Usage

```tsx
function SearchResultList({ results, onSelect }: Props) {
  const { selectedIndex, handleKeyDown } = useSearchNavigation(results, onSelect);

  return (
    <ul onKeyDown={handleKeyDown}>
      {results.map((result, i) => (
        <li
          key={result.id}
          data-selected={i === selectedIndex}
          onClick={() => onSelect(result)}
        >
          {result.title}
        </li>
      ))}
    </ul>
  );
}
```

---

### useSearchShortcut

Registers Cmd+K keyboard shortcut.

```typescript
function useSearchShortcut(onOpen: () => void): void
```

#### Usage

```tsx
function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  useSearchShortcut(() => setSearchOpen(true));

  return (
    <>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      {/* App content */}
    </>
  );
}
```

---

### useExecution

**Location:** `apps/web/src/hooks/use-execution.ts`

Manages agent execution state and controls.

```typescript
function useExecution(nodeId: string): {
  // State
  execution: AgentExecution | null;
  trace: TraceEvent[];
  isRunning: boolean;
  isPaused: boolean;
  progress: ExecutionProgress | null;

  // Actions
  start: (config?: ExecutionConfig) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;

  // HITL
  pendingHITL: HITLRequest | null;
  respondToHITL: (response: HITLResponse) => Promise<void>;
}
```

#### Usage

```tsx
function ExecutionPanel({ nodeId }: { nodeId: string }) {
  const {
    execution,
    isRunning,
    isPaused,
    trace,
    start,
    pause,
    resume,
    cancel,
    pendingHITL,
    respondToHITL,
  } = useExecution(nodeId);

  return (
    <div>
      <ExecutionControls
        isRunning={isRunning}
        isPaused={isPaused}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onCancel={cancel}
      />

      <TraceTimeline events={trace} />

      {pendingHITL && (
        <HITLModal
          request={pendingHITL}
          onSubmit={respondToHITL}
        />
      )}
    </div>
  );
}
```

#### Backend Integration

> **Note:** The `useExecution` hook is currently **mocked** for frontend development. Real implementation requires:
>
> 1. `POST /api/v1/nodes/{nodeId}/executions` - Start execution
> 2. `POST /api/v1/nodes/{nodeId}/executions/pause` - Pause
> 3. `POST /api/v1/nodes/{nodeId}/executions/resume` - Resume
> 4. `POST /api/v1/nodes/{nodeId}/executions/cancel` - Cancel
> 5. WebSocket messages for progress updates

---

### useNotifications

**Location:** `apps/web/src/hooks/use-notifications.ts`

Manages notification state with localStorage persistence.

```typescript
function useNotifications(): {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}
```

#### Notification Type

```typescript
interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}
```

#### Usage

```tsx
function NotificationBell() {
  const { unreadCount, notifications, markAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger>
        <Bell />
        {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
      </PopoverTrigger>
      <PopoverContent>
        {notifications.map(n => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={() => markAsRead(n.id)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
```

---

### useDemoNotifications

Generates mock notifications for development.

```typescript
function useDemoNotifications(): void
```

Automatically generates notifications at random intervals when enabled. Used for testing the notification UI.

---

### useFileUpload

**Location:** `apps/web/src/hooks/use-file-upload.ts`

Handles S3 presigned URL uploads.

```typescript
function useFileUpload(orgId: string): {
  upload: (file: File) => Promise<UploadedFile>;
  isUploading: boolean;
  progress: number;
  error: Error | null;
}
```

#### Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Request presigned URL from backend                          │
│     POST /api/v1/orgs/{orgId}/files/upload                     │
│     { filename, contentType, size }                            │
│                                                                  │
│  2. Upload directly to S3                                       │
│     PUT {presignedUrl}                                          │
│     Body: file bytes                                            │
│                                                                  │
│  3. Confirm upload with backend                                 │
│     POST /api/v1/files/{fileId}/confirm                        │
│                                                                  │
│  4. Return file metadata                                        │
│     { id, filename, size, url, createdAt }                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Usage

```tsx
function FileUploader({ orgId }: { orgId: string }) {
  const { upload, isUploading, progress, error } = useFileUpload(orgId);

  const handleDrop = async (files: FileList) => {
    for (const file of files) {
      const uploaded = await upload(file);
      console.log('Uploaded:', uploaded.url);
    }
  };

  return (
    <DropZone onDrop={handleDrop} disabled={isUploading}>
      {isUploading && <ProgressBar value={progress} />}
      {error && <ErrorMessage error={error} />}
    </DropZone>
  );
}
```

---

## Utility Hooks

### useDebounce

Debounces a value with configurable delay.

```typescript
function useDebounce<T>(value: T, delay: number): T
```

#### Usage

```tsx
function SearchInput() {
  const [input, setInput] = useState('');
  const debouncedInput = useDebounce(input, 300);

  useEffect(() => {
    if (debouncedInput) {
      performSearch(debouncedInput);
    }
  }, [debouncedInput]);

  return <input value={input} onChange={(e) => setInput(e.target.value)} />;
}
```

---

### useLocalStorage

Persists state to localStorage with SSR safety.

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void]
```

#### Usage

```tsx
function ThemeSwitcher() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}
```

---

## Hook Patterns

### Composition Pattern

Combine multiple hooks for complex features:

```tsx
function useNodeEditor(nodeId: string) {
  const { data: node, isLoading } = useNode(nodeId);
  const updateNode = useUpdateNode(nodeId);
  const { acquireLock, releaseLock, isLocked } = useNodeLock(nodeId);
  const { setAction } = useNodePresence(nodeId);

  const startEditing = async () => {
    await acquireLock();
    setAction('editing');
  };

  const saveChanges = async (changes: Partial<Node>) => {
    await updateNode.mutateAsync(changes);
  };

  const stopEditing = async () => {
    await releaseLock();
    setAction('viewing');
  };

  return {
    node,
    isLoading,
    isLocked,
    isSaving: updateNode.isPending,
    startEditing,
    saveChanges,
    stopEditing,
  };
}
```

### Conditional Fetching

Only fetch when dependencies are available:

```tsx
function useProjectNodes() {
  const { currentProjectId } = useAppStore();

  return useNodes(currentProjectId!, {
    // Only run query when projectId exists
    enabled: !!currentProjectId,
  });
}
```

### Optimistic Updates

Update UI before server confirms:

```tsx
function useOptimisticUpdateNode(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNodeRequest) => api.nodes.update(nodeId, data),
    onMutate: async (newData) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries(['node', nodeId]);

      // Snapshot current value
      const previous = queryClient.getQueryData(['node', nodeId]);

      // Optimistically update
      queryClient.setQueryData(['node', nodeId], (old: Node) => ({
        ...old,
        ...newData,
      }));

      return { previous };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(['node', nodeId], context?.previous);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries(['node', nodeId]);
    },
  });
}
```

---

## Testing Hooks

### Test Setup

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

### Example Test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useNodes } from './use-nodes';

describe('useNodes', () => {
  it('fetches nodes for a project', async () => {
    const { result } = renderHook(
      () => useNodes('project-123'),
      { wrapper: createWrapper() }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify data
    expect(result.current.data?.data).toHaveLength(3);
  });
});
```

---

## Best Practices

### 1. Use Appropriate Query Keys

```typescript
// Hierarchical keys for easy invalidation
['nodes', projectId]                    // All nodes in project
['nodes', projectId, { parentId }]      // Filtered nodes
['node', nodeId]                        // Single node
['node', nodeId, 'versions']            // Node versions
```

### 2. Handle Loading States

```typescript
const { data, isLoading, isFetching, error } = useNodes(projectId);

// isLoading: true on first fetch
// isFetching: true on any fetch (including refetch)
```

### 3. Provide Error Boundaries

```tsx
function SafeComponent() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ComponentThatUsesHooks />
    </ErrorBoundary>
  );
}
```

### 4. Clean Up Side Effects

```typescript
function usePresenceTracking(nodeId: string) {
  const { setAction } = useNodePresence(nodeId);

  useEffect(() => {
    setAction('viewing');

    return () => {
      setAction('idle'); // Clean up on unmount
    };
  }, [nodeId, setAction]);
}
```

