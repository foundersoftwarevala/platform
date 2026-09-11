import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { registerSignOutCache } from "@/lib/auth-bridge";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Signing out empties this cache. Registered here because the cache is built
  // per router, so this is the only place that knows which one is live.
  registerSignOutCache(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
