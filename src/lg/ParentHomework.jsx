import React, { useEffect, useState } from "react";
import { Card, Sec, Badge } from "@/lg/ui";
import { C } from "@/lg/data";
import { supabase, SB_KEY, SB_URL } from "@/lg/supabase";
import { dueState } from "@/lg/dateUtils";

const DB_NAME = "learners-guide-offline-pdfs";
const STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Offline storage is not available."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline storage error."));
  });
}

async function saveOfflineFile(id, blob) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, String(id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Offline caching is best-effort; the online file must still work.
  }
}

async function readOfflineFile(id) {
  try {
    const db = await openDb();
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(String(id));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

function dueLabel(due) {
  if (!due) return null;
  const dueDate = new Date(`${due}T23:59:59`);
  const diff = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
  if (diff > 1) return `${diff} days left`;
  if (diff === 1) return "1 day left";
  if (diff === 0) return "Due today";
  const late = Math.abs(diff);
  return `${late} day${late === 1 ? "" : "s"} overdue`;
}

async function fetchHomeworkPdf(id, filename) {
  const cached = await readOfflineFile(id);
  if (cached) return { blob: cached, name: filename || "homework.pdf", offline: true };

  if (!navigator.onLine) {
    throw new Error("This file has not been downloaded yet. Connect to the internet first.");
  }

  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(`${SB_URL}/functions/v1/homework-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SB_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) throw new Error("Unable to retrieve homework PDF.");

  const blob = await response.blob();
  await saveOfflineFile(id, blob);
  return { blob, name: filename || "homework.pdf", offline: false };
}

function PdfViewer({ file, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15,23,42,.78)",
        display: "flex",
        flexDirection: "column",
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 4px",
          color: "#fff",
        }}
      >
        <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.name}{file.offline ? " · Offline" : ""}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 0, borderRadius: 9, padding: "8px 12px", background: "#fff", color: C.text, fontWeight: 800 }}
        >
          Close
        </button>
      </div>
      <iframe
        title={file.name || "PDF viewer"}
        src={file.url}
        style={{ flex: 1, width: "100%", border: 0, borderRadius: 12, background: "#fff" }}
      />
    </div>
  );
}

export function ParentHomework({ homework = [] }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    setSelected(null);
    setError("");
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  }, [homework]);

  useEffect(() => () => {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
  }, [viewer]);

  const getFile = async (item) => fetchHomeworkPdf(item.id, item.pdfname);

  const handleView = async (item) => {
    try {
      setBusy(`view-${item.id}`);
      setError("");
      const file = await getFile(item);
      const url = URL.createObjectURL(file.blob);
      setViewer({ ...file, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open PDF.");
    } finally {
      setBusy("");
    }
  };

  const handleDownload = async (item) => {
    try {
      setBusy(`download-${item.id}`);
      setError("");
      const file = await getFile(item);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy("");
    }
  };

  const closeViewer = () => {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  };

  if (selected) {
    return (
      <>
        <Card style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ border: 0, background: "none", color: C.accent, fontWeight: 800, padding: 0, cursor: "pointer" }}
          >
            ← Back to homework
          </button>

          <div style={{ marginTop: 14 }}>
            <Badge label={selected.subject || "Subject"} />
            <h3 style={{ margin: "10px 0 6px" }}>{selected.title || selected.desc || "Homework"}</h3>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
              {selected.desc || "No description provided."}
            </div>
            <div style={{ marginTop: 14, fontSize: 12 }}>
              <b>Assigned:</b> {selected.given || selected.created_at?.slice(0, 10) || "—"}
            </div>
            <div style={{ fontSize: 12, marginTop: 5 }}>
              <b>Due:</b> {selected.due || "—"}
            </div>
            {selected.due && (
              <div style={{ marginTop: 9, fontWeight: 800, color: selected.due < new Date().toISOString().slice(0, 10) ? C.red : C.accent }}>
                {dueLabel(selected.due)}
              </div>
            )}

            {selected.pdfname && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#F8FAFC" }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>📄 {selected.pdfname}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void handleView(selected)}
                    disabled={!!busy}
                    style={{ border: 0, borderRadius: 9, padding: "9px 12px", background: C.accent, color: "#fff", fontWeight: 800 }}
                  >
                    {busy === `view-${selected.id}` ? "Opening…" : "View PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload(selected)}
                    disabled={!!busy}
                    style={{ border: 0, borderRadius: 9, padding: "9px 12px", background: C.text, color: "#fff", fontWeight: 800 }}
                  >
                    {busy === `download-${selected.id}` ? "Downloading…" : "Download PDF"}
                  </button>
                </div>
              </div>
            )}
            {error && <div style={{ marginTop: 12, color: C.red, fontSize: 12 }}>{error}</div>}
          </div>
        </Card>
        {viewer && <PdfViewer file={viewer} onClose={closeViewer} />}
      </>
    );
  }

  return (
    <>
      <Sec title="Homework" />
      {!homework.length ? (
        <Card>No homework assigned 🎉</Card>
      ) : (
        filteredHomework.map((item) => (
          <Card key={item.id} style={{ marginBottom: 9, cursor: "pointer" }} onClick={() => setSelected(item)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <Badge label={item.subject || "Subject"} />
                <div style={{ fontWeight: 800, marginTop: 7 }}>{item.title || item.desc || "Homework"}</div>
                <div style={{ fontSize: 11, color: C.sub }}>Due: {item.due || "—"}</div>
                {item.due && (() => { const state = dueState(item.due); const color = state.key === "overdue" ? C.red : state.key === "today" ? "#D97706" : C.accent; return <div style={{display:"inline-block",marginTop:4,padding:"4px 8px",borderRadius:999,background:color+"18",color,fontSize:10,fontWeight:900}}>{state.label}</div>; })()}
              </div>
              {item.pdfname && <span style={{ fontSize: 18 }} title="PDF attached">📄</span>}
            </div>
          </Card>
        ))
      )}
      {error && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{error}</div>}
    </>
  );
}
