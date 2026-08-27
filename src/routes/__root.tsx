import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(67,97,238,.16), transparent 35%), radial-gradient(circle at 85% 80%, rgba(139,92,246,.14), transparent 35%), #F0F4FF",
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-2xl"
        style={{ borderColor: "#E2E8F0" }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl"
          style={{ background: "#EEF2FF" }}
          aria-hidden="true"
        >
          🎓
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.22em]" style={{ color: "#4361EE" }}>
          Learner's Guide
        </p>
        <h1 className="mt-3 text-7xl font-black tracking-tight" style={{ color: "#0F1B3D" }}>
          404
        </h1>
        <h2 className="mt-2 text-xl font-extrabold" style={{ color: "#0F1B3D" }}>
          Page not found
        </h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "#64748B" }}>
          This page does not exist, or the link may be outdated. Go back to the Learner's Guide home page.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "#4361EE" }}
          >
            ← Go home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-extrabold transition-colors hover:bg-slate-50"
            style={{ borderColor: "#CBD5E1", color: "#0F1B3D", background: "#fff" }}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Learner's Guide" },
      {
        name: "description",
        content:
          "School app for teachers, students and parents — classes, homework, marks and fees.",
      },
      { name: "author", content: "Learner's Guide" },
      { property: "og:title", content: "Learner's Guide" },
      {
        property: "og:description",
        content:
          "School app for teachers, students and parents — classes, homework, marks and fees.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "/pwa-icon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "apple-touch-icon",
        href: "/pwa-icon.svg",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <>
      <HeadContent />
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
      <Scripts />
    </>
  );
}

export function RootDocument({ children }: { children: ReactNode }) {
  return children;
}
