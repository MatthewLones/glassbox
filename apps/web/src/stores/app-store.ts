import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, Project, Node, User } from '@glassbox/shared-types';

interface AppState {
  // Current user
  user: User | null;
  setUser: (user: User | null) => void;

  // Current organization (ID persisted, full object fetched separately)
  currentOrgId: string;
  setCurrentOrgId: (orgId: string) => void;
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;

  // Current project (ID persisted, full object fetched separately)
  currentProjectId: string;
  setCurrentProjectId: (projectId: string) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Selected node
  selectedNodeId: string;
  setSelectedNodeId: (nodeId: string) => void;
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // View mode
  viewMode: 'tree' | 'canvas' | 'graph' | 'grid';
  setViewMode: (mode: 'tree' | 'canvas' | 'graph' | 'grid') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),

      // Organization
      currentOrgId: '',
      setCurrentOrgId: (currentOrgId) => set({ currentOrgId, currentOrg: null }),
      currentOrg: null,
      setCurrentOrg: (currentOrg) => set({ currentOrg }),

      // Project
      currentProjectId: '',
      setCurrentProjectId: (currentProjectId) => set({ currentProjectId, currentProject: null }),
      currentProject: null,
      setCurrentProject: (currentProject) => set({ currentProject }),

      // Selected node
      selectedNodeId: '',
      setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId, selectedNode: null }),
      selectedNode: null,
      setSelectedNode: (selectedNode) => set({ selectedNode }),

      // UI state
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // View mode
      viewMode: 'tree',
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'glassbox-app-state',
      partialize: (state) => ({
        currentOrgId: state.currentOrgId,
        currentProjectId: state.currentProjectId,
        sidebarOpen: state.sidebarOpen,
        viewMode: state.viewMode,
      }),
    }
  )
);
