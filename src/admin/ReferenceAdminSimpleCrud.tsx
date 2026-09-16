import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { A, subjects, days, slots, gradeOptions, sectionOptions, type Row, type UserRow, type StudentRow, type TeacherRow, type PageKey, type ResultRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

export function SimpleCrud({ page, rows, reload }: { page: PageKey; rows: Row[]; reload: () => void }) {
  const table = META[page].table!;
  const fieldMap: Record<string, string[]> = {
    attendance: ["sid", "date", "status", "by"],
    homework: ["cls", "sec", "subject", "desc", "given", "due", "tid"],
    examschedule: [
      "title",
      "subject",
      "cls",
      "sec",
      "date",
      "startTime",
      "endTime",
      "venue",
      "syllabus",
      "totalMarks",
    ],
    results: ["sid", "subject", "exam", "marks", "total", "date", "tid"],
    fees: ["sid", "desc", "amount", "due", "status"],
    announcements: ["title", "desc", "target", "date"],
    adminmsgs: ["to", "text"],
  };
  const fields = fieldMap[page] || [];
  const cols = fields.length ? fields : Object.keys(rows[0] || {}).filter((k) => k !== "id");
  const needsStudents = fields.includes("sid");
  const [students, setStudents] = useState<Row[]>([]);
  const [open, setOpen] = useState(false),
    [del, setDel] = useState<Row | null>(null),
    [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!needsStudents) return;
    void gdb("students")
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [needsStudents]);
  const studentOptions = useMemo(
    () =>
      students
        .filter((s) => s?.sid || s?.id)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .map((s) => ({
          v: String(s.sid || s.id),
          l: `${s.name || "Unnamed Student"} · ${s.sid || s.id} · Class ${s.cls || "—"}-${s.sec || "—"}`,
        })),
    [students],
  );
  const classOptions = useMemo(
    () => [
      ...new Set([...gradeOptions, ...students.map((s) => String(s.cls || "")).filter(Boolean)]),
    ],
    [students],
  );
  const create = async () => {
    const row: Row = { id: table.slice(0, 2) + Date.now(), ...form };
    if (page === "announcements")
      Object.assign(row, {
        date: row.date || new Date().toISOString().slice(0, 10),
        target: row.target || "all",
      });
    if (page === "fees" || page === "results")
      row.amount = page === "fees" ? Number(row.amount || 0) : row.amount;
    if (page === "results") row.marks = Number(row.marks || 0);
    await addR(table, row);
    setOpen(false);
    setForm({});
    reload();
  };
  const remove = async () => {
    if (!del) return;
    await delR(table, del.id);
    setDel(null);
    reload();
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        {page !== "attendance" && (
          <Btn
            onClick={() => {
              setForm({});
              setOpen(true);
            }}
          >
            ＋ Add {META[page].title.replace(/s$/, "")}
          </Btn>
        )}
      </div>
      <div className="card">
        <Table
          rows={rows}
          columns={cols.map((k) => [
            k,
            k.replaceAll("_", " "),
            (r) =>
              k === "status" || k === "role" || k === "target" ? (
                <Badge v={r[k]} />
              ) : (
                String(r[k] ?? "—")
              ),
          ])}
          actions={
            page !== "attendance"
              ? (r) => (
                  <Btn onClick={() => setDel(r)} color={A.red}>
                    🗑
                  </Btn>
                )
              : undefined
          }
        />
      </div>
      {open && (
        <Modal title={`Add ${META[page].title}`} onClose={() => setOpen(false)} wide>
          {fields.map((k) => (
            <Field
              key={k}
              label={k.replaceAll("_", " ")}
              value={form[k] ?? ""}
              onChange={(v) => setForm({ ...form, [k]: v })}
              type={
                k === "date"
                  ? "date"
                  : k === "desc" || k === "text" || k === "syllabus"
                    ? "textarea"
                    : "text"
              }
              options={
                k === "sid"
                  ? studentOptions
                  : k === "cls"
                    ? classOptions
                    : k === "sec"
                      ? sectionOptions
                      : k === "status"
                        ? [
                            "active",
                            "inactive",
                            "pending",
                            "paid",
                            "overdue",
                            "present",
                            "absent",
                            "leave",
                          ]
                        : k === "target"
                          ? ["all", "teachers", "parents", "students"]
                          : k === "subject"
                            ? subjects
                            : k === "day"
                              ? days
                              : undefined
              }
            />
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={create}>Save to Database</Btn>
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          text="Delete this record permanently from Supabase?"
          onNo={() => setDel(null)}
          onYes={remove}
        />
      )}
    </div>
  );
}