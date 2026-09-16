import type { ReactNode } from "react";
import { A } from "./ReferenceAdminShared";

function Badge({ v }: { v: any }) {
  const x = String(v ?? "—");
  const c: Record<string, string> = {
    active: A.green,
    paid: A.green,
    present: A.green,
    pending: A.amber,
    overdue: A.red,
    absent: A.red,
    leave: A.amber,
    teacher: A.purple,
    student: A.accent,
    parent: A.green,
    admin: A.red,
  };
  const col = c[x.toLowerCase()] || A.sub;
  return (
    <span className="badge" style={{ background: col + "18", color: col }}>
      {x.toUpperCase()}
    </span>
  );
}
function Btn({
  children,
  onClick,
  color = A.accent,
  outline = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: string;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: outline ? "transparent" : color,
        color: outline ? color : "#fff",
        border: outline ? `1.5px solid ${color}` : "none",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modalbox"
        style={{ maxWidth: wide ? 900 : 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button
            className="btn"
            onClick={onClose}
            style={{ background: A.light, color: A.sub, padding: 8 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  options,
  required = false,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  options?: Array<string | { v: string; l: string }>;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {required && <span style={{ color: A.red }}> *</span>}
      </label>
      {options ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ),
          )}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          required={required}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title="Are you sure?" onClose={onNo}>
      <p style={{ color: A.sub }}>{text}</p>
      <div className="actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn onClick={onNo} outline color={A.sub}>
          Cancel
        </Btn>
        <Btn onClick={onYes} color={A.red}>
          Delete
        </Btn>
      </div>
    </Modal>
  );
}
function Table({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: Array<[string, string, (r: Row) => ReactNode]>;
  actions?: (r: Row) => ReactNode;
}) {
  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c[0]}>{c[1]}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={String(r.id ?? i)}>
                {columns.map((c) => (
                  <td key={c[0]}>{c[2] ? c[2](r) : String(r[c[0]] ?? "—")}</td>
                ))}
                {actions && <td>{actions(r)}</td>}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                style={{ textAlign: "center", padding: 40, color: A.sub }}
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}