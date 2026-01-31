'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import type { Node } from '@glassbox/shared-types';

interface SearchResult {
  id: string;
  type: 'node' | 'project' | 'file';
  title: string;
  description?: string;
  status?: string;
  authorType?: 'human' | 'agent';
  projectId?: string;
  projectName?: string;
  matchedField?: string;
  score?: number;
}

interface UseSearchOptions {
  types?: ('node' | 'project' | 'file')[];
  semantic?: boolean;
  limit?: number;
  debounceMs?: number;
}

interface UseSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  recentItems: SearchResult[];
  clearQuery: () => void;
}

// Store recent items in localStorage
const RECENT_ITEMS_KEY = 'glassbox:recent-search-items';
const MAX_RECENT_ITEMS = 5;

function getRecentItems(): SearchResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_ITEMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentItem(item: SearchResult): void {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentItems().filter((r) => r.id !== item.id);
    recent.unshift(item);
    localStorage.setItem(
      RECENT_ITEMS_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_ITEMS))
    );
  } catch {
    // Ignore localStorage errors
  }
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const {
    types = ['node'],
    semantic = false,
    limit = 10,
    debounceMs = 300,
  } = options;

  const { currentOrgId } = useAppStore();
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [recentItems, setRecentItems] = React.useState<SearchResult[]>([]);

  // Load recent items on mount
  React.useEffect(() => {
    setRecentItems(getRecentItems());
  }, []);

  // Debounce the query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Search query
  const searchQuery = useQuery({
    queryKey: ['search', currentOrgId, debouncedQuery, types, semantic],
    queryFn: async () => {
      if (!currentOrgId || !debouncedQuery.trim()) {
        return [];
      }

      const searchFn = semantic ? api.search.semantic : api.search.search;
      const response = await searchFn(currentOrgId, debouncedQuery, types);

      // Transform API response to SearchResult format
      const results: SearchResult[] = (response.data || []).map((item: unknown) => {
        // Type guard for node-like items
        const nodeItem = item as Partial<Node> & { type?: string; name?: string; projectName?: string };
        return {
          id: nodeItem.id || '',
          type: (nodeItem.type as SearchResult['type']) || 'node',
          title: nodeItem.title || nodeItem.name || 'Untitled',
          description: nodeItem.description,
          status: nodeItem.status,
          authorType: nodeItem.authorType,
          projectId: nodeItem.projectId,
          projectName: nodeItem.projectName,
        };
      });

      return results.slice(0, limit);
    },
    enabled: !!currentOrgId && debouncedQuery.trim().length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  const clearQuery = React.useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results: searchQuery.data || [],
    isLoading: searchQuery.isLoading,
    isError: searchQuery.isError,
    error: searchQuery.error,
    recentItems,
    clearQuery,
  };
}

// Hook to track item selection and update recent items
export function useSearchNavigation() {
  const onSelectItem = React.useCallback((item: SearchResult) => {
    addRecentItem(item);
  }, []);

  return { onSelectItem };
}

// Keyboard shortcut hook for opening search
export function useSearchShortcut(onOpen: () => void) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
