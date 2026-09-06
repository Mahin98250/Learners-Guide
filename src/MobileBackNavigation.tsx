import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "lg-mobile-back-navigation";
type BackMode = "arrow" | "swipe";

function isAppRoot(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  const base = "/";
  return path === "" || path === base;
}

function canGoBack() {
  return window.history.length > 1 && !isAppRoot(window.location.pathname);
}

export default function MobileBackNavigation() {
  const [mode, setMode] = useState<BackMode>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "swipe" ? "swipe" : "arrow";
    } catch {
      return "arrow";
    }
  });
  const [canBack, setCanBack] = useState(() => canGoBack());
  const [showModeMenu, setShowModeMenu] = useState(false);

  const isTouchDevice = useMemo(
    () => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    [],
  );

  useEffect(() => {
    const update = () => setCanBack(canGoBack());
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    window.addEventListener("pageshow", update);
    update();
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable in private browsing; navigation still works.
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "swipe" || !isTouchDevice) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onTouchEnd = (event: TouchEvent): void => {
      if (!tracking || event.changedTouches.length !== 1) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (startX < window.innerWidth * 0.85 && dx > 90 && dy < 70 && canGoBack()) {
        window.history.back();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isTouchDevice, mode]);

  const goBack = () => {
    if (canGoBack()) window.history.back();
  };

  if (!isTouchDevice || isAppRoot(window.location.pathname)) return null;

  return (
    <>
      {mode === "arrow" && canBack && (
        <button type="button" aria-label="Go back" onClick={goBack} style={{ position: "fixed", left: "max(14px, env(safe-area-inset-left))", top: "max(14px, env(safe-area-inset-top))", zIndex: 2147483000, width: 44, height: 44, border: "1px solid rgba(255,255,255,.22)", borderRadius: 999, background: "rgba(25,20,55,.82)", color: "white", boxShadow: "0 8px 28px rgba(0,0,0,.22)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 25, lineHeight: 1, touchAction: "manipulation" }}>‹</button>
      )}
      <button type="button" aria-label="Back navigation settings" aria-expanded={showModeMenu} onClick={() => setShowModeMenu((open) => !open)} style={{ position: "fixed", right: "max(14px, env(safe-area-inset-right))", bottom: "max(86px, calc(86px + env(safe-area-inset-bottom)))", zIndex: 2147483000, width: 38, height: 38, border: "1px solid rgba(255,255,255,.18)", borderRadius: 999, background: "rgba(25,20,55,.72)", color: "white", boxShadow: "0 6px 20px rgba(0,0,0,.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 17, touchAction: "manipulation" }}>⋮</button>
      {showModeMenu && (
        <div role="dialog" aria-label="Back navigation options" style={{ position: "fixed", right: "max(14px, env(safe-area-inset-right))", bottom: "max(132px, calc(132px + env(safe-area-inset-bottom)))", zIndex: 2147483001, minWidth: 180, padding: 8, borderRadius: 16, background: "rgba(25,20,55,.94)", color: "white", boxShadow: "0 14px 40px rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
          <div style={{ padding: "7px 10px", fontSize: 12, opacity: 0.7 }}>Back navigation</div>
          {(["arrow", "swipe"] as BackMode[]).map((option) => (
            <button key={option} type="button" onClick={() => { setMode(option); setShowModeMenu(false); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: 0, borderRadius: 10, background: mode === option ? "rgba(255,255,255,.14)" : "transparent", color: "white", textAlign: "left", cursor: "pointer", fontSize: 14 }}>
              {mode === option ? "✓ " : ""}{option === "arrow" ? "Arrow button" : "Swipe back"}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
