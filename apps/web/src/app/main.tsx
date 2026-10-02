import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { queryClient, trpc } from "~/lib/trpc";

import { routeTree } from "./route-tree.gen";

const router = createRouter({ routeTree, context: { queryClient, trpc } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const container = document.querySelector("#root");
if (!container) throw new Error("Root element is missing");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
