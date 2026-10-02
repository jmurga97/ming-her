import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@ming-her/api/router";

export const queryClient = new QueryClient();
export const trpcClient = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: "/trpc" })] });
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });
export type RouterContext = { queryClient: QueryClient; trpc: typeof trpc };
