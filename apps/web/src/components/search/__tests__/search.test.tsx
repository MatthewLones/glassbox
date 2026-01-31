import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { SearchProvider, useSearchDialog } from '../search-context';
import { SearchResultItem } from '../search-result-item';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    search: {
      search: vi.fn().mockResolvedValue({ data: [] }),
      semantic: vi.fn().mockResolvedValue({ data: [] }),
    },
  },
}));

// Mock the app store
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({
    currentOrgId: 'org-1',
  }),
}));

describe('SearchProvider and useSearchDialog', () => {
  function TestComponent() {
    const { isOpen, open, close, toggle } = useSearchDialog();
    return (
      <div>
        <span data-testid="is-open">{isOpen.toString()}</span>
        <button onClick={open}>Open</button>
        <button onClick={close}>Close</button>
        <button onClick={toggle}>Toggle</button>
      </div>
    );
  }

  it('should provide initial closed state', () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should open the search dialog', async () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
  });

  it('should close the search dialog', async () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should toggle the search dialog', async () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    await userEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    await userEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSearchDialog must be used within a SearchProvider');

    consoleSpy.mockRestore();
  });
});

describe('SearchResultItem', () => {
  it('should render node result', () => {
    render(
      <SearchResultItem
        id="node-1"
        type="node"
        title="Test Node"
        description="A test description"
        status="in_progress"
        authorType="human"
      />
    );

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('A test description')).toBeInTheDocument();
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });

  it('should render project result', () => {
    render(
      <SearchResultItem
        id="project-1"
        type="project"
        title="Test Project"
        description="Project description"
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Project description')).toBeInTheDocument();
  });

  it('should render file result', () => {
    render(
      <SearchResultItem
        id="file-1"
        type="file"
        title="document.pdf"
        projectName="My Project"
      />
    );

    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('should show status badge with correct color', () => {
    const { rerender } = render(
      <SearchResultItem
        id="node-1"
        type="node"
        title="Test"
        status="complete"
      />
    );

    expect(screen.getByText('complete')).toHaveClass('bg-green-100');

    rerender(
      <SearchResultItem
        id="node-1"
        type="node"
        title="Test"
        status="draft"
      />
    );

    expect(screen.getByText('draft')).toHaveClass('bg-gray-100');
  });

  it('should show matched field indicator', () => {
    render(
      <SearchResultItem
        id="node-1"
        type="node"
        title="Test"
        matchedField="description"
      />
    );

    expect(screen.getByText('matched in description')).toBeInTheDocument();
  });
});
