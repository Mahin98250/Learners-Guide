import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const configuredBase = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const onProjectSubpath = pathname === "/LG-Main-App" || pathname.startsWith("/LG-Main-App/");
  const basepath = onProjectSubpath ? "/LG-Main-App" : (configuredBase || "/");

  return createRouter({
    routeTree,
    context: { queryClient },
    basepath,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
};
