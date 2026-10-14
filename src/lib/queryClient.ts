import { QueryClient } from "@tanstack/react-query";

export const createQueryClient = (subject?: string) =>
  new QueryClient({
    defaultOptions: {
      queries: {
        meta: { subject },
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
