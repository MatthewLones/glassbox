# GlassBox V2 Frontend View Modes

This document covers the four visualization modes in GlassBox: Tree View, Canvas View, Graph View, and Grid View.

---

## Overview

GlassBox provides four ways to visualize and interact with nodes:

| View | Best For | Key Features |
|------|----------|--------------|
| **Tree** | Hierarchical navigation | Expand/collapse, context menus |
| **Canvas** | Visual editing (primary) | Drag-drop, connections, minimap |
| **Graph** | Dependencies | Force-directed layout, clustering |
| **Grid** | Quick browsing | Cards, sorting, filtering |

---

## View Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project Workspace                             │
│                                                                  │
│  ┌────────────────────────┐  ┌───────────────────────────────┐ │
│  │    View Switcher       │  │       View Container          │ │
│  │  [Tree][Canvas][Graph] │  │                               │ │
│  │       [Grid]           │  │  ┌─────────────────────────┐  │ │
│  └────────────────────────┘  │  │                         │  │ │
│                              │  │    Active View          │  │ │
│                              │  │    (Tree/Canvas/...)    │  │ │
│                              │  │                         │  │ │
│                              │  │                         │  │ │
│                              │  └─────────────────────────┘  │ │
│                              │                               │ │
│                              └───────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Node Detail Panel                        │  │
│  │  (Shared across all views, shows selected node)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## View Switching

### URL-Based Routing

View mode is stored in the URL query parameter:

```
/projects/abc123?view=tree     → Tree View
/projects/abc123?view=canvas   → Canvas View
/projects/abc123?view=graph    → Graph View
/projects/abc123?view=grid     → Grid View
```

### ViewSwitcher Component

**Location:** `apps/web/src/components/layout/view-switcher.tsx`

```tsx
function ViewSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'canvas';

  const setView = (view: ViewMode) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', view);
    router.push(`?${params.toString()}`);
  };

  return (
    <ToggleGroup type="single" value={currentView} onValueChange={setView}>
      <ToggleGroupItem value="tree" aria-label="Tree view">
        <List className="w-4 h-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="canvas" aria-label="Canvas view">
        <LayoutGrid className="w-4 h-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="graph" aria-label="Graph view">
        <Network className="w-4 h-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Grid view">
        <Grid className="w-4 h-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Switch to Tree View |
| `Cmd+2` | Switch to Canvas View |
| `Cmd+3` | Switch to Graph View |
| `Cmd+4` | Switch to Grid View |

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case '1': setView('tree'); break;
        case '2': setView('canvas'); break;
        case '3': setView('graph'); break;
        case '4': setView('grid'); break;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### View Container

**Location:** `apps/web/src/app/projects/[projectId]/page.tsx`

```tsx
function ProjectPage({ params }: { params: { projectId: string } }) {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'canvas';
  const { selectedNodeId, setSelectedNodeId } = useAppStore();

  const renderView = () => {
    switch (view) {
      case 'tree':
        return <TreeView projectId={params.projectId} onSelect={setSelectedNodeId} />;
      case 'canvas':
        return <CanvasView projectId={params.projectId} onSelect={setSelectedNodeId} />;
      case 'graph':
        return <GraphView projectId={params.projectId} onSelect={setSelectedNodeId} />;
      case 'grid':
        return <GridView projectId={params.projectId} onSelect={setSelectedNodeId} />;
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <ViewSwitcher />
        {renderView()}
      </div>
      {selectedNodeId && (
        <NodeDetailPanel nodeId={selectedNodeId} onClose={() => setSelectedNodeId('')} />
      )}
    </div>
  );
}
```

---

## Tree View

**Location:** `apps/web/src/components/tree/tree-view.tsx`

A hierarchical file-explorer style view.

### Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tree View                                │
│                                                                  │
│  ▼ Root Node                                                    │
│    ├─ ▼ Analysis Phase                                          │
│    │   ├─ Market Research                                       │
│    │   ├─ Competitor Analysis                                   │
│    │   └─ User Interviews                                       │
│    ├─ ▶ Planning Phase (collapsed)                              │
│    └─ ▼ Implementation                                          │
│        ├─ Backend Development                                   │
│        ├─ Frontend Development                                  │
│        └─ Testing                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface TreeViewProps {
  projectId: string;
  selectedNodeId?: string;
  onSelect: (nodeId: string) => void;
}
```

### Implementation

```tsx
function TreeView({ projectId, selectedNodeId, onSelect }: TreeViewProps) {
  const { data } = useNodes(projectId);
  const rootNodes = data?.data.filter(n => !n.parentId) || [];

  return (
    <div className="p-4">
      {rootNodes.map(node => (
        <TreeBranch
          key={node.id}
          node={node}
          allNodes={data?.data || []}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          level={0}
        />
      ))}
    </div>
  );
}
```

### TreeBranch Component

Recursive component for nested nodes.

```tsx
function TreeBranch({
  node,
  allNodes,
  selectedNodeId,
  onSelect,
  level,
}: TreeBranchProps) {
  const [expanded, setExpanded] = useState(true);
  const children = allNodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;

  return (
    <div style={{ marginLeft: level * 16 }}>
      <TreeNode
        node={node}
        isSelected={selectedNodeId === node.id}
        isExpanded={expanded}
        hasChildren={hasChildren}
        onSelect={() => onSelect(node.id)}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <TreeBranch
              key={child.id}
              node={child}
              allNodes={allNodes}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### TreeNode Component

Individual tree item.

```tsx
function TreeNode({
  node,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onToggle,
}: TreeNodeProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-100',
            isSelected && 'bg-blue-100'
          )}
          onClick={onSelect}
        >
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          <NodeStatusBadge status={node.status} size="sm" />
          <span className="truncate">{node.title}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Edit</ContextMenuItem>
        <ContextMenuItem>Add Child</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-red-600">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

### Features

- **Expand/Collapse**: Click chevron to toggle children
- **Selection**: Single-click to select, syncs with other views
- **Context Menu**: Right-click for actions
- **Keyboard Navigation**: Arrow keys to navigate
- **Drag-to-Reorder**: (Future) Drag nodes to reorder

---

## Canvas View

**Location:** `apps/web/src/components/canvas/canvas-view.tsx`

ReactFlow-based visual node editor. This is the **primary** view mode.

### Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Toolbar: Zoom | Grid | Snap | Fit]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│     ┌──────────────┐              ┌──────────────┐              │
│     │  Analysis    │──────────────▶│  Planning    │             │
│     │  [Draft]     │              │  [Progress]  │              │
│     └──────────────┘              └──────┬───────┘              │
│                                          │                       │
│                                          ▼                       │
│     ┌──────────────┐              ┌──────────────┐              │
│     │  Research    │              │  Implement   │              │
│     │  [Complete]  │              │  [Progress]  │              │
│     └──────────────┘              └──────────────┘              │
│                                                                  │
│                                                   ┌────────────┐│
│                                                   │  Minimap   ││
│                                                   └────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface CanvasViewProps {
  projectId: string;
  selectedNodeId?: string;
  onSelect: (nodeId: string) => void;
}
```

### Implementation

```tsx
function CanvasView({ projectId, selectedNodeId, onSelect }: CanvasViewProps) {
  const { data } = useNodes(projectId);
  const { showGrid, snapToGrid, showMinimap } = useCanvasStore();
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasLayout(data?.data || []);

  const nodeTypes = useMemo(() => ({
    glassbox: GlassboxNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    parentChild: ParentChildEdge,
    dependency: DependencyEdge,
  }), []);

  return (
    <ReactFlowProvider>
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => onSelect(node.id)}
          snapToGrid={snapToGrid}
          snapGrid={[15, 15]}
          fitView
        >
          {showGrid && <Background gap={15} />}
          <Controls />
          {showMinimap && <MiniMap />}
        </ReactFlow>
        <CanvasToolbar />
      </div>
    </ReactFlowProvider>
  );
}
```

### GlassboxNode Component

Custom node renderer.

```tsx
function GlassboxNode({ data, selected }: NodeProps<GlassboxNodeData>) {
  const { node } = data;

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className={cn(
        'min-w-[200px] p-3 rounded-lg border-2 bg-white shadow-sm transition-all',
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-200',
        node.authorType === 'agent' && 'border-l-4 border-l-purple-500'
      )}>
        <div className="flex items-center gap-2 mb-2">
          <NodeStatusBadge status={node.status} />
          <NodeAuthorBadge authorType={node.authorType} />
          <LockIndicator nodeId={node.id} />
        </div>
        <h3 className="font-medium truncate">{node.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {node.description}
        </p>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{formatRelative(node.updatedAt)}</span>
          <PresenceAvatars nodeId={node.id} size="xs" />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </>
  );
}
```

### Canvas Edges

**ParentChildEdge**: Solid line for parent-child relationships.

```tsx
function ParentChildEdge({ sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    borderRadius: 8,
  });

  return <path d={edgePath} stroke="#6b7280" strokeWidth={2} fill="none" style={style} />;
}
```

**DependencyEdge**: Dashed line for dependency relationships.

```tsx
function DependencyEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  return (
    <path
      d={edgePath}
      stroke="#9333ea"
      strokeWidth={2}
      strokeDasharray="5,5"
      fill="none"
    />
  );
}
```

### useCanvasLayout Hook

Converts node data to ReactFlow format.

```typescript
function useCanvasLayout(nodes: Node[]) {
  const [rfNodes, setRfNodes] = useState<RFNode[]>([]);
  const [rfEdges, setRfEdges] = useState<RFEdge[]>([]);

  useEffect(() => {
    // Convert nodes to ReactFlow nodes with positions
    const layoutedNodes = nodes.map((node, i) => ({
      id: node.id,
      type: 'glassbox',
      position: node.metadata?.position || { x: (i % 3) * 250, y: Math.floor(i / 3) * 150 },
      data: { node },
    }));

    // Create edges from parent relationships
    const parentEdges = nodes
      .filter(n => n.parentId)
      .map(n => ({
        id: `${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: 'parentChild',
      }));

    setRfNodes(layoutedNodes);
    setRfEdges(parentEdges);
  }, [nodes]);

  return { nodes: rfNodes, edges: rfEdges, ... };
}
```

### Features

- **Drag to Move**: Drag nodes to reposition
- **Connect Nodes**: Drag from handle to create edges
- **Zoom/Pan**: Mouse wheel or controls
- **Minimap**: Overview for navigation
- **Grid Snap**: Align nodes to grid
- **Position Persistence**: Positions saved to node metadata

---

## Graph View

**Location:** `apps/web/src/components/graph/graph-view.tsx`

D3 force-directed graph for visualizing dependencies.

### Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         Graph View                               │
│                                                                  │
│                    ┌─────┐                                      │
│                    │  A  │                                      │
│                   ╱       ╲                                     │
│                  ╱         ╲                                    │
│             ┌─────┐       ┌─────┐                               │
│             │  B  │───────│  C  │                               │
│             └─────┘       └─────┘                               │
│                  ╲         ╱                                    │
│                   ╲       ╱                                     │
│                    ┌─────┐                                      │
│                    │  D  │                                      │
│                    └─────┘                                      │
│                                                                  │
│  [Controls: Pause | Reset | Zoom +/-]                          │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```tsx
function GraphView({ projectId, selectedNodeId, onSelect }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { data } = useNodes(projectId);

  useEffect(() => {
    if (!svgRef.current || !data?.data) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Prepare data
    const nodes = data.data.map(n => ({ ...n }));
    const links = data.data
      .filter(n => n.parentId)
      .map(n => ({ source: n.parentId, target: n.id }));

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Draw links
    const link = svg.selectAll('.link')
      .data(links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2);

    // Draw nodes
    const node = svg.selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded)
      )
      .on('click', (_, d) => onSelect(d.id));

    node.append('circle')
      .attr('r', 30)
      .attr('fill', d => getStatusColor(d.status))
      .attr('stroke', d => d.id === selectedNodeId ? '#3b82f6' : 'none')
      .attr('stroke-width', 3);

    node.append('text')
      .text(d => d.title.slice(0, 10))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', 12);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [data, selectedNodeId]);

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      <GraphControls />
    </div>
  );
}
```

### Force Parameters

| Force | Purpose | Value |
|-------|---------|-------|
| `link` | Pull connected nodes | distance: 100 |
| `charge` | Push all nodes apart | strength: -300 |
| `center` | Keep graph centered | (width/2, height/2) |
| `collision` | Prevent overlap | radius: 50 |

### Features

- **Force-Directed Layout**: Nodes arrange themselves
- **Drag Nodes**: Move nodes, simulation adjusts
- **Highlight Dependencies**: Hover to highlight connected
- **Zoom/Pan**: Navigate large graphs
- **Pause Simulation**: Stop animation for inspection

---

## Grid View

**Location:** `apps/web/src/components/grid/grid-view.tsx`

Folder-style card layout for browsing.

### Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Sort: Name ▼]  [Filter: All Statuses ▼]                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │ ○ Draft    │  │ ● Progress │  │ ◉ Complete │  │ ○ Draft    ││
│  │            │  │            │  │            │  │            ││
│  │  Analysis  │  │  Planning  │  │  Research  │  │  Testing   ││
│  │            │  │            │  │            │  │            ││
│  │  2 children│  │  5 children│  │  0 children│  │  1 child   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                  │
│  ┌────────────┐  ┌────────────┐                                 │
│  │ ● Progress │  │ ◉ Complete │                                 │
│  │            │  │            │                                 │
│  │  Backend   │  │  Frontend  │                                 │
│  │            │  │            │                                 │
│  │  3 children│  │  2 children│                                 │
│  └────────────┘  └────────────┘                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface GridViewProps {
  projectId: string;
  selectedNodeId?: string;
  onSelect: (nodeId: string) => void;
}
```

### Implementation

```tsx
function GridView({ projectId, selectedNodeId, onSelect }: GridViewProps) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'title' | 'updatedAt' | 'status'>('updatedAt');
  const [filterStatus, setFilterStatus] = useState<NodeStatus | 'all'>('all');

  const { data } = useNodes(projectId, { parentId: parentId || undefined });

  const filteredNodes = useMemo(() => {
    let nodes = data?.data || [];
    if (filterStatus !== 'all') {
      nodes = nodes.filter(n => n.status === filterStatus);
    }
    return nodes.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'updatedAt') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return a.status.localeCompare(b.status);
    });
  }, [data, sortBy, filterStatus]);

  const handleDoubleClick = (node: Node) => {
    // Drill into folder (show children)
    setParentId(node.id);
  };

  return (
    <div className="p-4">
      <GridControls
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        parentId={parentId}
        onBack={() => setParentId(null)}
      />

      <div className="grid grid-cols-4 gap-4 mt-4">
        {filteredNodes.map(node => (
          <GridCard
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => handleDoubleClick(node)}
            childCount={data?.data.filter(n => n.parentId === node.id).length || 0}
          />
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <EmptyState
          title="No nodes here"
          description={parentId ? "This folder is empty" : "Create your first node"}
        />
      )}
    </div>
  );
}
```

### GridCard Component

```tsx
function GridCard({
  node,
  isSelected,
  onClick,
  onDoubleClick,
  childCount,
}: GridCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <CardHeader className="pb-2">
        <NodeStatusBadge status={node.status} />
      </CardHeader>
      <CardContent>
        <h3 className="font-medium truncate">{node.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {node.description}
        </p>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {childCount > 0 ? `${childCount} ${childCount === 1 ? 'child' : 'children'}` : 'No children'}
      </CardFooter>
    </Card>
  );
}
```

### Features

- **Card Layout**: Visual cards in a grid
- **Double-Click Drill Down**: Navigate into folders
- **Sorting**: By name, date, or status
- **Filtering**: By status
- **Breadcrumb Navigation**: Back button to parent

---

## Shared Features

### Node Selection Sync

All views share the same selection state:

```tsx
const { selectedNodeId, setSelectedNodeId } = useAppStore();

// In Tree View
<TreeNode onClick={() => setSelectedNodeId(node.id)} />

// In Canvas View
<ReactFlow onNodeClick={(_, node) => setSelectedNodeId(node.id)} />

// In Graph View
node.on('click', (_, d) => setSelectedNodeId(d.id));

// In Grid View
<GridCard onClick={() => setSelectedNodeId(node.id)} />
```

### Node Detail Panel

The right panel shows details for the selected node, regardless of view:

```tsx
{selectedNodeId && (
  <NodeDetailPanel
    nodeId={selectedNodeId}
    onClose={() => setSelectedNodeId('')}
  />
)}
```

### Context Menus

All views support right-click context menus:

```tsx
<ContextMenu>
  <ContextMenuTrigger>{nodeElement}</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => openEditDialog(node)}>
      <Pencil className="w-4 h-4 mr-2" /> Edit
    </ContextMenuItem>
    <ContextMenuItem onClick={() => createChild(node.id)}>
      <Plus className="w-4 h-4 mr-2" /> Add Child
    </ContextMenuItem>
    <ContextMenuItem onClick={() => startExecution(node.id)}>
      <Play className="w-4 h-4 mr-2" /> Execute
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => deleteNode(node.id)} className="text-red-600">
      <Trash className="w-4 h-4 mr-2" /> Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### Real-Time Updates

All views receive WebSocket updates for live changes:

```tsx
useProjectSubscription(projectId, {
  onNodeCreated: (node) => {
    // View re-renders with new node
  },
  onNodeUpdated: (nodeId, changes) => {
    // Node updates in place
  },
  onNodeDeleted: (nodeId) => {
    // Node removed from view
  },
});
```

---

## Performance Considerations

### Tree View

- **Virtualization**: For large trees, consider `react-virtual` for visible-only rendering
- **Lazy Loading**: Load children on expand instead of all at once

### Canvas View

- **Node Bundling**: ReactFlow handles this internally
- **Viewport Culling**: Only renders visible nodes
- **Edge Optimization**: Use simple edges for large graphs

### Graph View

- **Simulation Limits**: Cap simulation iterations
- **Level of Detail**: Simplify nodes when zoomed out
- **Canvas Rendering**: Consider switching from SVG to Canvas for 100+ nodes

### Grid View

- **Pagination**: Show 20-50 cards per page
- **Infinite Scroll**: Load more on scroll
- **Image Optimization**: Lazy load avatars/thumbnails

---

## Future Enhancements

### Tree View
- Drag-to-reorder nodes
- Multi-select with Shift+Click
- Inline rename (double-click)

### Canvas View
- Multiple selection
- Copy/paste nodes
- Auto-layout algorithms
- Zoom to selection

### Graph View
- Clustering for large graphs
- Highlight paths between nodes
- Animated transitions
- Custom force parameters

### Grid View
- Card size toggle (small/medium/large)
- List view option
- Bulk actions

