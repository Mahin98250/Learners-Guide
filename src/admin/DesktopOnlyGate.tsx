import { useEffect, useState, type PropsWithChildren } from "react";

const MIN_DESKTOP_WIDTH = 1200;

export function DesktopOnlyGate({ children }: PropsWithChildren) {
  const [allowed, setAllowed] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const evaluate = () => {
      const nextWidth = window.innerWidth;
      setWidth(nextWidth);
      setAllowed(nextWidth >= MIN_DESKTOP_WIDTH);
    };
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  if (!allowed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          minWidth: "100vw",
          display: "grid",
          placeItems: "center",
          padding: 32,
          boxSizing: "border-box",
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "Poppins,system-ui,sans-serif",
          textAlign: "center",
        }}
      >
        <section style={{ width: "min(680px,100%)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: "#93c5fd" }}>
            DESKTOP ADMINISTRATOR CONSOLE
          </div>
          <h1 style={{ margin: "12px 0 10px", fontSize: 34 }}>
            Desktop screen required
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.7 }}>
            The administrator console is intentionally not supported on mobile phones or tablets.
            Open Learner&apos;s Guide on a desktop or laptop with a screen width of at least 1200px.
          </p>
          {width > 0 && (
            <div style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
              Current viewport: {width}px · Required: {MIN_DESKTOP_WIDTH}px+
            </div>
          )}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
