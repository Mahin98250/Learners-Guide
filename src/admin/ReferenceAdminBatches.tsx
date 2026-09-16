import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { A, subjects, days, slots, gradeOptions, sectionOptions, type Row, type UserRow, type StudentRow, type TeacherRow, type PageKey, type ResultRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

function Batches({ data, reload }: { data: Row[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState<any>({
      name: "",
      cls: "10",
      sec: "A",
      days: [],
      subjects: [],
      status: "active",
      description: "",
    }),
    [tab, setTab] = useState<"batches" | "timetable">("batches"),
    [tt, setTt] = useState<Row[]>([]);
  const load = async () => setTt(await gdb("timetable"));
  useEffect(() => {
    void load();
  }, []);
  const toggle = (key: string, v: string) =>
    setForm((f: any) => ({
      ...f,
      [key]: (f[key] || []).includes(v)
        ? f[key].filter((x: string) => x !== v)
        : [...(f[key] || []), v],
    }));
  const save = async () => {
    await addR("batches", { id: "b" + Date.now(), ...form });
    setOpen(false);
    reload();
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Btn onClick={() => setTab("batches")} outline={tab !== "batches"}>
          👥 Batches ({data.length})
        </Btn>
        <Btn onClick={() => setTab("timetable")} outline={tab !== "timetable"}>
          📅 Timetable ({tt.length})
        </Btn>
      </div>
      {tab === "batches" ? (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <Btn onClick={() => setOpen(true)}>＋ Create Batch</Btn>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}
          >
            {data.map((b) => (
              <div className="card" style={{ padding: 20 }} key={b.id}>
                <h3 style={{ marginTop: 0 }}>{b.name}</h3>
                <div style={{ color: A.sub, fontSize: 12 }}>
                  Class {b.cls}-{b.sec} · {b.status}
                </div>
                <p style={{ fontSize: 12 }}>{b.description}</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(b.days || []).map((x: string) => (
                    <Badge key={x} v={x} />
                  ))}
                  {(b.subjects || []).map((x: string) => (
                    <Badge key={x} v={x} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {open && (
            <Modal title="Create Batch" onClose={() => setOpen(false)} wide>
              <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field
                  label="Batch Name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  required
                />
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
                <Field
                  label="Status"
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={["active", "inactive"]}
                />
              </div>
              <b>Class Days</b>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 16px" }}>
                {days.map((x) => (
                  <Btn key={x} onClick={() => toggle("days", x)} outline={!form.days.includes(x)}>
                    {x.slice(0, 3)}
                  </Btn>
                ))}
              </div>
              <b>Subjects</b>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 16px" }}>
                {subjects.map((x) => (
                  <Btn
                    key={x}
                    onClick={() => toggle("subjects", x)}
                    outline={!form.subjects.includes(x)}
                    color={A.green}
                  >
                    {x}
                  </Btn>
                ))}
              </div>
              <Field
                label="Description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                type="textarea"
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn onClick={save}>Create Batch</Btn>
              </div>
            </Modal>
          )}
        </>
      ) : (
        <div className="card">
          <Table
            rows={tt}
            columns={[
              ["cls", "Class", (r) => `${r.cls}-${r.sec}`],
              ["day", "Day", (r) => r.day],
              ["slot", "Time", (r) => r.slot],
              ["subject", "Subject", (r) => r.subject],
              ["tid", "Teacher", (r) => r.tid],
            ]}
            actions={(r) => (
              <Btn
                onClick={async () => {
                  await delR("timetable", r.id);
                  void load();
                }}
                color={A.red}
              >
                🗑
              </Btn>
            )}
          />
        </div>
      )}
    </div>
  );
}