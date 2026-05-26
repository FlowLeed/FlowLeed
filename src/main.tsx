import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import { registerPushServiceWorker } from './lib/push'

// PHASE 3: Configure aggressive caching for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Data is fresh for 30 seconds
      gcTime: 300000, // Cache for 5 minutes (previously cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1, // Only retry failed requests once
    },
  },
});

// Register the push-only service worker (skipped automatically in the Lovable preview iframe).
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerPushServiceWorker().catch(() => {/* non-fatal */});
  });
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
