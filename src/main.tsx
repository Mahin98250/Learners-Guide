import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import InstallAppPrompt from "./InstallAppPrompt";
import StartupMinimal from "./StartupMinimal";
import DatabaseActivityOverlay, { emitDatabaseActivity } from "./DatabaseActivityOverlay";
import MobileBackNavigation from "./MobileBackNavigation";
import { LOGO_IMG_SRC } from "@/lg/ui";
import "./mobile.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Learner's Guide startup error", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7fb", fontFamily: "Poppins,sans-serif", color: "#17214d" }}><div style={{ width: "min(430px,100%)", textAlign: "center", background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 16px 50px rgba(15,27,61,.12)" }}><img src={LOGO_IMG_SRC} alt="Learner's Guide" style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 12 }} /><h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Learner's Guide could not start</h1><p style={{ margin: "0 0 18px", color: "#68708a", fontSize: 13 }}>The app hit a startup error. Reload the page to try again.</p><button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 11, padding: "11px 18px", background: "#4357e8", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Reload app</button></div></main>;
  }
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const isSupabase = rawUrl.includes("supabase.co");
  if (!isSupabase) return originalFetch(input, init);
  const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET")).toUpperCase();
  const path = rawUrl.toLowerCase();
  const isUpload = path.includes("/storage/") && ["POST", "PUT", "PATCH"].includes(method);
  const isSave = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const label = path.includes("/storage/") ? (isUpload ? "Uploading…" : method === "DELETE" ? "Removing…" : "Loading file…") : path.includes("/auth/") ? "Checking account…" : isSave ? "Saving changes…" : "Loading data…";
  const kind = isUpload ? "upload" : isSave ? "save" : path.includes("/auth/") ? "sync" : "load";
  emitDatabaseActivity(true, label, kind);
  try { return await originalFetch(input, init); } finally { emitDatabaseActivity(false, label, kind); }
};

const root = document.getElementById("root");
if (!root) throw new Error("Learner's Guide: #root element was not found.");

const installOriginalLogo = () => document.querySelectorAll<HTMLLinkElement>('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => { link.href = LOGO_IMG_SRC; });
installOriginalLogo();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { void (async () => { try { const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" }); await registration.update(); } catch (error) { console.warn("Learner's Guide: service worker registration failed", error); } })(); });
}
window.addEventListener("click", (event) => { const target = event.target; if (!(target instanceof Element)) return; const link = target.closest("a[download]"); if (link instanceof HTMLAnchorElement) link.target = "_self"; }, true);

let router: ReturnType<typeof getRouter> | null = null;
let bootstrapError: Error | null = null;
try { router = getRouter(); } catch (error) { bootstrapError = error instanceof Error ? error : new Error(String(error)); console.error("Learner's Guide router bootstrap failed", error); }

const app = router ? <AppErrorBoundary><StartupMinimal /><RouterProvider router={router} /><InstallAppPrompt /><DatabaseActivityOverlay /><MobileBackNavigation /></AppErrorBoundary> : <AppErrorBoundary><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><div style={{ maxWidth: 430, textAlign: "center", fontFamily: "Poppins,sans-serif" }}><h1>Learner's Guide</h1><p>We couldn't start the application. Please reload once.</p><button type="button" onClick={() => window.location.reload()}>Reload app</button><pre style={{ whiteSpace: "pre-wrap", marginTop: 16, fontSize: 11, color: "#667085" }}>{bootstrapError?.message || "Router startup failed"}</pre></div></main></AppErrorBoundary>;

ReactDOM.createRoot(root).render(<React.StrictMode>{app}</React.StrictMode>);
