import { C } from "@/lg/data";
import type { Option } from "./BatchesTimetableConstants";

export function Button({ children, onClick, outline = false, color = C.accent, disabled = false }: { children: React.ReactNode; onClick?: () => void; outline?: boolean; color?: string; disabled?: boolean }) {
  return <button type="button" className="btn" disabled={disabled} onClick={onClick} style={{ background: outline ? "transparent" : color, color: outline ? color : "#fff", border: outline ? `1.5px solid ${color}` : 0, opacity: disabled ? 0.6 : 1 }}>{children}</button>;
}

export function Field({ label, value, onChange, options, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; options?: Option[]; type?: string; placeholder?: string }) {
  return <label className="field"><span>{label}</span>{options ? <select value={value} onChange={e => onChange(e.target.value)}><option value="">Select…</option>{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select> : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}</label>;
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal" onClick={onClose}><div className="modalbox" onClick={e => e.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ margin: 0 }}>{title}</h2><button type="button" onClick={onClose} style={{ border: 0, background: "#F1F5F9", borderRadius: 9, padding: 8, cursor: "pointer" }}>✕</button></div>{children}</div></div>;
}