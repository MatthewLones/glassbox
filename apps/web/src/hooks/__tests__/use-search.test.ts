import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useSearch, useSearchShortcut, useSearchNavigation } from '../use-search';

// Mock the API
const mockSearchFn = vi.fn();
const mockSemanticFn = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    search: {
      search: (...args: unknown[]) => mockSearchFn(...args),
      semantic: (...args: unknown[]) => mockSemanticFn(...args),
    },
  },
}));

// Mock the app store
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({
    currentOrgId: 'org-1',
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockSearchFn.mockResolvedValue({ data: [] });
    mockSemanticFn.mockResolvedValue({ data: [] });
  });

  it('should initialize with empty query', () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: createWrapper(),
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should update query', async () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.query).toBe('test');
  });

  it('should not search with short query', async () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('t');
    });

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSearchFn).not.toHaveBeenCalled();
  });

  it('should search with valid query', async () => {
    mockSearchFn.mockResolvedValue({
      data: [
        { id: 'node-1', title: 'Test Node', type: 'node' },
      ],
    });

    const { result } = renderHook(() => useSearch({ debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test query');
    });

    await waitFor(() => {
      expect(mockSearchFn).toHaveBeenCalledWith('org-1', 'test query', ['node']);
    });
  });

  it('should use semantic search when enabled', async () => {
    mockSemanticFn.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSearch({ semantic: true, debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test query');
    });

    await waitFor(() => {
      expect(mockSemanticFn).toHaveBeenCalledWith('org-1', 'test query', ['node']);
    });
  });

  it('should clear query', async () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.query).toBe('test');

    act(() => {
      result.current.clearQuery();
    });

    expect(result.current.query).toBe('');
  });

  it('should transform API results to SearchResult format', async () => {
    mockSearchFn.mockResolvedValue({
      data: [
        {
          id: 'node-1',
          title: 'Test Node',
          description: 'A test node',
          status: 'in_progress',
          authorType: 'human',
          projectId: 'proj-1',
        },
      ],
    });

    const { result } = renderHook(() => useSearch({ debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test query');
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0]).toMatchObject({
        id: 'node-1',
        title: 'Test Node',
        description: 'A test node',
        status: 'in_progress',
        authorType: 'human',
        projectId: 'proj-1',
      });
    });
  });

  it('should limit results', async () => {
    mockSearchFn.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, i) => ({
        id: `node-${i}`,
        title: `Node ${i}`,
      })),
    });

    const { result } = renderHook(() => useSearch({ limit: 5, debounceMs: 0 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test query');
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(5);
    });
  });
});

describe('useSearchShortcut', () => {
  it('should call onOpen when Cmd+K is pressed', () => {
    const onOpen = vi.fn();

    renderHook(() => useSearchShortcut(onOpen));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });

    document.dispatchEvent(event);

    expect(onOpen).toHaveBeenCalled();
  });

  it('should call onOpen when Ctrl+K is pressed', () => {
    const onOpen = vi.fn();

    renderHook(() => useSearchShortcut(onOpen));

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });

    document.dispatchEvent(event);

    expect(onOpen).toHaveBeenCalled();
  });

  it('should not call onOpen for other keys', () => {
    const onOpen = vi.fn();

    renderHook(() => useSearchShortcut(onOpen));

    const event = new KeyboardEvent('keydown', {
      key: 'j',
      metaKey: true,
      bubbles: true,
    });

    document.dispatchEvent(event);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('should clean up event listener on unmount', () => {
    const onOpen = vi.fn();
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useSearchShortcut(onOpen));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});

describe('useSearchNavigation', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should save item to recent items on select', () => {
    const { result } = renderHook(() => useSearchNavigation());

    act(() => {
      result.current.onSelectItem({
        id: 'node-1',
        type: 'node',
        title: 'Test Node',
      });
    });

    const stored = localStorageMock.getItem('glassbox:recent-search-items');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('node-1');
  });

  it('should not duplicate recent items', () => {
    const { result } = renderHook(() => useSearchNavigation());

    act(() => {
      result.current.onSelectItem({
        id: 'node-1',
        type: 'node',
        title: 'Test Node',
      });
    });

    act(() => {
      result.current.onSelectItem({
        id: 'node-1',
        type: 'node',
        title: 'Test Node Updated',
      });
    });

    const stored = localStorageMock.getItem('glassbox:recent-search-items');
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Test Node Updated');
  });

  it('should limit recent items to 5', () => {
    const { result } = renderHook(() => useSearchNavigation());

    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.onSelectItem({
          id: `node-${i}`,
          type: 'node',
          title: `Node ${i}`,
        });
      });
    }

    const stored = localStorageMock.getItem('glassbox:recent-search-items');
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(5);
    // Most recent should be first
    expect(parsed[0].id).toBe('node-9');
  });
});
