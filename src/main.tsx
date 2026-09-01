import React, { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import StartupMinimal from "./StartupMinimal";
import { LOGO_IMG_SRC } from "@/lg/ui";
import { installOfflineMaterialCache } from "@/lg/offlineMaterials";
import "./mobile.css";
import "./production-mobile.css";

const InstallAppPrompt = lazy(() => import("./InstallAppPrompt"));
const DatabaseActivityOverlay = lazy(() => import("./DatabaseActivityOverlay"));

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Learner's Guide startup error", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7fb", fontFamily: "Poppins,sans-serif", color: "#17214d" }}><div style={{ width: "min(430px,100%)", textAlign: "center", background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 16px 50px rgba(15,27,61,.12)" }}><img src={LOGO_IMG_SRC} alt="Learner's Guide" style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 12 }} /><h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Learner's Guide could not start</h1><p style={{ margin: "0 0 18px", color: "#68708a", fontSize: 13 }}>The app hit a startup error. Reload the page to try again.</p><button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 11, padding: "11px 18px", background: "#4357e8", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Reload app</button></div></main>;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Learner's Guide: #root element was not found.");

document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => { link.href = LOGO_IMG_SRC; });

/*
 * Mobile browsers can freeze a page while it is hidden and later restore the
 * exact DOM/CSS snapshot. If a responsive layout was mid-transition when the
 * page was frozen, the restored snapshot can have stale measurements. Keep
 * the app self-healing instead of forcing users to manually reload it.
 */
function recoverMobileLayout() {
  if (typeof window === "undefined" || window.innerWidth > 700) return;

  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  document.documentElement.style.setProperty("--lg-viewport-width", `${viewportWidth}px`);

  void document.documentElement.offsetHeight;
  window.dispatchEvent(new Event("resize"));

  window.requestAnimationFrame(() => {
    const shell = document.querySelector<HTMLElement>(".lg-app-shell");
    if (!shell || viewportWidth <= 0) return;

    const shellWidth = shell.getBoundingClientRect().width;
    const mismatch = shellWidth < viewportWidth * 0.92;
    const recoveryKey = "lg-mobile-layout-recovery";
    let recentlyRecovered = false;
    try {
      const stamp = Number(sessionStorage.getItem(recoveryKey) || 0);
      recentlyRecovered = Number.isFinite(stamp) && Date.now() - stamp < 15000;
    } catch {}

    if (mismatch && !recentlyRecovered) {
      try { sessionStorage.setItem(recoveryKey, String(Date.now())); } catch {}
      window.location.reload();
      return;
    }

    if (!mismatch && recentlyRecovered) {
      try { sessionStorage.removeItem(recoveryKey); } catch {}
    }
  });
}

if (typeof window !== "undefined") {
  const recover = () => window.setTimeout(recoverMobileLayout, 60);
  window.addEventListener("pageshow", recover);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recover();
  });
  window.addEventListener("orientationchange", recover);
  recover();
}

let router: ReturnType<typeof getRouter> | null = null;
let bootstrapError: Error | null = null;
try { router = getRouter(); } catch (error) { bootstrapError = error instanceof Error ? error : new Error(String(error)); console.error("Learner's Guide router bootstrap failed", error); }

const secondaryUi = <Suspense fallback={null}><InstallAppPrompt /><DatabaseActivityOverlay /></Suspense>;
const app = router ? <AppErrorBoundary><StartupMinimal /><RouterProvider router={router} />{secondaryUi}</AppErrorBoundary> : <AppErrorBoundary><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><div style={{ maxWidth: 430, textAlign: "center", fontFamily: "Poppins,sans-serif" }}><h1>Learner's Guide</h1><p>We couldn't start the application. Please reload once.</p><button type="button" onClick={() => window.location.reload()}>Reload app</button><pre style={{ whiteSpace: "pre-wrap", marginTop: 16, fontSize: 11, color: "#667085" }}>{bootstrapError?.message || "Router startup failed"}</pre></div></main></AppErrorBoundary>;

ReactDOM.createRoot(root).render(<React.StrictMode>{app}</React.StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" }).catch(error => console.warn("Learner's Guide: service worker registration failed", error));
  }, { once: true });
}

if (typeof window !== "undefined") {
  const defer = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 1));
  defer(() => installOfflineMaterialCache());
}
