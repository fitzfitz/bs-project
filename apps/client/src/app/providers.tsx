import { type ReactNode, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useOverlayScrollbars } from 'overlayscrollbars-react';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import { ConfirmationProvider } from '@/components/ui/confirmation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

function ScrollbarInit() {
  const [initialize] = useOverlayScrollbars({
    options: {
      scrollbars: {
        autoHide: 'scroll',
        autoHideDelay: 800,
        theme: 'os-theme-dark',
      },
    },
  });

  useEffect(() => {
    initialize(document.body);
  }, [initialize]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NotificationProvider>
          <ConfirmationProvider>
            <ScrollbarInit />
            {children}
          </ConfirmationProvider>
        </NotificationProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
