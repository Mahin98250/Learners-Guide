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
    <main
      className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6"
      style={{
        background: "linear-gradient(135deg, #eef4ff 0%, #f7f9ff 45%, #edf1ff 100%)",
      }}
    >
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-indigo-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-40 w-40 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center">
        <section
          className="relative w-full overflow-hidden rounded-[32px] border p-6 text-center shadow-[0_30px_90px_rgba(37,45,90,.16)] backdrop-blur-2xl sm:p-10"
          style={{
            borderColor: "rgba(255,255,255,.72)",
            background: "linear-gradient(145deg, rgba(255,255,255,.72), rgba(255,255,255,.40))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), inset 0 -1px 0 rgba(255,255,255,.25), 0 30px 90px rgba(37,45,90,.16)",
          }}
        >
          <div className="absolute inset-x-8 top-0 h-px bg-white/90" />

          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-xl"
            style={{
              borderColor: "rgba(255,255,255,.78)",
              background: "linear-gradient(135deg, rgba(255,255,255,.86), rgba(255,255,255,.45))",
            }}
            aria-hidden="true"
          >
            <span className="text-2xl">🎓</span>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: "#4361EE" }}>
            Learner's Guide
          </p>

          <div className="mt-4 select-none text-[6rem] font-black leading-none tracking-[-0.07em] sm:text-[8rem]" style={{ color: "#0F1B3D", textShadow: "0 10px 32px rgba(67,97,238,.14)" }}>
            404
          </div>

          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "#0F1B3D" }}>
            This page wandered off.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 sm:text-base" style={{ color: "#64748B" }}>
            The page you're looking for isn't here anymore, or the link may be incorrect. Let's get you back into Learner's Guide.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-extrabold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              style={{
                background: "linear-gradient(135deg, #4361EE, #6D5DF6)",
                boxShadow: "0 12px 28px rgba(67,97,238,.28)",
              }}
            >
              ← Back to home
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-extrabold transition duration-200 hover:-translate-y-0.5 hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              style={{
                borderColor: "rgba(148,163,184,.42)",
                background: "rgba(255,255,255,.45)",
                color: "#0F1B3D",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.75)",
              }}
            >
              Go back
            </button>
          </div>

          <div className="mt-7 flex items-center justify-center gap-2 text-xs font-semibold" style={{ color: "#7C86A5" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#4361EE" }} />
            <span>Looks like this link needs a little help.</span>
          </div>
        </section>
      </div>
    </main>
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
