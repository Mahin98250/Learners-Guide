import React, { Component, useEffect, useMemo, useState } from "react";
import { C, uid } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { Card, Badge, Sec } from "@/lg/ui";

const MAX = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg";
const allowedFile = (f) => Boolean(f && /\.(pdf|pptx?|docx?|png|jpe?g)$/i.test(f.name));
const sizeLabel = (n) => {
  if (!n) return "";
  const mb = n / 1048576;
  return mb < 1 ? `${Math.round(n / 1024)} KB` : `${mb.toFixed(1)} MB`;
};
const errText = (e) => e instanceof Error ? e.message : (e?.message || "Something went wrong. Please try again.");
const text = (v) => String(v ?? "").trim();
const standardsOf = (v) => Array.isArray(v) ? v.filter(Boolean).map(String) : [];
const folderPath = (id, folders) => {
  const out = [];
  let cur = folders.find((f) => String(f.id) === String(id));
  let guard = 0;
  while (cur && guard++ < 50) {
    out.unshift(cur);
    cur = cur.parent_id ? folders.find((f) => String(f.id) === String(cur.parent_id)) : null;
  }
  return out;
};
const sortFolders = (items) => [...items].sort((a, b) => text(a?.name).localeCompare(text(b?.name), undefined, { sensitivity: "base" }));
const rootFolders = (folders) => sortFolders(folders.filter((f) => !f?.parent_id));

async function loadTeacherBatches(teacherId) {
  if (!teacherId) return [];
  const { data: entries, error } = await supabase
    .from("timetable_entries")
    .select("batch_id,subject_name")
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (error) throw error;
  const ids = [...new Set((entries || []).map((e) => e?.batch_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data: batches, error: batchError } = await supabase
    .from("batches")
    .select("id,name,cls,sec,status")
    .in("id", ids);
  if (batchError) throw batchError;
  const subjects = new Map();
  for (const entry of entries || []) {
    const key = String(entry.batch_id);
    if (!subjects.has(key)) subjects.set(key, new Set());
    if (entry.subject_name) subjects.get(key).add(String(entry.subject_name));
  }
  return (batches || [])
    .filter((b) => b?.status == null || b.status === "active")
    .map((b) => ({ ...b, subjects: [...(subjects.get(String(b.id)) || new Set())] }));
}

class MaterialsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Teacher study materials crashed:", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <Card style={{ marginBottom: 14, background: "#FFF7ED", color: C.text }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Study Materials could not be displayed</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
            The rest of the teacher portal is still available. Reload this section to recover the material library.
          </div>
          <button type="button" onClick={() => this.setState({ failed: false })} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: C.accent, color: "#fff", fontWeight: 800 }}>
            Reload materials
          </button>
        </Card>
      );
    }
    return this.props.children;
  }
}

function TeacherMaterialsManager({ teacher }) {
  const [folders, setFolders] = useState([]);
  const [rows, setRows] = useState([]);
  const [batches, setBatches] = useState([]);
  const [authId, setAuthId] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [rootStandard, setRootStandard] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [fileSubject, setFileSubject] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const refresh = async () => {
    if (!teacher?.id) return;
    setLoading(true);
    setError("");
    try {
      const userRes = await supabase.auth.getUser();
      if (userRes.error) throw userRes.error;
      const [bs, fs, ms] = await Promise.all([
        loadTeacherBatches(teacher.id),
        supabase.from("material_folders").select("id,name,parent_id,created_by,created_at,access_standards").order("created_at", { ascending: true }),
        supabase.from("materials").select("id,title,name,folder_id,batch_id,subject,desc,date,tid,storage_path,file_size,mime_type,created_at").order("created_at", { ascending: false }),
      ]);
      if (fs.error) throw fs.error;
      if (ms.error) throw ms.error;
      setAuthId(userRes.data.user?.id || null);
      setBatches(Array.isArray(bs) ? bs : []);
      setFolders(Array.isArray(fs.data) ? fs.data : []);
      setRows(Array.isArray(ms.data) ? ms.data : []);
      if (!rootStandard && bs?.[0]?.cls) setRootStandard(String(bs[0].cls));
    } catch (e) {
      console.error("Teacher materials load failed:", e);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [teacher?.id]);

  const current = currentId ? folders.find((f) => String(f.id) === String(currentId)) || null : null;
  const children = useMemo(() => sortFolders(folders.filter((f) => String(f?.parent_id || "") === String(currentId || ""))), [folders, currentId]);
  const materials = useMemo(() => rows.filter((r) => String(r?.folder_id || "") === String(currentId || "")), [rows, currentId]);
  const breadcrumb = useMemo(() => current ? folderPath(current.id, folders) : [], [current, folders]);
  const standards = useMemo(() => [...new Set(batches.map((b) => text(b?.cls)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [batches]);
  const standardForCurrent = useMemo(() => {
    for (const folder of breadcrumb) {
      const access = standardsOf(folder?.access_standards);
      if (access.length) return access[0];
    }
    return text(batches[0]?.cls);
  }, [breadcrumb, batches]);
  const targetBatch = useMemo(() => batches.find((b) => String(b?.cls) === String(standardForCurrent)) || batches[0] || null, [batches, standardForCurrent]);
  const subjectOptions = useMemo(() => [...new Set(batches.flatMap((b) => Array.isArray(b?.subjects) ? b.subjects : []).map(text).filter(Boolean))].sort(), [batches]);

  const openFolder = (id) => {
    setCurrentId(id);
    setFolderOpen(false);
    setFolderName("");
    setFileTitle("");
    setSelectedFile(null);
    setFileSubject(subjectOptions[0] || "");
    setError("");
  };

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return setError("Enter a folder name.");
    if (!currentId && !rootStandard) return setError("Select the class standard for a root folder.");
    if (!authId) return setError("Your session has expired. Please log in again.");
    setBusy(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("material_folders").insert({ name, parent_id: currentId || null, created_by: authId, access_standards: currentId ? [] : [rootStandard] });
      if (insertError) throw insertError;
      setFolderName("");
      setFolderOpen(false);
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return setSelectedFile(null);
    if (!allowedFile(file)) return setError("Unsupported file. Use PDF, PPT/PPTX, DOC/DOCX, PNG or JPG.");
    if (file.size > MAX) return setError("Maximum file size is 50 MB.");
    setError("");
    setSelectedFile(file);
    if (!fileTitle) setFileTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const upload = async () => {
    if (!current) return setError("Open a folder before uploading.");
    if (!targetBatch) return setError("No active class is assigned to you.");
    if (!selectedFile) return setError("Choose a file first.");
    if (!fileTitle.trim()) return setError("Enter a file title.");
    if (!fileSubject) return setError("Select a subject.");
    setBusy(true);
    setError("");
    let path = "";
    try {
      const randomId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uid();
      path = `teacher/${teacher.id}/${targetBatch.id}/${randomId}-${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("materials").upload(path, selectedFile, { upsert: false, contentType: selectedFile.type || "application/octet-stream" });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("materials").insert({ id: uid(), folder_id: current.id, batch_id: targetBatch.id, cls: targetBatch.cls || null, sec: targetBatch.sec || null, subject: fileSubject, title: fileTitle.trim(), name: selectedFile.name, desc: null, date: new Date().toISOString().slice(0, 10), tid: teacher.id, storage_path: path, file_size: selectedFile.size, mime_type: selectedFile.type || "application/octet-stream" });
      if (insertError) {
        await supabase.storage.from("materials").remove([path]);
        throw insertError;
      }
      setFileTitle("");
      setSelectedFile(null);
      await refresh();
    } catch (e) {
      if (path) await supabase.storage.from("materials").remove([path]).catch(() => {});
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const download = async (row) => {
    setError("");
    if (!row?.storage_path) return setError("This material has no attached file.");
    try {
      const { data, error: signedError } = await supabase.storage.from("materials").createSignedUrl(row.storage_path, 3600, { download: row.name || row.title || "material" });
      if (signedError) throw signedError;
      if (!data?.signedUrl) throw new Error("Could not create a download link.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(errText(e));
    }
  };

  const removeMaterial = async (row) => {
    if (!window.confirm(`Delete "${row?.name || row?.title || "this material"}"?`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.from("materials").delete().eq("id", row.id).eq("tid", teacher.id);
      if (deleteError) throw deleteError;
      if (row.storage_path) {
        const { error: storageError } = await supabase.storage.from("materials").remove([row.storage_path]);
        if (storageError) throw storageError;
      }
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const removeFolder = async (folder) => {
    if (String(folder?.created_by) !== String(authId)) return setError("Only folders created by you can be deleted.");
    const childCount = folders.filter((f) => String(f?.parent_id) === String(folder.id)).length;
    const fileCount = rows.filter((r) => String(r?.folder_id) === String(folder.id)).length;
    if (childCount || fileCount) return setError("Folder must be empty before it can be deleted.");
    if (!window.confirm(`Delete folder "${folder.name}"?`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.from("material_folders").delete().eq("id", folder.id);
      if (deleteError) throw deleteError;
      if (String(currentId) === String(folder.id)) setCurrentId(folder.parent_id || null);
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const folderCard = (folder) => (
    <Card key={folder.id} style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" onClick={() => openFolder(folder.id)} style={{ border: 0, background: "transparent", display: "flex", alignItems: "center", gap: 12, textAlign: "left", flex: 1, minWidth: 0, cursor: "pointer" }}>
        <span style={{ fontSize: 30, flexShrink: 0 }}>📁</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 850, color: C.text, overflowWrap: "anywhere" }}>{text(folder.name) || "Untitled folder"}</span>
          <span style={{ display: "block", fontSize: 11, color: C.sub, overflowWrap: "anywhere" }}>
            {standardsOf(folder.access_standards).length ? `Class ${standardsOf(folder.access_standards).join(", ")} · ` : "Inherited access · "}
            {folders.filter((x) => String(x?.parent_id) === String(folder.id)).length} folders · {rows.filter((x) => String(x?.folder_id) === String(folder.id)).length} files
          </span>
        </span>
      </button>
      {String(folder.created_by) === String(authId) && <button type="button" onClick={() => void removeFolder(folder)} disabled={busy} style={{ border: 0, background: "#FFF1F2", color: C.red, borderRadius: 9, padding: "7px 9px", flexShrink: 0 }}>🗑</button>}
    </Card>
  );

  const rootView = (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, color: C.text, fontSize: 16 }}>My material library</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Browse the same folder tree students see. Create class folders, subfolders and files from here.</div>
        <button type="button" onClick={() => { setFolderOpen(true); setRootStandard(standards[0] || ""); }} style={{ marginTop: 12, border: 0, borderRadius: 11, padding: "10px 13px", background: C.accent, color: "#fff", fontWeight: 800 }}>＋ Add folder</button>
      </Card>
      {folderOpen && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 9 }}>Create class folder</div>
          <input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Folder name" style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9, boxSizing: "border-box" }} />
          <select value={rootStandard} onChange={(e) => setRootStandard(e.target.value)} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9, boxSizing: "border-box" }}>
            {standards.map((s) => <option key={s} value={s}>Class {s}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}><button type="button" disabled={busy} onClick={() => void createFolder()} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: C.accent, color: "#fff", fontWeight: 800 }}>{busy ? "Creating…" : "Create folder"}</button><button type="button" onClick={() => setFolderOpen(false)} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: "#F1F5F9", fontWeight: 700 }}>Cancel</button></div>
        </Card>
      )}
      {rootFolders(folders).map(folderCard)}
      {!rootFolders(folders).length && <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>No material folders are available for your assigned classes yet.</Card>}
    </>
  );

  const folderView = (
    <>
      <button type="button" onClick={() => setCurrentId(current.parent_id || null)} style={{ border: 0, background: "transparent", color: C.accent, fontWeight: 800, padding: "3px 0 12px" }}>← Back</button>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", fontSize: 12, color: C.sub, marginBottom: 12 }}>
        <button type="button" onClick={() => setCurrentId(null)} style={{ border: 0, background: "transparent", color: C.accent, fontWeight: 700 }}>Materials</button>
        {breadcrumb.map((folder, index) => <React.Fragment key={folder.id}><span>›</span><button type="button" onClick={() => setCurrentId(folder.id)} style={{ border: 0, background: "transparent", color: index === breadcrumb.length - 1 ? C.text : C.accent, fontWeight: 700, overflowWrap: "anywhere" }}>{text(folder.name) || "Untitled"}</button></React.Fragment>)}
      </div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 30 }}>📁</div><div style={{ fontWeight: 900, fontSize: 18, color: C.text, overflowWrap: "anywhere" }}>{text(current.name) || "Untitled folder"}</div><div style={{ fontSize: 11, color: C.sub }}>{standardsOf(current.access_standards).length ? `Shared with Class ${standardsOf(current.access_standards).join(", ")}` : "Inherits parent access"}</div></div>
          <button type="button" onClick={() => setFolderOpen(true)} style={{ border: 0, borderRadius: 10, padding: "9px 11px", background: "#EEF2FF", color: C.accent, fontWeight: 800, flexShrink: 0 }}>＋ Folder</button>
        </div>
      </Card>
      {folderOpen && <Card style={{ marginBottom: 14 }}><div style={{ fontWeight: 800, marginBottom: 9 }}>Add subfolder</div><input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Subfolder name" style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9, boxSizing: "border-box" }} /><div style={{ display: "flex", gap: 8 }}><button type="button" disabled={busy} onClick={() => void createFolder()} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: C.accent, color: "#fff", fontWeight: 800 }}>Create subfolder</button><button type="button" onClick={() => setFolderOpen(false)} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: "#F1F5F9", fontWeight: 700 }}>Cancel</button></div></Card>}
      {children.map(folderCard)}
      <Card style={{ marginTop: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 900, color: C.text, marginBottom: 9 }}>Add file</div>
        <select value={fileSubject} onChange={(e) => setFileSubject(e.target.value)} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9, boxSizing: "border-box" }}><option value="">Select subject</option>{subjectOptions.map((s) => <option key={s}>{s}</option>)}</select>
        <input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} placeholder="File title" style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9, boxSizing: "border-box" }} />
        <input type="file" accept={ACCEPT} disabled={busy} onChange={chooseFile} style={{ width: "100%", padding: 8, borderRadius: 10, border: `1px dashed ${C.border}`, boxSizing: "border-box" }} />
        <div style={{ fontSize: 11, color: C.sub, marginTop: 6, overflowWrap: "anywhere" }}>{selectedFile ? `📎 ${selectedFile.name} · ${sizeLabel(selectedFile.size)}` : "PDF, PPT/PPTX, DOC/DOCX, PNG/JPG · max 50 MB"}</div>
        <button type="button" disabled={busy || !selectedFile} onClick={() => void upload()} style={{ marginTop: 10, width: "100%", padding: 11, border: 0, borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 800 }}>{busy ? "Working…" : "Upload file"}</button>
      </Card>
      <div style={{ fontWeight: 900, color: C.text, marginBottom: 9 }}>Files ({materials.length})</div>
      {materials.map((m) => <Card key={m.id} style={{ marginBottom: 9 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div style={{ minWidth: 0, flex: 1 }}><Badge label={m.subject || "Material"} /><div style={{ fontWeight: 800, color: C.text, marginTop: 5, overflowWrap: "anywhere", wordBreak: "break-word" }}>{text(m.title) || text(m.name) || "Untitled material"}</div><div style={{ fontSize: 11, color: C.sub, marginTop: 3, overflowWrap: "anywhere", wordBreak: "break-word" }}>{m.name || "File"}{m.file_size ? ` · ${sizeLabel(m.file_size)}` : ""}</div></div><div style={{ display: "flex", gap: 6, flexShrink: 0 }}><button type="button" onClick={() => void download(m)} style={{ border: 0, borderRadius: 9, padding: "7px 9px", background: "#EEF2FF", color: C.accent }}>↗</button>{String(m.tid) === String(teacher.id) && <button type="button" onClick={() => void removeMaterial(m)} disabled={busy} style={{ border: 0, borderRadius: 9, padding: "7px 9px", background: "#FFF1F2", color: C.red }}>🗑</button>}</div></div></Card>)}
      {!materials.length && !children.length && <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>This folder is empty. Add a subfolder or upload the first file.</Card>}
    </>
  );

  return <div><Sec title="Study Materials 📚" />{error && <Card style={{ background: "#FFF1F2", color: C.red, marginBottom: 12, overflowWrap: "anywhere" }}>{error}</Card>}{loading ? <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>Loading your material library…</Card> : current ? folderView : rootView}</div>;
}

export function T6Materials(props) {
  return <MaterialsErrorBoundary><TeacherMaterialsManager {...props} /></MaterialsErrorBoundary>;
}
