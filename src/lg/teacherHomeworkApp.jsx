import React, { useEffect, useMemo, useState } from "react";
import { C, uid } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { optimizePdfFile } from "@/lg/fileOptimizer";
import { Card, Badge, Sec, GBtn, Shell, AppBar } from "@/lg/ui";
import { NotifPanel } from "@/lg/panels";
import { THHome, THSchedule, THAttendance } from "@/lg/teacher";
import { loadTeacherBatches } from "@/lg/teacherScope";
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
  const [processing, setProcessing] = useState("");
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
    setProcessing("");
    setError("");
    let path = "";
    const homeworkId = uid();
    let inserted = false;
    let storageUploaded = false;

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

      let uploadFile = form.file;
      if (uploadFile?.type === "application/pdf" || uploadFile?.name.toLowerCase().endsWith(".pdf")) {
        const optimized = await optimizePdfFile(uploadFile, setProcessing);
        uploadFile = optimized.file;
        if (optimized.optimized) setProcessing(`Optimized ${optimized.savingsPercent}% smaller (${(optimized.originalSize / 1048576).toFixed(1)} → ${(optimized.optimizedSize / 1048576).toFixed(1)} MB)`);
      }

      if (uploadFile) {
        const safe = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        path = `teacher/${teacher.id}/${selected.id}/${crypto.randomUUID()}-${safe}`;
        const { error: insertError } = await supabase.from("homework").insert({
          ...base,
          storage_path: path,
          pdfname: uploadFile.name,
          file_size: uploadFile.size,
          mime_type: uploadFile.type || "application/octet-stream",
        });
        if (insertError) throw insertError;
        inserted = true;

        const { error: uploadError } = await supabase.storage
          .from("homework")
          .upload(path, uploadFile, { upsert: false, contentType: uploadFile.type || "application/octet-stream" });
        if (uploadError) {
          await supabase.storage.from("homework").remove([path]).catch(() => {});
          await supabase.from("homework").delete().eq("id", homeworkId).eq("tid", teacher.id).catch(() => {});
          inserted = false;
          storageUploaded = false;
          throw uploadError;
        }
        storageUploaded = true;
      } else {
        const { error: insertError } = await supabase.from("homework").insert(base);
        if (insertError) throw insertError;
        inserted = true;
      }

      setForm((current) => ({ ...current, desc: "", due: "", file: null }));
      await refresh();
    } catch (e) {
      // Only compensate a file that was actually uploaded. A successful
      // operation followed by a refresh error must not be rolled back.
      if (storageUploaded && path) {
        await supabase.storage.from("homework").remove([path]).catch(() => {});
        if (inserted) {
          await supabase.from("homework").delete().eq("id", homeworkId).eq("tid", teacher.id).catch(() => {});
        }
      }
      setError(errText(e));
    } finally {
      setSaving(false);
      setProcessing("");
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Delete this homework?")) return;
    setError("");
    if (row.storage_path) {
      const { error: storageError } = await supabase.storage.from("homework").remove([row.storage_path]);
      if (storageError) {
        setError(errText(storageError));
        return;
      }
    }
    const { error: deleteError } = await supabase.from("homework").delete().eq("id", row.id).eq("tid", teacher.id);
    if (deleteError) {
      setError(errText(deleteError));
      return;
    }
    await refresh();
  };

  return (
    <div>
      <Sec title="Homework 📝" />
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: C.text, marginBottom: 10 }}>Assign to my class</div>
        {error && <div style={{ color: C.red, background: "#FFF1F2", padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {processing && <div style={{ color: C.accent, background: "#EEF2FF", padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 10, fontWeight: 700 }}>{processing}</div>}
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