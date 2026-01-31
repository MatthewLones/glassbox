'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/auth';
import { WebSocketProvider } from '@/lib/websocket';

// Get API base URL from environment or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// WebSocket wrapper that only connects when authenticated
function WebSocketWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  // Don't render WebSocket provider if not authenticated
  // This prevents unnecessary connection attempts
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <WebSocketProvider
      apiBaseUrl={API_BASE_URL}
      autoConnect={true}
      debug={process.env.NODE_ENV === 'development'}
    >
      {children}
    </WebSocketProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WebSocketWrapper>
            {children}
          </WebSocketWrapper>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
