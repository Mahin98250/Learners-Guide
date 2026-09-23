import React, { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import StartupMinimal from "./StartupMinimal";
import { LOGO_IMG_SRC } from "@/lg/ui";
import PdfOptimizationOverlay from "./PdfOptimizationOverlay";
import "./mobile.css";
import "./parent-visual-fix.css";
import "./appbar-redesign.css";

const InstallAppPrompt = lazy(() => import("./InstallAppPrompt"));
const DatabaseActivityOverlay = lazy(() => import("./DatabaseActivityOverlay"));

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Mahin startup error", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7fb", fontFamily: "Poppins,sans-serif", color: "#17214d" }}><div style={{ width: "min(430px,100%)", textAlign: "center", background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 16px 50px rgba(15,27,61,.12)" }}><img src={LOGO_IMG_SRC} alt="Mahin" style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 12 }} /><h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Mahin could not start</h1><p style={{ margin: "0 0 18px", color: "#68708a", fontSize: 13 }}>The app hit a startup error. Reload the page to try again.</p><button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 11, padding: "11px 18px", background: "#4357e8", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Reload app</button></div></main>;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Mahin: #root element was not found.");

document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => { link.href = LOGO_IMG_SRC; });

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  const viewportWidth = Math.min(
    window.innerWidth || Number.POSITIVE_INFINITY,
    window.visualViewport?.width || Number.POSITIVE_INFINITY,
  );
  return viewportWidth <= 700 || window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints || 0) > 0;
}

function syncMobileViewport() {
  if (typeof window === "undefined") return;
  document.documentElement.toggleAttribute("data-lg-mobile", isMobileViewport());
}

/*
 * Production mobile lifecycle guard.
 * Browsers can restore a frozen/BFCache page with stale geometry. Re-apply the
 * mobile marker on every lifecycle transition and, only when the mounted app
 * is measurably crushed, perform one guarded recovery reload. This avoids
 * accumulating CSS patches while preventing a broken restored snapshot from
 * becoming the user's persistent app state.
 */
function recoverRestoredMobileLayout() {
  if (typeof window === "undefined" || !isMobileViewport()) return;
  syncMobileViewport();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const shell = document.querySelector<HTMLElement>(".lg-app-shell");
      if (!shell) return;
      const viewport = Math.min(window.innerWidth || 0, window.visualViewport?.width || Number.POSITIVE_INFINITY);
      if (!viewport || viewport > 700) return;
      const width = shell.getBoundingClientRect().width;
      const recoveryKey = "lg-mobile-layout-recovery";
      const recovered = sessionStorage.getItem(recoveryKey) === "1";
      if (width > 0 && width < viewport * 0.82 && !recovered) {
        sessionStorage.setItem(recoveryKey, "1");
        window.location.reload();
      } else if (width >= viewport * 0.82 && recovered) {
        sessionStorage.removeItem(recoveryKey);
      }
    });
  });
}

syncMobileViewport();
window.addEventListener("resize", syncMobileViewport, { passive: true });
window.visualViewport?.addEventListener("resize", syncMobileViewport, { passive: true });
window.addEventListener("pageshow", recoverRestoredMobileLayout, { passive: true });
window.addEventListener("pagehide", () => { syncMobileViewport(); }, { passive: true });
document.addEventListener("visibilitychange", () => {
  syncMobileViewport();
  if (document.visibilityState === "visible") recoverRestoredMobileLayout();
}, { passive: true });
window.addEventListener("orientationchange", recoverRestoredMobileLayout, { passive: true });

let router: ReturnType<typeof getRouter> | null = null;
let bootstrapError: Error | null = null;
try { router = getRouter(); } catch (error) { bootstrapError = error instanceof Error ? error : new Error(String(error)); console.error("Mahin router bootstrap failed", error); }

const secondaryUi = <Suspense fallback={null}><InstallAppPrompt /><DatabaseActivityOverlay /></Suspense>;
const app = router ? <AppErrorBoundary><StartupMinimal /><RouterProvider router={router} /><PdfOptimizationOverlay />{secondaryUi}</AppErrorBoundary> : <AppErrorBoundary><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><div style={{ maxWidth: 430, textAlign: "center", fontFamily: "Poppins,sans-serif" }}><h1>Mahin</h1><p>We couldn't start the application. Please reload once.</p><button type="button" onClick={() => window.location.reload()}>Reload app</button><pre style={{ whiteSpace: "pre-wrap", marginTop: 16, fontSize: 11, color: "#667085" }}>{bootstrapError?.message || "Router startup failed"}</pre></div></main></AppErrorBoundary>;

ReactDOM.createRoot(root).render(<React.StrictMode>{app}</React.StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" }).catch(error => console.warn("Mahin: service worker registration failed", error));
  }, { once: true });
}

if (typeof window !== "undefined") {
  const defer = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 1));
  defer(() => { void import("@/lg/offlineMaterials").then(({ installOfflineMaterialCache }) => installOfflineMaterialCache()); });
}
