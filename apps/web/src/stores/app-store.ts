import { create } from 'zustand';
import type { Organization, Project, Node, User } from '@glassbox/shared-types';

interface AppState {
  // Current user
  user: User | null;
  setUser: (user: User | null) => void;

  // Current organization
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;

  // Current project
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Selected node
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // View mode
  viewMode: 'tree' | 'canvas' | 'graph';
  setViewMode: (mode: 'tree' | 'canvas' | 'graph') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Organization
  currentOrg: null,
  setCurrentOrg: (currentOrg) => set({ currentOrg }),

  // Project
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),

  // Selected node
  selectedNode: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),

  // UI state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // View mode
  viewMode: 'tree',
  setViewMode: (viewMode) => set({ viewMode }),
}));
