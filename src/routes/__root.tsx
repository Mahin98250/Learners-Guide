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
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6" style={{ background: "linear-gradient(135deg, #071126 0%, #101936 42%, #161443 68%, #080d1e 100%)" }}>
      <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.09] p-7 text-center backdrop-blur-2xl sm:p-10">
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/20 bg-white/10 text-3xl shadow-2xl shadow-indigo-950/30 backdrop-blur-xl"><span aria-hidden="true">🎓</span></div>
        <p className="relative text-[11px] font-black uppercase tracking-[0.34em] text-indigo-200/90">Learner's Guide</p>
        <h1 className="relative mt-3 bg-gradient-to-b from-white via-white to-indigo-200 bg-clip-text text-[clamp(6rem,20vw,9rem)] font-black leading-[0.82] tracking-[-0.075em] text-transparent">404</h1>
        <h2 className="relative mt-5 text-2xl font-black tracking-tight text-white sm:text-3xl">This page took a wrong turn.</h2>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-[15px]">The link doesn't lead anywhere in Learner's Guide. Let's get you safely back to where your learning is.</p>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
          <Link to="/" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-indigo-300/25 bg-gradient-to-r from-indigo-500/90 to-violet-500/85 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/30">⌂ Back to home</Link>
          <button type="button" onClick={() => window.history.back()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-3 text-sm font-extrabold text-white shadow-lg backdrop-blur-xl">↩ Go back</button>
        </div>
      </section>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error instanceof Error ? error : new Error(String(error)), { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button>
          <Link to="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Go home</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { title: "Learner's Guide" },
    { name: "description", content: "School app for teachers, students and parents — classes, homework, marks and fees." },
    { name: "author", content: "Learner's Guide" },
    { property: "og:title", content: "Learner's Guide" },
    { property: "og:description", content: "School app for teachers, students and parents — classes, homework, marks and fees." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ], links: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" },
    { rel: "stylesheet", href: appCss },
    { rel: "icon", href: "/pwa-icon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: "/pwa-icon.svg" },
  ] }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <><HeadContent /><QueryClientProvider client={queryClient}><Outlet /></QueryClientProvider><Scripts /></>;
}

export function RootDocument({ children }: { children: ReactNode }) { return children as ReactNode; }
