import { LGLogo } from "@/lg/ui";
import { A, NAV, type PageKey } from "./ReferenceAdminShared";
import { Btn } from "./ReferenceAdminControls";

export function Sidebar({
  page,
  setPage,
  onLogout,
}: {
  page: PageKey;
  setPage: (p: PageKey) => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className="side"
      style={{
        width: 235,
        minHeight: "100vh",
        background: A.sidebar,
        padding: "0 12px 18px",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "20px 8px 16px", borderBottom: "1px solid #ffffff12" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "#fff",
              display: "grid",
              placeItems: "center",
              padding: 4,
            }}
          >
            <LGLogo size={34} showText={false} />
          </div>
          <div>
            <b style={{ display: "block", color: "#fff", fontSize: 16 }}>Learner's</b>
            <b style={{ display: "block", color: A.gold, fontSize: 16, marginTop: -4 }}>Guide</b>
          </div>
        </div>
        <div style={{ marginTop: 12, color: A.red, fontSize: 11, fontWeight: 800 }}>
          🔴 ADMIN PANEL
        </div>
      </div>
      <nav className="navrow" style={{ flex: 1, overflowY: "auto", padding: "14px 0" }}>
        {NAV.map(([k, ic, l]) => (
          <button
            key={k}
            className={`nav ${page === k ? "active" : ""}`}
            onClick={() => setPage(k)}
          >
            <span style={{ fontSize: 18 }}>{ic}</span>
            {l}
          </button>
        ))}
      </nav>
      <div className="sidebottom" style={{ borderTop: "1px solid #ffffff12", paddingTop: 14 }}>
        <div style={{ color: "#fff", fontWeight: 750, padding: 8 }}>
          👑 Admin{" "}
          <span style={{ display: "block", fontSize: 11, color: "#ffffff73", fontWeight: 500 }}>
            Full Access
          </span>
        </div>
        <Btn onClick={onLogout} color="#8f2020">
          🚪 Logout
        </Btn>
      </div>
    </aside>
  );
}
export function Top({
  meta,
  onRefresh,
}: {
  meta: { title: string; subtitle: string };
  onRefresh: () => void;
}) {
  return (
    <header
      className="top"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 28px",
        background: "#fff",
        borderBottom: `1px solid ${A.border}`,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 20 }}>{meta.title}</h1>
        <div style={{ fontSize: 13, color: A.sub }}>{meta.subtitle}</div>
      </div>
      <Btn onClick={onRefresh} outline>
        ↻ Refresh
      </Btn>
    </header>
  );
}