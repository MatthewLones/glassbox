# GlassBox V2 Frontend Components

This document covers all UI components in the GlassBox frontend, organized by category with props, usage examples, and implementation details.

---

## Overview

The frontend contains **118 component files** across **22 categories**:

| Category | Components | Purpose |
|----------|------------|---------|
| **ui/** | 25 | Shadcn/ui primitives |
| **layout/** | 6 | App shell, header, sidebar |
| **canvas/** | 12 | ReactFlow canvas view |
| **graph/** | 8 | D3 force graph view |
| **tree/** | 6 | Hierarchical tree view |
| **grid/** | 5 | Folder-style grid view |
| **node/** | 15 | Node forms, cards, badges |
| **agent/** | 10 | Execution, traces, HITL |
| **presence/** | 4 | User presence indicators |
| **lock/** | 3 | Node locking UI |
| **search/** | 5 | Cmd+K command palette |
| **notifications/** | 4 | Notification system |
| **auth/** | 4 | Login, protected routes |
| **project/** | 6 | Project cards, lists |
| **org/** | 4 | Organization switcher |
| **common/** | 6 | Shared utility components |

---

## Component Directory Structure

```
apps/web/src/components/
├── ui/                          # Shadcn/ui base components
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── command.tsx              # cmdk integration
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── card.tsx
│   ├── popover.tsx
│   ├── scroll-area.tsx
│   ├── separator.tsx
│   ├── skeleton.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   ├── tooltip.tsx
│   └── ... (more primitives)
│
├── layout/                      # Application shell
│   ├── app-shell.tsx
│   ├── header.tsx
│   ├── sidebar.tsx
│   ├── breadcrumbs.tsx
│   ├── main-content.tsx
│   └── view-switcher.tsx
│
├── canvas/                      # ReactFlow canvas view
│   ├── canvas-view.tsx
│   ├── canvas-toolbar.tsx
│   ├── canvas-controls.tsx
│   ├── custom-node.tsx
│   ├── parent-child-edge.tsx
│   ├── dependency-edge.tsx
│   ├── minimap.tsx
│   ├── node-context-menu.tsx
│   └── ...
│
├── graph/                       # D3 force graph
│   ├── graph-view.tsx
│   ├── force-layout.tsx
│   ├── graph-node.tsx
│   ├── graph-link.tsx
│   ├── graph-controls.tsx
│   └── ...
│
├── tree/                        # Tree view
│   ├── tree-view.tsx
│   ├── tree-branch.tsx
│   ├── tree-node.tsx
│   ├── tree-context-menu.tsx
│   └── ...
│
├── grid/                        # Grid view
│   ├── grid-view.tsx
│   ├── grid-card.tsx
│   ├── grid-controls.tsx
│   └── ...
│
├── node/                        # Node components
│   ├── node-card.tsx
│   ├── node-detail-panel.tsx
│   ├── node-form.tsx
│   ├── node-create-dialog.tsx
│   ├── node-edit-dialog.tsx
│   ├── node-status-badge.tsx
│   ├── node-author-badge.tsx
│   ├── node-actions.tsx
│   └── ...
│
├── agent/                       # Execution components
│   ├── execution-panel.tsx
│   ├── execution-controls.tsx
│   ├── execution-status.tsx
│   ├── trace-timeline.tsx
│   ├── trace-event.tsx
│   ├── hitl-modal.tsx
│   ├── hitl-input.tsx
│   ├── hitl-approval.tsx
│   └── ...
│
├── presence/                    # Presence components
│   ├── presence-avatars.tsx
│   ├── presence-indicator.tsx
│   ├── user-presence.tsx
│   └── ...
│
├── lock/                        # Lock components
│   ├── lock-indicator.tsx
│   ├── lock-badge.tsx
│   ├── lock-warning.tsx
│   └── ...
│
├── search/                      # Search components
│   ├── search-command.tsx
│   ├── search-context.tsx
│   ├── search-result-item.tsx
│   ├── search-input.tsx
│   └── search-shortcut-hint.tsx
│
├── notifications/               # Notification components
│   ├── notification-bell.tsx
│   ├── notification-panel.tsx
│   ├── notification-item.tsx
│   └── notification-badge.tsx
│
├── auth/                        # Auth components
│   ├── protected-route.tsx
│   ├── login-button.tsx
│   ├── logout-button.tsx
│   └── user-menu.tsx
│
├── project/                     # Project components
│   ├── project-card.tsx
│   ├── project-list.tsx
│   ├── project-header.tsx
│   ├── project-create-dialog.tsx
│   └── ...
│
├── org/                         # Organization components
│   ├── org-switcher.tsx
│   ├── org-list.tsx
│   ├── org-create-dialog.tsx
│   └── ...
│
└── common/                      # Shared components
    ├── loading-spinner.tsx
    ├── error-boundary.tsx
    ├── empty-state.tsx
    ├── confirm-dialog.tsx
    ├── markdown-viewer.tsx
    └── ...
```

---

## UI Components (Shadcn/ui)

These are base primitives from Shadcn/ui, customized for GlassBox.

### Button

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outlined</Button>
<Button variant="ghost">Ghost</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
<Button>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading
</Button>
```

### Input

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-2">
  <Label htmlFor="title">Title</Label>
  <Input
    id="title"
    placeholder="Enter node title"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
  />
</div>
```

### Dialog

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Create Node</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Node</DialogTitle>
      <DialogDescription>
        Add a new node to your project.
      </DialogDescription>
    </DialogHeader>
    <NodeForm onSubmit={handleSubmit} />
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button type="submit">Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Command (cmdk)

```tsx
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Nodes">
      {nodes.map(node => (
        <CommandItem key={node.id} onSelect={() => selectNode(node)}>
          <FileText className="mr-2 h-4 w-4" />
          {node.title}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### Avatar

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

<Avatar>
  <AvatarImage src={user.avatarUrl} alt={user.name} />
  <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
</Avatar>
```

### Badge

```tsx
import { Badge } from '@/components/ui/badge';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outlined</Badge>
```

### Card

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Project Name</CardTitle>
    <CardDescription>Project description here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Tabs

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="details" className="w-full">
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="execution">Execution</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="details">
    <NodeDetails node={node} />
  </TabsContent>
  <TabsContent value="execution">
    <ExecutionPanel nodeId={node.id} />
  </TabsContent>
  <TabsContent value="history">
    <VersionHistory nodeId={node.id} />
  </TabsContent>
</Tabs>
```

---

## Layout Components

### AppShell

**Location:** `apps/web/src/components/layout/app-shell.tsx`

The main application layout wrapper.

```typescript
interface AppShellProps {
  children: React.ReactNode;
}
```

```tsx
<AppShell>
  <Header />
  <div className="flex">
    <Sidebar />
    <MainContent>
      {children}
    </MainContent>
  </div>
</AppShell>
```

#### Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                           Header                                 │
│  [Logo]  [Breadcrumbs...]           [Search] [Notif] [Avatar]  │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│   Sidebar    │              Main Content                        │
│              │                                                   │
│  [Org Switch]│  ┌────────────────────────────────────────────┐ │
│              │  │                                             │ │
│  [Projects]  │  │         View (Tree/Canvas/Graph/Grid)      │ │
│  - Project 1 │  │                                             │ │
│  - Project 2 │  │                                             │ │
│              │  │                                             │ │
│  [Create +]  │  └────────────────────────────────────────────┘ │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

### Header

**Location:** `apps/web/src/components/layout/header.tsx`

Top navigation bar with search, notifications, and user menu.

```typescript
interface HeaderProps {
  className?: string;
}
```

```tsx
function Header({ className }: HeaderProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <header className={cn('h-14 border-b flex items-center px-4', className)}>
      <Logo />
      <Breadcrumbs className="ml-4" />
      <div className="ml-auto flex items-center gap-2">
        <SearchButton />
        <NotificationBell count={unreadCount} />
        <ConnectionStatus />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
```

### Sidebar

**Location:** `apps/web/src/components/layout/sidebar.tsx`

Collapsible navigation sidebar.

```typescript
interface SidebarProps {
  className?: string;
}
```

Features:
- Organization switcher at top
- Project list
- Collapsible (toggle or keyboard shortcut)
- Active project highlight

```tsx
function Sidebar({ className }: SidebarProps) {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { currentOrgId } = useAppStore();
  const { data: projects } = useProjects(currentOrgId);

  return (
    <aside className={cn(
      'border-r transition-all',
      sidebarOpen ? 'w-64' : 'w-16',
      className
    )}>
      <OrgSwitcher />
      <Separator />
      <ProjectList projects={projects?.data || []} />
      <CreateProjectButton />
    </aside>
  );
}
```

### ViewSwitcher

**Location:** `apps/web/src/components/layout/view-switcher.tsx`

Toggles between tree, canvas, graph, and grid views.

```typescript
type ViewMode = 'tree' | 'canvas' | 'graph' | 'grid';

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}
```

```tsx
function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className="flex border rounded-md">
      <Button
        variant={value === 'tree' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('tree')}
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        variant={value === 'canvas' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('canvas')}
      >
        <LayoutGrid className="w-4 h-4" />
      </Button>
      <Button
        variant={value === 'graph' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('graph')}
      >
        <Network className="w-4 h-4" />
      </Button>
      <Button
        variant={value === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('grid')}
      >
        <Grid className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

---

## Canvas Components

### CanvasView

**Location:** `apps/web/src/components/canvas/canvas-view.tsx`

ReactFlow-based node graph editor.

```typescript
interface CanvasViewProps {
  projectId: string;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
}
```

```tsx
function CanvasView({ projectId, selectedNodeId, onNodeSelect }: CanvasViewProps) {
  const { data } = useNodes(projectId);
  const { nodes, edges } = useCanvasLayout(data?.data || []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => onNodeSelect(node.id)}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
      <CanvasToolbar />
    </ReactFlow>
  );
}
```

### CustomNode

**Location:** `apps/web/src/components/canvas/custom-node.tsx`

Custom ReactFlow node component.

```typescript
interface CustomNodeData {
  node: Node;
  isSelected: boolean;
}
```

```tsx
function CustomNode({ data }: NodeProps<CustomNodeData>) {
  const { node, isSelected } = data;

  return (
    <div className={cn(
      'px-4 py-2 rounded-lg border-2 bg-white shadow-sm min-w-[180px]',
      isSelected ? 'border-blue-500' : 'border-gray-200',
      node.status === 'completed' && 'border-green-500',
      node.status === 'in_progress' && 'border-yellow-500'
    )}>
      <div className="flex items-center gap-2">
        <NodeStatusBadge status={node.status} />
        <span className="font-medium truncate">{node.title}</span>
      </div>
      <div className="text-sm text-gray-500 mt-1 truncate">
        {node.description}
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### CanvasToolbar

**Location:** `apps/web/src/components/canvas/canvas-toolbar.tsx`

Toolbar for canvas controls.

```tsx
function CanvasToolbar() {
  const { showGrid, setShowGrid, snapToGrid, setSnapToGrid } = useCanvasStore();
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="top-right" className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => zoomIn()}>
        <ZoomIn className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => zoomOut()}>
        <ZoomOut className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => fitView()}>
        <Maximize className="w-4 h-4" />
      </Button>
      <Separator orientation="vertical" />
      <Toggle pressed={showGrid} onPressedChange={setShowGrid}>
        <Grid className="w-4 h-4" />
      </Toggle>
      <Toggle pressed={snapToGrid} onPressedChange={setSnapToGrid}>
        <Crosshair className="w-4 h-4" />
      </Toggle>
    </Panel>
  );
}
```

---

## Node Components

### NodeCard

**Location:** `apps/web/src/components/node/node-card.tsx`

Compact node representation for lists and grids.

```typescript
interface NodeCardProps {
  node: Node;
  onClick?: () => void;
  isSelected?: boolean;
}
```

```tsx
function NodeCard({ node, onClick, isSelected }: NodeCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <NodeStatusBadge status={node.status} />
          <NodeAuthorBadge authorType={node.authorType} />
        </div>
        <CardTitle className="text-base">{node.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {node.description}
        </p>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Updated {formatRelative(node.updatedAt)}
      </CardFooter>
    </Card>
  );
}
```

### NodeDetailPanel

**Location:** `apps/web/src/components/node/node-detail-panel.tsx`

Right-side panel showing full node details.

```typescript
interface NodeDetailPanelProps {
  nodeId: string;
  onClose: () => void;
}
```

```tsx
function NodeDetailPanel({ nodeId, onClose }: NodeDetailPanelProps) {
  const { data: node, isLoading } = useNode(nodeId);
  const { viewers, editors } = useNodePresence(nodeId);

  if (isLoading) return <Skeleton />;
  if (!node) return null;

  return (
    <div className="w-96 border-l bg-white overflow-y-auto">
      <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
        <h2 className="font-semibold truncate">{node.title}</h2>
        <div className="flex items-center gap-2">
          <PresenceAvatars users={[...editors, ...viewers]} />
          <LockIndicator nodeId={nodeId} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="execution" className="flex-1">Execution</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="p-4">
          <NodeDetails node={node} />
        </TabsContent>
        <TabsContent value="execution" className="p-4">
          <ExecutionPanel nodeId={nodeId} />
        </TabsContent>
        <TabsContent value="history" className="p-4">
          <VersionHistory nodeId={nodeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### NodeStatusBadge

**Location:** `apps/web/src/components/node/node-status-badge.tsx`

Visual status indicator.

```typescript
type NodeStatus = 'draft' | 'in_progress' | 'review' | 'completed';

interface NodeStatusBadgeProps {
  status: NodeStatus;
}
```

```tsx
const statusConfig: Record<NodeStatus, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  review: { label: 'Review', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
};

function NodeStatusBadge({ status }: NodeStatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

### NodeForm

**Location:** `apps/web/src/components/node/node-form.tsx`

Create/edit form for nodes.

```typescript
interface NodeFormProps {
  initialValues?: Partial<Node>;
  onSubmit: (data: CreateNodeRequest | UpdateNodeRequest) => Promise<void>;
  isLoading?: boolean;
}
```

```tsx
function NodeForm({ initialValues, onSubmit, isLoading }: NodeFormProps) {
  const form = useForm({
    defaultValues: {
      title: initialValues?.title || '',
      description: initialValues?.description || '',
      status: initialValues?.status || 'draft',
      authorType: initialValues?.authorType || 'human',
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register('title', { required: true })} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...form.register('description')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <Select {...form.register('status')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Author Type</Label>
          <Select {...form.register('authorType')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="human">Human</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
```

---

## Agent Execution Components

### ExecutionPanel

**Location:** `apps/web/src/components/agent/execution-panel.tsx`

Main panel for managing agent execution.

```typescript
interface ExecutionPanelProps {
  nodeId: string;
}
```

```tsx
function ExecutionPanel({ nodeId }: ExecutionPanelProps) {
  const {
    execution,
    isRunning,
    isPaused,
    progress,
    trace,
    start,
    pause,
    resume,
    cancel,
    pendingHITL,
    respondToHITL,
  } = useExecution(nodeId);

  return (
    <div className="space-y-4">
      <ExecutionControls
        isRunning={isRunning}
        isPaused={isPaused}
        onStart={() => start()}
        onPause={pause}
        onResume={resume}
        onCancel={cancel}
      />

      {progress && (
        <ExecutionProgress
          percentage={progress.percentage}
          currentStep={progress.currentStep}
        />
      )}

      <TraceTimeline events={trace} />

      {pendingHITL && (
        <HITLModal
          request={pendingHITL}
          onSubmit={respondToHITL}
          onCancel={() => cancel()}
        />
      )}
    </div>
  );
}
```

### ExecutionControls

**Location:** `apps/web/src/components/agent/execution-controls.tsx`

Start/pause/resume/cancel buttons.

```typescript
interface ExecutionControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}
```

```tsx
function ExecutionControls({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onCancel,
}: ExecutionControlsProps) {
  if (!isRunning) {
    return (
      <Button onClick={onStart}>
        <Play className="w-4 h-4 mr-2" />
        Start Execution
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      {isPaused ? (
        <Button onClick={onResume}>
          <Play className="w-4 h-4 mr-2" />
          Resume
        </Button>
      ) : (
        <Button variant="outline" onClick={onPause}>
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      )}
      <Button variant="destructive" onClick={onCancel}>
        <Square className="w-4 h-4 mr-2" />
        Cancel
      </Button>
    </div>
  );
}
```

### TraceTimeline

**Location:** `apps/web/src/components/agent/trace-timeline.tsx`

Visual timeline of execution events.

```typescript
interface TraceTimelineProps {
  events: TraceEvent[];
}
```

```tsx
function TraceTimeline({ events }: TraceTimelineProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium">Execution Trace</h4>
      <ScrollArea className="h-64">
        <div className="space-y-1">
          {events.map((event, i) => (
            <TraceEvent key={i} event={event} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function TraceEvent({ event }: { event: TraceEvent }) {
  const icons: Record<string, React.ReactNode> = {
    tool_call: <Wrench className="w-4 h-4" />,
    thinking: <Brain className="w-4 h-4" />,
    output: <MessageSquare className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-gray-50">
      {icons[event.type] || <Circle className="w-4 h-4" />}
      <div>
        <span className="text-sm font-medium">{event.type}</span>
        <p className="text-sm text-muted-foreground">{event.content}</p>
        <span className="text-xs text-gray-400">
          {formatTime(event.timestamp)}
        </span>
      </div>
    </div>
  );
}
```

### HITLModal

**Location:** `apps/web/src/components/agent/hitl-modal.tsx`

Human-in-the-loop intervention dialog.

```typescript
interface HITLModalProps {
  request: HITLRequest;
  onSubmit: (response: HITLResponse) => void;
  onCancel: () => void;
}
```

```tsx
function HITLModal({ request, onSubmit, onCancel }: HITLModalProps) {
  const [input, setInput] = useState('');

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent Needs Input</DialogTitle>
          <DialogDescription>{request.prompt}</DialogDescription>
        </DialogHeader>

        {request.type === 'input' && (
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your response..."
          />
        )}

        {request.type === 'approval' && request.options && (
          <div className="flex gap-2">
            {request.options.map((option) => (
              <Button
                key={option}
                variant={option === 'Approve' ? 'default' : 'outline'}
                onClick={() => onSubmit({ requestId: request.id, value: option })}
              >
                {option}
              </Button>
            ))}
          </div>
        )}

        {request.type === 'input' && (
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onSubmit({ requestId: request.id, value: input })}>
              Submit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Presence Components

### PresenceAvatars

**Location:** `apps/web/src/components/presence/presence-avatars.tsx`

Stack of user avatars showing who's viewing/editing.

```typescript
interface PresenceAvatarsProps {
  users: PresenceInfo[];
  max?: number;
}
```

```tsx
function PresenceAvatars({ users, max = 4 }: PresenceAvatarsProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((user) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger>
            <Avatar className={cn(
              'ring-2 ring-white',
              user.action === 'editing' && 'ring-green-500'
            )}>
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {user.name} ({user.action})
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-sm">
          +{overflow}
        </div>
      )}
    </div>
  );
}
```

---

## Search Components

### SearchCommand

**Location:** `apps/web/src/components/search/search-command.tsx`

Cmd+K command palette.

```typescript
interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

```tsx
function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const { currentOrgId } = useAppStore();
  const { query, setQuery, results, isSearching, clear } = useSearch(currentOrgId);
  const router = useRouter();

  const handleSelect = (result: SearchResult) => {
    clear();
    onOpenChange(false);
    if (result.type === 'node') {
      router.push(`/projects/${result.projectId}?node=${result.id}`);
    } else if (result.type === 'project') {
      router.push(`/projects/${result.id}`);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search nodes, projects..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isSearching && <CommandLoading>Searching...</CommandLoading>}
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Results">
          {results.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              onSelect={() => handleSelect(result)}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

### SearchResultItem

**Location:** `apps/web/src/components/search/search-result-item.tsx`

Individual search result row.

```tsx
function SearchResultItem({ result, onSelect }: SearchResultItemProps) {
  const icons: Record<SearchResultType, React.ReactNode> = {
    node: <FileText className="w-4 h-4" />,
    project: <Folder className="w-4 h-4" />,
  };

  return (
    <CommandItem onSelect={onSelect}>
      {icons[result.type]}
      <span className="ml-2">{result.title}</span>
      {result.type === 'node' && (
        <span className="ml-auto text-xs text-muted-foreground">
          in {result.projectName}
        </span>
      )}
    </CommandItem>
  );
}
```

---

## Notification Components

### NotificationBell

**Location:** `apps/web/src/components/notifications/notification-bell.tsx`

Header icon with unread count badge.

```tsx
function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
```

### NotificationPanel

**Location:** `apps/web/src/components/notifications/notification-panel.tsx`

Dropdown panel showing notifications.

```tsx
function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotifications();

  return (
    <div>
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="font-semibold">Notifications</h4>
        <Button variant="ghost" size="sm" onClick={markAllAsRead}>
          Mark all read
        </Button>
      </div>
      <ScrollArea className="h-72">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={() => markAsRead(n.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
```

---

## Common Components

### LoadingSpinner

```tsx
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
```

### EmptyState

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="font-medium">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

### ConfirmDialog

```tsx
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === 'destructive' ? 'bg-red-600' : ''}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Best Practices

### 1. Use Composition

```tsx
// Compose smaller components
<NodeCard>
  <NodeCard.Header>
    <NodeStatusBadge status={node.status} />
  </NodeCard.Header>
  <NodeCard.Content>{node.description}</NodeCard.Content>
</NodeCard>
```

### 2. Forward Refs

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants(), className)} {...props} />
  )
);
```

### 3. Use cn() for Conditional Classes

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'danger' && 'danger-class'
)} />
```

### 4. Memoize Expensive Components

```tsx
const MemoizedNodeCard = React.memo(NodeCard, (prev, next) => {
  return prev.node.id === next.node.id && prev.node.updatedAt === next.node.updatedAt;
});
```

### 5. Handle Loading States

```tsx
function NodeList({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useNodes(projectId);

  if (isLoading) return <NodeListSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!data?.data.length) return <EmptyState title="No nodes yet" />;

  return <ul>{data.data.map(node => <NodeCard key={node.id} node={node} />)}</ul>;
}
```

