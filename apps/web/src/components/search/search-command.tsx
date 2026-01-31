'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText, FolderKanban, Sparkles, Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { SearchResultItem, SearchResultSkeleton } from './search-result-item';
import { useSearch, useSearchNavigation, useSearchShortcut } from '@/hooks/use-search';
import { useSearchDialog } from './search-context';
import { cn } from '@/lib/utils';

export function SearchCommand() {
  const router = useRouter();
  const { isOpen, open, close } = useSearchDialog();
  const [useSemanticSearch, setUseSemanticSearch] = React.useState(false);

  const dialogOpen = isOpen;
  const setDialogOpen = (openState: boolean) => {
    if (openState) {
      open();
    } else {
      close();
    }
  };

  const { query, setQuery, results, isLoading, recentItems, clearQuery } =
    useSearch({
      semantic: useSemanticSearch,
      limit: 10,
    });

  const { onSelectItem } = useSearchNavigation();

  // Set up keyboard shortcut (Cmd+K)
  useSearchShortcut(open);

  // Clear query when dialog closes
  React.useEffect(() => {
    if (!dialogOpen) {
      clearQuery();
    }
  }, [dialogOpen, clearQuery]);

  const handleSelect = (item: {
    id: string;
    type: 'node' | 'project' | 'file';
    title: string;
    description?: string;
    status?: string;
    authorType?: 'human' | 'agent';
    projectId?: string;
    projectName?: string;
  }) => {
    onSelectItem(item);
    setDialogOpen(false);

    // Navigate based on type
    if (item.type === 'node' && item.projectId) {
      router.push(`/projects/${item.projectId}?nodeId=${item.id}`);
    } else if (item.type === 'project') {
      router.push(`/projects/${item.id}`);
    }
  };

  const hasQuery = query.trim().length > 0;
  const showResults = hasQuery && query.trim().length >= 2;

  return (
    <CommandDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <CommandInput
        placeholder="Search nodes, projects, files..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Loading state */}
        {isLoading && showResults && (
          <CommandGroup heading="Searching...">
            <div className="px-2 py-1.5">
              <SearchResultSkeleton />
              <SearchResultSkeleton />
              <SearchResultSkeleton />
            </div>
          </CommandGroup>
        )}

        {/* Empty state */}
        {!isLoading && showResults && results.length === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p>No results found for "{query}"</p>
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => setUseSemanticSearch(!useSemanticSearch)}
              >
                {useSemanticSearch ? 'Try exact search' : 'Try semantic search'}
              </button>
            </div>
          </CommandEmpty>
        )}

        {/* Search results */}
        {!isLoading && showResults && results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.type}-${result.id}-${result.title}`}
                onSelect={() => handleSelect(result)}
              >
                <SearchResultItem {...result} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recent items when no query */}
        {!hasQuery && recentItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`recent-${item.id}-${item.title}`}
                onSelect={() => handleSelect(item)}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <SearchResultItem {...item} />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick actions when no query */}
        {!hasQuery && (
          <>
            {recentItems.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => {
                  setDialogOpen(false);
                  router.push('/dashboard');
                }}
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                <span>Go to Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setUseSemanticSearch(true);
                  // Focus input for semantic search
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Semantic Search</span>
                <span className="ml-auto text-xs text-muted-foreground">AI-powered</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer with search mode indicator */}
      <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
            {' '}to select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">esc</kbd>
            {' '}to close
          </span>
        </div>
        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded transition-colors',
            useSemanticSearch
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted'
          )}
          onClick={() => setUseSemanticSearch(!useSemanticSearch)}
        >
          <Sparkles className="h-3 w-3" />
          <span>{useSemanticSearch ? 'Semantic' : 'Exact'}</span>
        </button>
      </div>
    </CommandDialog>
  );
}

// Search trigger button for use in headers
interface SearchTriggerProps {
  className?: string;
}

export function SearchTrigger({ className }: SearchTriggerProps) {
  const { open } = useSearchDialog();

  return (
    <button
      onClick={open}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground',
        'bg-muted/50 hover:bg-muted rounded-md border border-transparent',
        'hover:border-border transition-colors',
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span>Search...</span>
      <kbd className="ml-auto px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">
        ⌘K
      </kbd>
    </button>
  );
}
