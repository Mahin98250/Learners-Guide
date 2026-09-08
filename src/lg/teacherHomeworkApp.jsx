import React, { useEffect, useMemo, useState } from "react";
import { C, uid } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { Card, Badge, Sec, GBtn, Shell, AppBar } from "@/lg/ui";
import { NotifPanel } from "@/lg/panels";
import { THHome, THSchedule, THAttendance } from "@/lg/teacher";
import { T6Materials } from "@/lg/teacherWorkflows";
import { TTests, TTestResults } from "@/lg/teacherTests";
import { TeacherAnnouncements } from "@/lg/TeacherAnnouncements";

const todayISO = () => new Date().toISOString().slice(0, 10);
const errText = (e) => e instanceof Error ? e.message : (e?.message || "Something went wrong. Please try again.");

async function loadTeacherProfile(teacherId) {
  const { data, error } = await supabase
    .from("teachers")
    .select("id,name,tid,subject,phone,classes,status")
    .eq("id", teacherId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadTeacherBatches(teacherId) {
  const { data: entries, error } = await supabase
    .from("timetable_entries")
    .select("batch_id,subject_name")
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (error) throw error;

  const ids = [...new Set((entries || []).map((x) => x.batch_id).filter(Boolean))];
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
    if (entry.subject_name) subjects.get(key).add(entry.subject_name);
  }

  return (batches || [])
    .filter((batch) => batch.status == null || batch.status === "active")
    .map((batch) => ({
      ...batch,
      subjects: [...(subjects.get(String(batch.id)) || new Set())],
    }));
}

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg";
const TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const validFile = (file) => Boolean(file && ((file.type && TYPES.has(file.type)) || /\.(pdf|pptx?|docx?|png|jpe?g)$/i.test(file.name)));
const fileLabel = (file) => {
  if (!file) return "No file selected";
  const mb = file.size / 1048576;
  return `${file.name} · ${mb < 1 ? `${(file.size / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`}`;
};

export function T5HomeworkWithFiles({ teacher }) {
  const [batches, setBatches] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ batchId: "", subject: "", desc: "", due: "", file: null });

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [bs, hw] = await Promise.all([
        loadTeacherBatches(teacher?.id),
        supabase
          .from("homework")
          .select("id,batch_id,cls,sec,subject,desc,given,due,tid,pdfname,storage_path,file_size,mime_type,created_at")
          .eq("tid", teacher?.id)
          .order("created_at", { ascending: false }),
      ]);
      if (hw.error) throw hw.error;
      setBatches(bs);
      setRows(hw.data || []);
      setForm((current) => ({
        ...current,
        batchId: current.batchId && bs.some((b) => String(b.id) === String(current.batchId)) ? current.batchId : (bs[0]?.id || ""),
        subject: current.subject && bs.some((b) => b.subjects.includes(current.subject)) ? current.subject : (bs[0]?.subjects?.[0] || ""),
      }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacher?.id) void refresh();
  }, [teacher?.id]);

  const selected = useMemo(
    () => batches.find((batch) => String(batch.id) === String(form.batchId)),
    [batches, form.batchId],
  );

  const chooseFile = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      setForm((current) => ({ ...current, file: null }));
      return;
    }
    if (!validFile(file)) {
      setError("Unsupported file. Use PDF, PPT/PPTX, DOC/DOCX, PNG or JPG.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Maximum attachment size is 50 MB.");
      return;
    }
    setError("");
    setForm((current) => ({ ...current, file }));
  };

  const save = async () => {
    if (!selected || !form.subject || !form.desc.trim() || !form.due) {
      setError("Select a class and subject, then enter homework and a due date.");
      return;
    }
    if (!selected.subjects.includes(form.subject)) {
      setError("That subject is not assigned to you for this class.");
      return;
    }
    if (form.file && !validFile(form.file)) {
      setError("Unsupported attachment type.");
      return;
    }

    setSaving(true);
    setError("");
    let path = "";
    const homeworkId = uid();
    let inserted = false;

    try {
      const base = {
        id: homeworkId,
        batch_id: selected.id,
        cls: selected.cls || "",
        sec: selected.sec || "",
        subject: form.subject,
        desc: form.desc.trim(),
        given: todayISO(),
        due: form.due,
        tid: teacher.id,
      };

      if (form.file) {
        const safe = form.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        path = `teacher/${teacher.id}/${selected.id}/${crypto.randomUUID()}-${safe}`;
        const { error: insertError } = await supabase.from("homework").insert({
          ...base,
          storage_path: path,
          pdfname: form.file.name,
          file_size: form.file.size,
          mime_type: form.file.type || "application/octet-stream",
        });
        if (insertError) throw insertError;
        inserted = true;

        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(path, form.file, { upsert: false, contentType: form.file.type || "application/octet-stream" });
        if (uploadError) {
          await supabase.from("homework").delete().eq("id", homeworkId).eq("tid", teacher.id);
          throw uploadError;
        }
      } else {
        const { error: insertError } = await supabase.from("homework").insert(base);
        if (insertError) throw insertError;
        inserted = true;
      }

      setForm((current) => ({ ...current, desc: "", due: "", file: null }));
      await refresh();
    } catch (e) {
      if (path && !inserted) await supabase.storage.from("homework").remove([path]);
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Delete this homework?")) return;
    setError("");
    const { error: deleteError } = await supabase.from("homework").delete().eq("id", row.id).eq("tid", teacher.id);
    if (deleteError) {
      setError(errText(deleteError));
      return;
    }
    if (row.storage_path) {
      const { error: storageError } = await supabase.storage.from("homework").remove([row.storage_path]);
      if (storageError) setError(errText(storageError));
    }
    await refresh();
  };

  return (
    <div>
      <Sec title="Homework 📝" />
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: C.text, marginBottom: 10 }}>Assign to my class</div>
        {error && <div style={{ color: C.red, background: "#FFF1F2", padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {loading ? (
          <div style={{ color: C.sub, fontSize: 13 }}>Loading your classes…</div>
        ) : batches.length === 0 ? (
          <div style={{ color: C.sub, fontSize: 13 }}>No active classes are assigned to you yet.</div>
        ) : (
          <>
            <select value={form.batchId} onChange={(event) => {
              const batch = batches.find((item) => String(item.id) === event.target.value);
              setForm((current) => ({ ...current, batchId: event.target.value, subject: batch?.subjects?.[0] || "" }));
            }} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }}>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · Class {batch.cls || "-"}-{batch.sec || "-"}</option>)}
            </select>
            <select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }}>
              {selected?.subjects?.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
            <textarea value={form.desc} onChange={(event) => setForm({ ...form, desc: event.target.value })} placeholder="Homework description" rows={3} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9, resize: "vertical" }} />
            <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 9 }} />
            <input type="file" accept={ACCEPT} disabled={saving} onChange={chooseFile} style={{ width: "100%", padding: 8, borderRadius: 10, border: `1px dashed ${C.border}`, marginBottom: 6 }} />
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>{form.file ? `📎 ${fileLabel(form.file)}` : "Optional attachment · PDF, PPT/PPTX, DOC/DOCX, PNG/JPG · max 50 MB"}</div>
            <GBtn ch={saving ? "Saving…" : "Assign Homework ✓"} onClick={save} />
          </>
        )}
      </Card>
      <Sec title={`My Homework (${rows.length})`} />
      {rows.map((homework) => (
        <Card key={homework.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>
              <Badge label={homework.subject} />
              <div style={{ fontWeight: 700, color: C.text, marginTop: 5 }}>{homework.desc}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>Due: {homework.due}</div>
              {homework.pdfname && <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>📎 {homework.pdfname}</div>}
            </div>
            <button onClick={() => void remove(homework)} style={{ border: 0, borderRadius: 9, padding: "6px 9px", background: "#FFF1F2", color: C.red, cursor: "pointer" }}>🗑</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TeacherAppWithHomeworkFiles({ user, onLogout }) {
  const [tab, setTab] = useState("home");
  const [showNotif, setShowNotif] = useState(false);
  const [teacher, setTeacher] = useState({ id: user.ref, name: user.name, subject: "", classes: [] });

  useEffect(() => {
    let alive = true;
    void loadTeacherProfile(user.ref)
      .then((profile) => { if (alive && profile) setTeacher(profile); })
      .catch((e) => console.error("Unable to load teacher profile:", e));
    return () => { alive = false; };
  }, [user.ref]);

  const tabs = [
    { key: "home", icon: "🏠", label: "Home" },
    { key: "schedule", icon: "📅", label: "Schedule" },
    { key: "attendance", icon: "✅", label: "Attend." },
    { key: "homework", icon: "📝", label: "HW" },
    { key: "tests", icon: "📋", label: "Tests" },
    { key: "materials", icon: "📚", label: "Notes" },
    { key: "announcements", icon: "📢", label: "News" },
  ];

  const content = tab === "home"
    ? <THHome teacher={teacher} />
    : tab === "schedule"
      ? <THSchedule teacher={teacher} />
      : tab === "attendance"
        ? <THAttendance teacher={teacher} />
        : tab === "homework"
          ? <T5HomeworkWithFiles teacher={teacher} />
          : tab === "tests"
            ? <><TTests teacher={teacher} /><TTestResults teacher={teacher} /></>
            : tab === "announcements"
              ? <TeacherAnnouncements teacher={teacher} />
              : <T6Materials teacher={teacher} />;

  return (
    <>
      <Shell header={<AppBar name={user.name} role="teacher" userId={user.id} onLogout={onLogout} onNotif={() => setShowNotif(true)} />} tabs={tabs} activeTab={tab} setTab={setTab}>
        {content}
      </Shell>
      {showNotif && <NotifPanel userId={user.id} onClose={() => setShowNotif(false)} />}
    </>
  );
}
