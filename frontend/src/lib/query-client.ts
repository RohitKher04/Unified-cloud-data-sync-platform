import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry client-side 4xx errors (e.g. 400, 401, 403, 404, 409)
        if (axios.isAxiosError(error) && error.response?.status) {
          const status = error.response.status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        // Retry network or 5xx server errors up to 2 times
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
