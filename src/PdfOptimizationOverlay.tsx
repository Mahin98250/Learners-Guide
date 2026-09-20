import { useEffect, useState } from "react";

type OptimizationDetail = {
  status: "processing" | "optimized" | "original-kept" | "failed";
  fileName?: string;
  originalSize?: number | null;
  optimizedSize?: number | null;
  savingsBytes?: number | null;
  savingsPercent?: number | null;
  progress?: number;
  message?: string;
  validationReason?: string;
};

const mb = (bytes?: number | null) => bytes == null ? "—" : `${(bytes / 1048576).toFixed(1)} MB`;
const saved = (bytes?: number | null) => bytes == null ? "—" : `${(bytes / 1048576).toFixed(1)} MB`;

export default function PdfOptimizationOverlay() {
  const [detail, setDetail] = useState<OptimizationDetail | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onEvent = (event: Event) => {
      const next = (event as CustomEvent<OptimizationDetail>).detail;
      if (!next) return;
      setDetail(next);
      setVisible(true);
    };
    window.addEventListener("lg:pdf-optimization", onEvent);
    return () => window.removeEventListener("lg:pdf-optimization", onEvent);
  }, []);

  if (!visible || !detail) return null;

  const processing = detail.status === "processing";
  const successful = detail.status === "optimized";
  const fallback = detail.status === "original-kept";
  const failed = detail.status === "failed";
  const canClose = !processing;

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="PDF optimization status">
      <div style={dialog}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{processing ? "⚙️" : successful ? "✅" : failed ? "⚠️" : "ℹ️"}</div>
            <h2 style={{ margin: 0, fontSize: 19, color: "#0F1B3D" }}>PDF Optimization</h2>
            <div style={fileName}>{detail.fileName || "PDF file"}</div>
          </div>
          {canClose && <button type="button" onClick={() => setVisible(false)} style={closeButton} aria-label="Close">✕</button>}
        </div>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: processing ? "#EEF2FF" : successful ? "#ECFDF5" : "#FFF7ED", border: `1px solid ${processing ? "#C7D2FE" : successful ? "#A7F3D0" : "#FED7AA"}` }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0F1B3D" }}>{detail.message || "Processing PDF…"}</div>
          {processing && detail.progress != null && <div style={{ marginTop: 10, height: 8, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, detail.progress))}%`, height: "100%", background: "#4361EE", transition: "width .2s ease" }} /></div>}
        </div>

        <div style={grid}>
          <Metric label="Original size" value={mb(detail.originalSize)} />
          <Metric label="Optimized size" value={processing && detail.optimizedSize == null ? "Processing…" : mb(detail.optimizedSize)} />
          <Metric label="Data saved" value={saved(detail.savingsBytes)} />
          <Metric label="Compression" value={detail.savingsPercent == null ? "—" : `${detail.savingsPercent}%`} />
        </div>

        <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.55, color: "#64748B" }}>
          {successful && "The optimized PDF passed PDF validation and page-count checks, and the smaller file is being uploaded."}
          {fallback && "No safe size reduction was found, so the original PDF is kept. No content is intentionally removed."}
          {failed && `The optimization pipeline could not safely apply compression. The original PDF is kept instead.${detail.validationReason ? ` Reason: ${detail.validationReason}` : ""}`}
          {processing && "The original file is not replaced until optimization and validation finish."}
        </div>

        {canClose && <button type="button" onClick={() => setVisible(false)} style={doneButton}>{failed ? "Continue with original" : "Continue"}</button>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metric}><div style={metricLabel}>{label}</div><div style={metricValue}>{value}</div></div>;
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,.62)", display: "grid", placeItems: "center", padding: 18 };
const dialog: React.CSSProperties = { width: "min(520px,100%)", background: "#fff", borderRadius: 22, padding: 22, boxShadow: "0 24px 80px rgba(15,23,42,.3)", boxSizing: "border-box" };
const fileName: React.CSSProperties = { marginTop: 4, fontSize: 12, color: "#64748B", maxWidth: 420, overflowWrap: "anywhere" };
const closeButton: React.CSSProperties = { border: 0, background: "#F8FAFC", borderRadius: 10, padding: "8px 10px", cursor: "pointer" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 14 };
const metric: React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 14, padding: 13, background: "#F8FAFC" };
const metricLabel: React.CSSProperties = { fontSize: 11, color: "#64748B", fontWeight: 700 };
const metricValue: React.CSSProperties = { marginTop: 4, fontSize: 18, fontWeight: 850, color: "#0F1B3D" };
const doneButton: React.CSSProperties = { width: "100%", marginTop: 18, border: 0, borderRadius: 12, padding: "11px 14px", background: "#4361EE", color: "#fff", fontWeight: 800, cursor: "pointer" };
