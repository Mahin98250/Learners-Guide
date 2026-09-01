import React, { useEffect, useMemo, useState } from "react";
import { C, uid } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { Card, Sec } from "@/lg/ui";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg";

const isAllowedFile = (file) => Boolean(file && /\.(pdf|pptx?|docx?|png|jpe?g)$/i.test(file.name));
const clean = (value) => String(value ?? "").trim();
const errorText = (error) => error instanceof Error ? error.message : (error?.message || "Something went wrong. Please try again.");
const fileSize = (bytes) => {
  if (!bytes) return "";
  const mb = bytes / 1048576;
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
};
const standardsOf = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];
const sortByName = (items) => [...items].sort((a, b) => clean(a?.name).localeCompare(clean(b?.name), undefined, { sensitivity: "base", numeric: true }));

async function loadTeacherBatches(teacherId) {
  if (!teacherId) return [];
  const { data: entries, error: entriesError } = await supabase
    .from("timetable_entries")
    .select("batch_id,subject_name")
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (entriesError) throw entriesError;

  const ids = [...new Set((entries || []).map((entry) => entry?.batch_id).filter(Boolean))];
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
    .filter((batch) => batch?.status == null || batch.status === "active")
    .map((batch) => ({
      ...batch,
      subjects: [...(subjects.get(String(batch.id)) || new Set())].sort(),
    }));
}

function pathForFolder(folderId, folders) {
  const result = [];
  let current = folders.find((folder) => String(folder.id) === String(folderId));
  let guard = 0;
  while (current && guard++ < 50) {
    result.unshift(current);
    current = current.parent_id
      ? folders.find((folder) => String(folder.id) === String(current.parent_id))
      : null;
  }
  return result;
}

function Button({ children, onClick, disabled = false, secondary = false, danger = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        borderRadius: 10,
        padding: "9px 12px",
        background: danger ? "#FFF1F2" : secondary ? "#F1F5F9" : C.accent,
        color: danger ? C.red : secondary ? C.text : "#fff",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function T6Materials({ teacher }) {
  const [folders, setFolders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [batches, setBatches] = useState([]);
  const [authId, setAuthId] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderStandard, setNewFolderStandard] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileSubject, setFileSubject] = useState("");

  const refresh = async () => {
    if (!teacher?.id) return;
    setLoading(true);
    setError("");
    try {
      const userResult = await supabase.auth.getUser();
      if (userResult.error) throw userResult.error;
      if (!userResult.data?.user) throw new Error("Your session has expired. Please log in again.");

      const [teacherBatches, folderResult, materialResult] = await Promise.all([
        loadTeacherBatches(teacher.id),
        supabase
          .from("material_folders")
          .select("id,name,parent_id,created_by,created_at,access_standards")
          .order("created_at", { ascending: true }),
        supabase
          .from("materials")
          .select("id,title,name,folder_id,batch_id,subject,desc,date,tid,storage_path,file_size,mime_type,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (folderResult.error) throw folderResult.error;
      if (materialResult.error) throw materialResult.error;

      setAuthId(userResult.data.user.id);
      setBatches(Array.isArray(teacherBatches) ? teacherBatches : []);
      setFolders(Array.isArray(folderResult.data) ? folderResult.data : []);
      setMaterials(Array.isArray(materialResult.data) ? materialResult.data : []);
    } catch (error) {
      console.error("Teacher materials load failed", error);
      setError(errorText(error));
      setFolders([]);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [teacher?.id]);

  const currentFolder = useMemo(
    () => currentId ? folders.find((folder) => String(folder.id) === String(currentId)) || null : null,
    [folders, currentId],
  );

  const children = useMemo(
    () => sortByName(folders.filter((folder) => String(folder.parent_id || "") === String(currentId || ""))),
    [folders, currentId],
  );

  const currentMaterials = useMemo(
    () => materials.filter((material) => String(material.folder_id || "") === String(currentId || "")),
    [materials, currentId],
  );

  const breadcrumb = useMemo(
    () => currentFolder ? pathForFolder(currentFolder.id, folders) : [],
    [currentFolder, folders],
  );

  const assignedStandards = useMemo(
    () => [...new Set(batches.map((batch) => clean(batch.cls)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [batches],
  );

  const currentStandard = useMemo(() => {
    for (const folder of breadcrumb) {
      const access = standardsOf(folder.access_standards);
      if (access.length) return access[0];
    }
    return clean(batches[0]?.cls);
  }, [breadcrumb, batches]);

  const targetBatch = useMemo(
    () => batches.find((batch) => String(batch.cls) === String(currentStandard)) || batches[0] || null,
    [batches, currentStandard],
  );

  const subjectOptions = useMemo(
    () => [...new Set(batches.flatMap((batch) => Array.isArray(batch.subjects) ? batch.subjects : []))]
      .map(clean)
      .filter(Boolean)
      .sort(),
    [batches],
  );

  const rootFolders = useMemo(
    () => sortByName(folders.filter((folder) => !folder.parent_id)),
    [folders],
  );

  const openFolder = (folderId) => {
    setCurrentId(folderId);
    setError("");
    setNewFolderOpen(false);
    setSelectedFile(null);
    setFileTitle("");
    setFileSubject(subjectOptions[0] || "");
  };

  const goToParent = () => {
    if (!currentFolder) return;
    setCurrentId(currentFolder.parent_id || null);
    setError("");
    setSelectedFile(null);
  };

  const createFolder = async () => {
    const name = clean(newFolderName);
    const standard = currentId ? null : clean(newFolderStandard);
    if (!name) return setError("Enter a folder name.");
    if (!currentId && !standard) return setError("Select the class for this folder.");
    if (!authId) return setError("Your session has expired. Please log in again.");

    setBusy(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("material_folders").insert({
        name,
        parent_id: currentId || null,
        created_by: authId,
        access_standards: currentId ? [] : [standard],
      });
      if (insertError) throw insertError;
      setNewFolderName("");
      setNewFolderOpen(false);
      await refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isAllowedFile(file)) {
      setSelectedFile(null);
      return setError("Unsupported file. Use PDF, PPT/PPTX, DOC/DOCX, PNG or JPG.");
    }
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      return setError("Maximum file size is 50 MB.");
    }
    setError("");
    setSelectedFile(file);
    setFileTitle((old) => old || file.name.replace(/\.[^.]+$/, ""));
  };

  const upload = async () => {
    if (!currentFolder) return setError("Open a folder before uploading.");
    if (!targetBatch) return setError("No active class is assigned to you.");
    if (!selectedFile) return setError("Choose a file first.");
    if (!clean(fileTitle)) return setError("Enter a file title.");
    if (!clean(fileSubject)) return setError("Select a subject.");

    setBusy(true);
    setError("");
    let storagePath = "";
    try {
      const randomId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uid();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `teacher/${teacher.id}/${targetBatch.id}/${randomId}-${safeName}`;

      const { error: storageError } = await supabase.storage
        .from("materials")
        .upload(storagePath, selectedFile, {
          upsert: false,
          contentType: selectedFile.type || "application/octet-stream",
        });
      if (storageError) throw storageError;

      const { error: insertError } = await supabase.from("materials").insert({
        id: uid(),
        folder_id: currentFolder.id,
        batch_id: targetBatch.id,
        cls: targetBatch.cls || null,
        sec: targetBatch.sec || null,
        subject: clean(fileSubject),
        title: clean(fileTitle),
        name: selectedFile.name,
        desc: null,
        date: new Date().toISOString().slice(0, 10),
        tid: teacher.id,
        storage_path: storagePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type || "application/octet-stream",
      });
      if (insertError) throw insertError;

      setSelectedFile(null);
      setFileTitle("");
      await refresh();
    } catch (error) {
      if (storagePath) {
        await supabase.storage.from("materials").remove([storagePath]).catch(() => {});
      }
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const download = async (material) => {
    if (!material?.storage_path) return setError("This material has no attached file.");
    setError("");
    try {
      const { data, error: signedError } = await supabase.storage
        .from("materials")
        .createSignedUrl(material.storage_path, 3600, {
          download: material.name || material.title || "material",
        });
      if (signedError) throw signedError;
      if (!data?.signedUrl) throw new Error("Could not create a download link.");
      window.location.assign(data.signedUrl);
    } catch (error) {
      setError(errorText(error));
    }
  };

  const deleteMaterial = async (material) => {
    if (!window.confirm(`Delete "${material?.name || material?.title || "this material"}"?`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("materials")
        .delete()
        .eq("id", material.id)
        .eq("tid", teacher.id);
      if (deleteError) throw deleteError;
      if (material.storage_path) {
        const { error: storageError } = await supabase.storage.from("materials").remove([material.storage_path]);
        if (storageError) throw storageError;
      }
      await refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteFolder = async (folder) => {
    if (String(folder?.created_by) !== String(authId)) return setError("Only folders created by you can be deleted.");
    const hasChildren = folders.some((item) => String(item.parent_id) === String(folder.id));
    const hasFiles = materials.some((item) => String(item.folder_id) === String(folder.id));
    if (hasChildren || hasFiles) return setError("Folder must be empty before it can be deleted.");
    if (!window.confirm(`Delete folder "${folder.name}"?`)) return;

    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("material_folders")
        .delete()
        .eq("id", folder.id);
      if (deleteError) throw deleteError;
      if (String(currentId) === String(folder.id)) setCurrentId(folder.parent_id || null);
      await refresh();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const renderFolder = (folder) => {
    const childCount = folders.filter((item) => String(item.parent_id) === String(folder.id)).length;
    const fileCount = materials.filter((item) => String(item.folder_id) === String(folder.id)).length;
    const standards = standardsOf(folder.access_standards);
    return (
      <Card key={folder.id} style={{ marginBottom: 10, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 14 }}>
          <button
            type="button"
            onClick={() => openFolder(folder.id)}
            style={{ border: 0, background: "transparent", display: "flex", alignItems: "center", gap: 11, textAlign: "left", flex: 1, minWidth: 0, padding: 0, cursor: "pointer" }}
          >
            <span style={{ fontSize: 28, flexShrink: 0 }}>📁</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 900, color: C.text, overflowWrap: "anywhere" }}>{clean(folder.name) || "Untitled folder"}</span>
              <span style={{ display: "block", fontSize: 11, color: C.sub, marginTop: 3, overflowWrap: "anywhere" }}>
                {standards.length ? `Class ${standards.join(", ")} · ` : "Inherited access · "}{childCount} folders · {fileCount} files
              </span>
            </span>
          </button>
          {String(folder.created_by) === String(authId) && <Button danger disabled={busy} onClick={() => void deleteFolder(folder)}>🗑</Button>}
        </div>
      </Card>
    );
  };

  const folderForm = (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 9 }}>{currentFolder ? "Create subfolder" : "Create class folder"}</div>
      <input
        value={newFolderName}
        onChange={(event) => setNewFolderName(event.target.value)}
        placeholder={currentFolder ? "Subfolder name" : "Folder name"}
        style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }}
      />
      {!currentFolder && (
        <select
          value={newFolderStandard}
          onChange={(event) => setNewFolderStandard(event.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }}
        >
          <option value="">Select class</option>
          {assignedStandards.map((standard) => <option key={standard} value={standard}>Class {standard}</option>)}
        </select>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button disabled={busy} onClick={() => void createFolder()}>{busy ? "Creating…" : "Create folder"}</Button>
        <Button secondary onClick={() => setNewFolderOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );

  if (loading) {
    return <div><Sec title="Study Materials 📚"/><Card style={{ padding: 24, textAlign: "center", color: C.sub }}>Loading your material library…</Card></div>;
  }

  return (
    <div style={{ minWidth: 0, width: "100%" }}>
      <Sec title="Study Materials 📚"/>
      {error && (
        <Card style={{ marginBottom: 12, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 13, overflowWrap: "anywhere" }}>{error}</div>
          <Button style={{ marginTop: 9 }} onClick={() => void refresh()}>Reload materials</Button>
        </Card>
      )}

      {!currentFolder ? (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>My material library</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>Manage the class folders and files available to your students.</div>
            <Button style={{ marginTop: 12 }} onClick={() => { setNewFolderStandard(assignedStandards[0] || ""); setNewFolderOpen(true); }}>＋ Add folder</Button>
          </Card>
          {newFolderOpen && folderForm}
          {rootFolders.map(renderFolder)}
          {!rootFolders.length && <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>No material folders are available for your assigned classes yet.</Card>}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, minWidth: 0 }}>
            <Button secondary onClick={goToParent}>← Back</Button>
            <div style={{ minWidth: 0, flex: 1, fontSize: 12, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {breadcrumb.map((folder) => clean(folder.name)).join(" / ")}
            </div>
          </div>

          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 17, overflowWrap: "anywhere" }}>{clean(currentFolder.name) || "Folder"}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Class {currentStandard || "—"} · {children.length} folders · {currentMaterials.length} files</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <Button onClick={() => setNewFolderOpen(true)}>＋ Subfolder</Button>
              <label style={{ display: "inline-flex", alignItems: "center", borderRadius: 10, padding: "9px 12px", background: "#F1F5F9", color: C.text, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
                ＋ Choose file
                <input type="file" accept={ACCEPT} disabled={busy} onChange={chooseFile} style={{ display: "none" }}/>
              </label>
            </div>
          </Card>

          {newFolderOpen && folderForm}

          {selectedFile && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Upload material</div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 9, overflowWrap: "anywhere" }}>📎 {selectedFile.name} · {fileSize(selectedFile.size)}</div>
              <input value={fileTitle} onChange={(event) => setFileTitle(event.target.value)} placeholder="Material title" style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }}/>
              <select value={fileSubject} onChange={(event) => setFileSubject(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }}>
                <option value="">Select subject</option>
                {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button disabled={busy} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload material"}</Button>
                <Button secondary onClick={() => { setSelectedFile(null); setFileTitle(""); }}>Cancel</Button>
              </div>
            </Card>
          )}

          {children.map(renderFolder)}

          {currentMaterials.map((material) => (
            <Card key={material.id} style={{ marginBottom: 10, padding: 13, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, color: C.text, overflowWrap: "anywhere", wordBreak: "break-word" }}>{clean(material.title) || clean(material.name) || "Untitled material"}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 4, overflowWrap: "anywhere", wordBreak: "break-word" }}>{clean(material.name)}{material.subject ? ` · ${material.subject}` : ""}</div>
                  {material.file_size ? <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>{fileSize(material.file_size)}</div> : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <Button disabled={busy} onClick={() => void download(material)} style={{ padding: "7px 9px" }}>Download</Button>
                  {String(material.tid) === String(teacher.id) && <Button danger disabled={busy} onClick={() => void deleteMaterial(material)} style={{ padding: "7px 9px" }}>Delete</Button>}
                </div>
              </div>
            </Card>
          ))}

          {!children.length && !currentMaterials.length && <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>This folder is empty.</Card>}
        </>
      )}
    </div>
  );
}
