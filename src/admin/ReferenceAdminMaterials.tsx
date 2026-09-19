import { useRef, useState } from "react";
import { addR, delR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { compressFile } from "@/lg/fileCompression";
import { A, subjects, gradeOptions, sectionOptions, type Row } from "./ReferenceAdminShared";
import { Btn, Field, Modal } from "./ReferenceAdminControls";

type MaterialForm = {
  title: string;
  subject: string;
  cls: string;
  sec: string;
  desc: string;
  date: string;
};

export function Materials({ data, reload }: { data: Row[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    ref = useRef<HTMLInputElement>(null),
    [form, setForm] = useState<MaterialForm>({
      title: "",
      subject: "Mathematics",
      cls: "10",
      sec: "A",
      desc: "",
      date: new Date().toISOString().slice(0, 10),
    });
  const save = async () => {
    const f = ref.current?.files?.[0];
    if (!f) return alert("Select a file.");
    if (f.size > 50 * 1024 * 1024) return alert("Maximum file size is 50 MB.");
    setBusy(true);
    try {
      const compressed = await compressFile(f);
      const uploadFile = compressed.file;
      const path = `1789832695170-${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("materials")
        .upload(path, uploadFile, { upsert: false, contentType: uploadFile.type || f.type });
      if (error) throw error;
      await addR("materials", {
        id: "m" + Date.now(),
        ...form,
        pdfname: uploadFile.name,
        storage_path: path,
        pdfurl: null,
        size: uploadFile.size,
      });
      setOpen(false);
      setForm({
        title: "",
        subject: "Mathematics",
        cls: "10",
        sec: "A",
        desc: "",
        date: new Date().toISOString().slice(0, 10),
      });
      if (ref.current) ref.current.value = "";
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (r: Row) => {
    try {
      if (r.storage_path) {
        const { error: storageError } = await supabase.storage.from("materials").remove([r.storage_path]);
        if (storageError) throw storageError;
      }
      await delR("materials", r.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to delete material.");
    }
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ color: A.sub, fontSize: 12 }}>
          {data.length} materials · maximum 50 MB per file
        </div>
        <Btn onClick={() => setOpen(true)}>＋ Upload Material</Btn>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {data.map((m) => (
          <div className="card" style={{ padding: 20 }} key={m.id}>
            <div style={{ fontSize: 26 }}>📚</div>
            <h3 style={{ marginBottom: 5 }}>{m.title}</h3>
            <div style={{ fontSize: 12, color: A.sub }}>
              {m.subject} · Class {m.cls}-{m.sec}
            </div>
            <p style={{ fontSize: 12, color: A.sub }}>{m.desc}</p>
            <div style={{ fontSize: 11, color: A.sub }}>
              {m.pdfname} · {m.size ? Math.round((m.size / 1024 / 1024) * 10) / 10 : 0} MB
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {m.storage_path && (
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    const { data, error } = await supabase.storage.from("materials").createSignedUrl(m.storage_path, 300);
                    if (error || !data?.signedUrl) {
                      alert(error?.message || "Unable to open this material.");
                      return;
                    }
                    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                  }}
                  style={{ background: A.accent, color: "#fff", textDecoration: "none" }}
                >
                  Open
                </button>
              )}
              <Btn onClick={() => void remove(m)} color={A.red}>
                🗑
              </Btn>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="📁 Upload Study Material" onClose={() => setOpen(false)} wide>
          <div
            style={{
              background: "#eff6ff",
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            Maximum <b>50 MB per file</b>. Files are stored in Supabase Storage.
          </div>
          <Field
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            required
          />
          <Field
            label="Subject"
            value={form.subject}
            onChange={(v) => setForm({ ...form, subject: v })}
            options={subjects}
          />
          <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Class"
              value={form.cls}
              onChange={(v) => setForm({ ...form, cls: v })}
              options={gradeOptions}
            />
            <Field
              label="Section"
              value={form.sec}
              onChange={(v) => setForm({ ...form, sec: v })}
              options={sectionOptions}
            />
          </div>
          <Field
            label="Description"
            value={form.desc}
            onChange={(v) => setForm({ ...form, desc: v })}
            type="textarea"
          />
          <div className="field">
            <label>File</label>
            <input
              ref={ref}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={save} disabled={busy}>
              {busy ? "Uploading…" : "Upload to Supabase"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
