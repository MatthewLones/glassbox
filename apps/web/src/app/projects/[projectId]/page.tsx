'use client';

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Plus, Settings } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeView } from '@/components/tree/tree-view';
import { NodeDetailPanel } from '@/components/node/node-detail-panel';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { CreateOrgDialog } from '@/components/organization/create-org-dialog';
import { OrgSettingsDialog } from '@/components/organization/org-settings-dialog';
import {
  CreateNodeForm,
  EditNodeForm,
  AddEvidenceForm,
  AddInputForm,
  AddOutputForm,
} from '@/components/node/forms';
import { DeleteNodeDialog } from '@/components/node/delete-node-dialog';
import { VersionHistoryPanel, type NodeVersion } from '@/components/node/version-history-panel';
import { VersionDiffViewer } from '@/components/node/version-diff-viewer';
import { CanvasProvider } from '@/components/canvas/canvas-provider';
import { CanvasView } from '@/components/canvas/canvas-view';
import { GraphView } from '@/components/graph/graph-view';
import { GridView } from '@/components/grid/grid-view';
import { ViewSwitcher, type ViewMode } from '@/components/navigation/view-switcher';
import { useProject } from '@/hooks/use-projects';
import { useNodes, useDeleteNode } from '@/hooks/use-nodes';
import { useAppStore } from '@/stores/app-store';
import { toast } from 'sonner';
import { useExecution } from '@/hooks/use-execution';
import { HITLModal, HITLNotificationButton, ExecutionPanel } from '@/components/agent';
import { ConnectionStatusDot } from '@/components/websocket';
import { useProjectSubscription, useNodePresence, useNodeLock } from '@/lib/websocket';
import type { Node } from '@glassbox/shared-types';

// Mock data for development/demo
const MOCK_NODES: Node[] = [
  {
    id: 'node-1',
    orgId: 'org-1',
    projectId: 'project-1',
    title: 'Q4 Planning Document',
    description: 'Main planning document for Q4 initiatives. Contains high-level goals and strategy.',
    status: 'in_progress',
    authorType: 'human',
    version: 3,
    metadata: { tags: ['planning', 'q4'], priority: 'high' },
    position: { x: 100, y: 100 },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    inputs: [
      { id: 'input-1', nodeId: 'node-1', inputType: 'file', label: 'Q3 Report.pdf', sortOrder: 0, metadata: {}, createdAt: '2024-01-15T10:00:00Z' },
      { id: 'input-2', nodeId: 'node-1', inputType: 'external_link', externalUrl: 'https://docs.google.com/spreadsheet', label: 'Budget Spreadsheet', sortOrder: 1, metadata: {}, createdAt: '2024-01-15T10:00:00Z' },
    ],
    outputs: [
      { id: 'output-1', nodeId: 'node-1', outputType: 'text', textContent: 'Strategic priorities identified...', label: 'Executive Summary', sortOrder: 0, metadata: {}, createdAt: '2024-01-18T10:00:00Z' },
    ],
  },
  {
    id: 'node-2',
    orgId: 'org-1',
    projectId: 'project-1',
    parentId: 'node-1',
    title: 'Market Research Analysis',
    description: 'Agent-driven analysis of competitor landscape and market trends.',
    status: 'complete',
    authorType: 'agent',
    version: 2,
    metadata: { tags: ['research', 'analysis'] },
    position: { x: 450, y: 50 },
    createdAt: '2024-01-16T09:00:00Z',
    updatedAt: '2024-01-17T16:00:00Z',
    inputs: [
      { id: 'input-3', nodeId: 'node-2', inputType: 'node_reference', sourceNodeId: 'node-1', label: 'Parent context', sortOrder: 0, metadata: {}, createdAt: '2024-01-16T09:00:00Z' },
    ],
    outputs: [
      { id: 'output-2', nodeId: 'node-2', outputType: 'structured_data', label: 'Competitor Matrix', sortOrder: 0, metadata: {}, createdAt: '2024-01-17T16:00:00Z' },
      { id: 'output-3', nodeId: 'node-2', outputType: 'file', label: 'Full Report.pdf', sortOrder: 1, metadata: {}, createdAt: '2024-01-17T16:00:00Z' },
    ],
  },
  {
    id: 'node-3',
    orgId: 'org-1',
    projectId: 'project-1',
    parentId: 'node-1',
    title: 'Budget Allocation',
    description: 'Detailed budget breakdown for Q4 initiatives.',
    status: 'review',
    authorType: 'human',
    version: 5,
    metadata: { tags: ['budget', 'finance'], priority: 'high' },
    position: { x: 450, y: 220 },
    createdAt: '2024-01-17T11:00:00Z',
    updatedAt: '2024-01-21T09:00:00Z',
    inputs: [],
    outputs: [],
  },
  {
    id: 'node-4',
    orgId: 'org-1',
    projectId: 'project-1',
    parentId: 'node-2',
    title: 'Competitor Deep Dive: Acme Corp',
    description: 'Detailed analysis of Acme Corp positioning and strategy.',
    status: 'complete',
    authorType: 'agent',
    version: 1,
    metadata: { tags: ['competitor'] },
    position: { x: 800, y: 50 },
    createdAt: '2024-01-16T14:00:00Z',
    updatedAt: '2024-01-16T18:00:00Z',
    inputs: [],
    outputs: [
      { id: 'output-4', nodeId: 'node-4', outputType: 'text', textContent: 'Acme Corp is positioned as...', label: 'Analysis', sortOrder: 0, metadata: {}, createdAt: '2024-01-16T18:00:00Z' },
    ],
  },
  {
    id: 'node-5',
    orgId: 'org-1',
    projectId: 'project-1',
    title: 'Product Roadmap',
    description: 'Technical roadmap for product development.',
    status: 'draft',
    authorType: 'human',
    version: 1,
    metadata: { tags: ['product', 'roadmap'] },
    position: { x: 100, y: 350 },
    createdAt: '2024-01-18T10:00:00Z',
    updatedAt: '2024-01-18T10:00:00Z',
    inputs: [],
    outputs: [],
  },
  {
    id: 'node-6',
    orgId: 'org-1',
    projectId: 'project-1',
    parentId: 'node-5',
    title: 'Feature Prioritization',
    description: 'Agent analysis of feature requests and prioritization.',
    status: 'in_progress',
    authorType: 'agent',
    version: 1,
    metadata: { tags: ['features'] },
    position: { x: 450, y: 350 },
    createdAt: '2024-01-19T08:00:00Z',
    updatedAt: '2024-01-19T12:00:00Z',
    inputs: [],
    outputs: [],
  },
];

function ProjectContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // View mode from URL or default to tree
  const viewModeParam = searchParams.get('view') as ViewMode | null;
  const viewMode: ViewMode = viewModeParam && ['tree', 'canvas', 'graph', 'grid'].includes(viewModeParam)
    ? viewModeParam
    : 'tree';

  const setViewMode = React.useCallback((mode: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const { currentOrgId, selectedNodeId, setSelectedNodeId } = useAppStore();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: nodesData, isLoading: nodesLoading } = useNodes(projectId);

  // Use mock data if no real data
  const realNodes = nodesData?.data || [];
  const nodes = realNodes.length > 0 ? realNodes : MOCK_NODES;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Get child nodes for the selected node
  const childNodes = React.useMemo(() => {
    if (!selectedNode) return [];
    return nodes.filter((n) => n.parentId === selectedNode.id);
  }, [selectedNode, nodes]);

  // Dialog states
  const [showCreateOrg, setShowCreateOrg] = React.useState(false);
  const [showOrgSettings, setShowOrgSettings] = React.useState(false);
  const [nodeToDelete, setNodeToDelete] = React.useState<Node | null>(null);
  const [showCreateNode, setShowCreateNode] = React.useState(false);
  const [createNodeParentId, setCreateNodeParentId] = React.useState<string | undefined>();
  const [nodeToEdit, setNodeToEdit] = React.useState<Node | null>(null);
  const [showAddEvidence, setShowAddEvidence] = React.useState(false);
  const [showAddInput, setShowAddInput] = React.useState(false);
  const [showAddOutput, setShowAddOutput] = React.useState(false);
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [diffVersions, setDiffVersions] = React.useState<{
    a: NodeVersion | null;
    b: NodeVersion | null;
  }>({ a: null, b: null });
  const [showHITLModal, setShowHITLModal] = React.useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = React.useState(false);

  // Execution hook
  const {
    hitlRequests,
    startExecution,
    isNodeExecuting,
  } = useExecution();

  // WebSocket hooks for real-time updates
  useProjectSubscription(projectId, {
    onNodeCreated: (node) => {
      toast.info(`New node created: ${node.title}`);
      // React Query will handle cache invalidation
    },
    onNodeUpdated: (nodeId, changes) => {
      // React Query will handle cache invalidation
    },
    onNodeDeleted: (nodeId) => {
      if (selectedNodeId === nodeId) {
        setSelectedNodeId('');
      }
    },
  });

  // Presence and lock for selected node
  const { users: presenceUsers, updatePresence } = useNodePresence(selectedNodeId || undefined);
  const { isLocked, lockHolder, isLockHeldByMe } = useNodeLock(selectedNodeId || undefined);

  // Update presence when node is selected
  React.useEffect(() => {
    if (selectedNodeId) {
      updatePresence('viewing');
    }
  }, [selectedNodeId, updatePresence]);

  // Delete mutation
  const deleteNode = useDeleteNode(nodeToDelete?.id || '');

  // Mock version history for demo
  const mockVersions: NodeVersion[] = selectedNode
    ? [
        {
          id: 'v3',
          version: selectedNode.version,
          title: selectedNode.title,
          description: selectedNode.description,
          status: selectedNode.status,
          authorType: selectedNode.authorType,
          createdAt: selectedNode.updatedAt,
          changeType: 'updated',
          changes: [{ field: 'status', oldValue: 'draft', newValue: selectedNode.status }],
        },
        {
          id: 'v2',
          version: selectedNode.version - 1,
          title: selectedNode.title,
          status: 'draft',
          authorType: 'human',
          createdAt: selectedNode.createdAt,
          changeType: 'updated',
          changes: [{ field: 'description', newValue: selectedNode.description }],
        },
        {
          id: 'v1',
          version: 1,
          title: selectedNode.title,
          status: 'draft',
          authorType: selectedNode.authorType,
          createdAt: selectedNode.createdAt,
          changeType: 'created',
        },
      ]
    : [];

  // Count children for delete warning
  const getChildCount = React.useCallback(
    (nodeId: string): number => {
      const directChildren = nodes.filter((n) => n.parentId === nodeId);
      return directChildren.reduce(
        (count, child) => count + 1 + getChildCount(child.id),
        0
      );
    },
    [nodes]
  );

  function handleSelectNode(node: Node) {
    setSelectedNodeId(node.id);
  }

  function handleCloseDetail() {
    setSelectedNodeId('');
  }

  function handleEditNode(node: Node) {
    setNodeToEdit(node);
  }

  function handleAddChild(parentNode: Node | null) {
    setCreateNodeParentId(parentNode?.id);
    setShowCreateNode(true);
  }

  async function handleExecuteNode(node: Node) {
    if (node.authorType !== 'agent') {
      toast.error('Only agent-authored nodes can be executed');
      return;
    }

    if (isNodeExecuting(node.id)) {
      setShowExecutionPanel(true);
      return;
    }

    try {
      await startExecution(node.id);
      setShowExecutionPanel(true);
      toast.success('Execution started');
    } catch (error) {
      console.error('Failed to start execution:', error);
      toast.error('Failed to start execution');
    }
  }

  function handleAddEvidence() {
    if (selectedNode) {
      setShowAddEvidence(true);
    }
  }

  function handleAddInput() {
    if (selectedNode) {
      setShowAddInput(true);
    }
  }

  function handleAddOutput() {
    if (selectedNode) {
      setShowAddOutput(true);
    }
  }

  function handleShowVersionHistory() {
    if (selectedNode) {
      setShowVersionHistory(true);
    }
  }

  function handleViewDiff(versionA: NodeVersion, versionB: NodeVersion) {
    setDiffVersions({ a: versionA, b: versionB });
  }

  async function handleDeleteNode(nodeId: string) {
    try {
      await deleteNode.mutateAsync();
      if (selectedNodeId === nodeId) {
        setSelectedNodeId('');
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async function handleRevertVersion(versionId: string) {
    // TODO: Call API to revert
    console.log('Reverting to version:', versionId);
  }

  function handlePositionChange(nodeId: string, position: { x: number; y: number }) {
    // TODO: Persist position to backend
    console.log('Position changed:', nodeId, position);
  }

  const isLoading = projectLoading || nodesLoading;

  return (
    <AppShell
      onCreateOrgClick={() => setShowCreateOrg(true)}
      onOrgSettingsClick={() => setShowOrgSettings(true)}
    >
      <div className="flex h-screen overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            title={project?.name || 'Project'}
            actions={
              <div className="flex items-center gap-3">
                <ConnectionStatusDot />
                <HITLNotificationButton onClick={() => setShowHITLModal(true)} />
                <ViewSwitcher
                  value={viewMode}
                  onChange={setViewMode}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddChild(null)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Node
                </Button>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            }
          />

          {/* View content */}
          {viewMode === 'tree' && (
            <ScrollArea className="flex-1">
              <TreeView
                nodes={nodes}
                isLoading={isLoading}
                selectedId={selectedNodeId}
                onSelect={handleSelectNode}
                onEdit={handleEditNode}
                onDelete={(node) => setNodeToDelete(node)}
                onAddChild={handleAddChild}
                onExecute={handleExecuteNode}
                className="px-2"
              />
            </ScrollArea>
          )}

          {viewMode === 'canvas' && (
            <div className="flex-1 relative overflow-hidden">
              <CanvasProvider
                onNodeSelect={handleSelectNode}
                onNodeEdit={handleEditNode}
                onNodeDelete={(node) => setNodeToDelete(node)}
                onNodeAddChild={handleAddChild}
                onNodeExecute={handleExecuteNode}
                onPositionChange={handlePositionChange}
              >
                <CanvasView
                  nodes={nodes}
                  selectedNodeId={selectedNodeId}
                  className="absolute inset-0"
                />
              </CanvasProvider>
            </div>
          )}

          {viewMode === 'graph' && (
            <div className="flex-1 relative">
              <GraphView
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onNodeSelect={handleSelectNode}
                className="absolute inset-0"
              />
            </div>
          )}

          {viewMode === 'grid' && (
            <GridView
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleSelectNode}
              onNodeEdit={handleEditNode}
              onNodeDelete={(node) => setNodeToDelete(node)}
              onNodeExecute={handleExecuteNode}
              onAddNode={(parentId) => {
                const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null;
                handleAddChild(parentNode ?? null);
              }}
              className="flex-1"
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-96 shrink-0 border-l overflow-hidden z-10 bg-background">
            <NodeDetailPanel
              node={selectedNode}
              childNodes={childNodes}
              presenceUsers={presenceUsers}
              isLocked={isLocked}
              isLockHeldByMe={isLockHeldByMe}
              lockHolderEmail={lockHolder || undefined}
              onClose={handleCloseDetail}
              onEdit={() => handleEditNode(selectedNode)}
              onExecute={() => handleExecuteNode(selectedNode)}
              onSelectNode={handleSelectNode}
              onAddEvidence={handleAddEvidence}
              onViewVersionHistory={handleShowVersionHistory}
            />
          </div>
        )}
      </div>

      {/* Organization dialogs */}
      <CreateOrgDialog
        open={showCreateOrg}
        onOpenChange={setShowCreateOrg}
      />

      {currentOrgId && (
        <OrgSettingsDialog
          orgId={currentOrgId}
          open={showOrgSettings}
          onOpenChange={setShowOrgSettings}
        />
      )}

      {/* Node CRUD dialogs */}
      <CreateNodeForm
        projectId={projectId}
        parentId={createNodeParentId}
        open={showCreateNode}
        onOpenChange={(open) => {
          setShowCreateNode(open);
          if (!open) setCreateNodeParentId(undefined);
        }}
        onSuccess={(nodeId) => {
          setSelectedNodeId(nodeId);
        }}
      />

      {nodeToEdit && (
        <EditNodeForm
          node={nodeToEdit}
          open={!!nodeToEdit}
          onOpenChange={(open) => !open && setNodeToEdit(null)}
          onSuccess={() => setNodeToEdit(null)}
        />
      )}

      <DeleteNodeDialog
        node={nodeToDelete}
        childCount={nodeToDelete ? getChildCount(nodeToDelete.id) : 0}
        open={!!nodeToDelete}
        onOpenChange={(open) => !open && setNodeToDelete(null)}
        onConfirm={handleDeleteNode}
      />

      {/* Evidence and I/O dialogs */}
      {selectedNode && (
        <>
          <AddEvidenceForm
            nodeId={selectedNode.id}
            open={showAddEvidence}
            onOpenChange={setShowAddEvidence}
          />

          <AddInputForm
            nodeId={selectedNode.id}
            nodes={nodes}
            open={showAddInput}
            onOpenChange={setShowAddInput}
          />

          <AddOutputForm
            nodeId={selectedNode.id}
            nodes={nodes}
            open={showAddOutput}
            onOpenChange={setShowAddOutput}
          />

          <VersionHistoryPanel
            nodeId={selectedNode.id}
            currentVersion={selectedNode.version}
            versions={mockVersions}
            open={showVersionHistory}
            onOpenChange={setShowVersionHistory}
            onRevert={handleRevertVersion}
            onViewDiff={handleViewDiff}
          />

          <VersionDiffViewer
            open={!!diffVersions.a && !!diffVersions.b}
            onOpenChange={(open) => !open && setDiffVersions({ a: null, b: null })}
            versionA={diffVersions.a}
            versionB={diffVersions.b}
          />
        </>
      )}

      {/* HITL Modal */}
      <HITLModal
        open={showHITLModal}
        onOpenChange={setShowHITLModal}
      />

      {/* Execution Panel (as a slide-out or modal when needed) */}
      {showExecutionPanel && selectedNode && (
        <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-background border-l shadow-lg z-50">
          <ExecutionPanel
            node={selectedNode}
            onClose={() => setShowExecutionPanel(false)}
            onStartExecution={() => handleExecuteNode(selectedNode)}
            className="h-full"
          />
        </div>
      )}
    </AppShell>
  );
}

export default function ProjectPage() {
  return (
    <ProtectedRoute>
      <ProjectContent />
    </ProtectedRoute>
  );
}
