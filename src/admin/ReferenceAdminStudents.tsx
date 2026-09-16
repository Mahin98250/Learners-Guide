import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { A, subjects, days, slots, gradeOptions, sectionOptions, type Row, type UserRow, type StudentRow, type TeacherRow, type PageKey, type ResultRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

export function Students({ data, reload }: { data: StudentRow[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Row | null>(null),
    [del, setDel] = useState<Row | null>(null),
    [q, setQ] = useState(""),
    [form, setForm] = useState<any>({
      name: "",
      sid: "",
      cls: "10",
      sec: "A",
      enroll: new Date().toISOString().slice(0, 10),
      status: "active",
      pass: "1234",
      parentName: "",
      parentPhone: "",
    }),
    [busy, setBusy] = useState(false);
  const nextSid = () => {
    const nums = data.map((s) => Number(String(s.sid || "").replace(/\D/g, ""))).filter(Boolean);
    return `LG${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  };
  const save = async () => {
    if (!form.name || !form.cls || !form.sec || !form.parentPhone)
      return alert("Fill all required fields.");
    setBusy(true);
    try {
      if (edit) {
        await updR("students", edit.id, form);
        const us: UserRow[] = await gdb("users");
        const su = us.find((u: UserRow) => u.ref === edit.id && u.role === "student"),
          pu = us.find((u: UserRow) => u.ref === edit.id && u.role === "parent");
        if (su) {
          const a = await provision(
            "student",
            form.sid,
            form.pass,
            form.name,
            String(edit.id),
            su.auth_id,
          );
          await updR("users", su.id, {
            name: form.name,
            phone: form.sid,
            pass: form.pass,
            auth_id: a.authId,
          });
        }
        if (pu) {
          const a = await provision(
            "parent",
            form.parentPhone,
            "parent@1234",
            form.parentName,
            String(edit.id),
            pu.auth_id,
          );
          await updR("users", pu.id, {
            name: form.parentName,
            phone: form.parentPhone,
            pass: "parent@1234",
            auth_id: a.authId,
          });
        }
      } else {
        const id = "s" + Date.now();
        await addR("students", { ...form, id });
        const sa = await provision("student", form.sid, form.pass, form.name, id);
        const pa = await provision("parent", form.parentPhone, "parent@1234", form.parentName, id);
        await addR("users", {
          id: "u" + Date.now() + "s",
          name: form.name,
          phone: form.sid,
          email: sa.email,
          pass: form.pass,
          role: "student",
          ref: id,
          status: "active",
          auth_id: sa.authId,
        });
        await addR("users", {
          id: "u" + Date.now() + "p",
          name: form.parentName,
          phone: form.parentPhone,
          email: pa.email,
          pass: "parent@1234",
          role: "parent",
          ref: id,
          status: "active",
          auth_id: pa.authId,
        });
      }
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to save student");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      const us: UserRow[] = await gdb("users");
      for (const u of us.filter((x: UserRow) => x.ref === del.id)) {
        await removeAuth(u.auth_id);
        await delR("users", u.id);
      }
      await delR("students", del.id);
      setDel(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to delete student");
    } finally {
      setBusy(false);
    }
  };
  const rows = data.filter(
    (s) => !q || `${s.name} ${s.sid}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search by name or SID…"
          style={{
            flex: 1,
            minWidth: 220,
            padding: 11,
            border: `1.5px solid ${A.border}`,
            borderRadius: 12,
          }}
        />
        <Btn
          onClick={() => {
            setForm({
              name: "",
              sid: nextSid(),
              cls: "10",
              sec: "A",
              enroll: new Date().toISOString().slice(0, 10),
              status: "active",
              pass: "1234",
              parentName: "",
              parentPhone: "",
            });
            setOpen(true);
          }}
        >
          ＋ Add Student
        </Btn>
      </div>
      <div className="card">
        <Table
          rows={rows}
          columns={[
            ["sid", "Roll No", (r) => r.sid],
            ["name", "Student Name", (r) => r.name],
            ["cls", "Class", (r) => `${r.cls}-${r.sec}`],
            ["parentName", "Parent Name", (r) => r.parentName],
            ["parentPhone", "Parent Phone", (r) => r.parentPhone],
            ["status", "Status", (r) => <Badge v={r.status} />],
          ]}
          actions={(r) => (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn
                onClick={() => {
                  setForm({ ...r });
                  setEdit(r);
                }}
                outline
              >
                Edit
              </Btn>
              <Btn onClick={() => setDel(r)} color={A.red}>
                🗑
              </Btn>
            </div>
          )}
        />
      </div>
      {(open || edit) && (
        <Modal
          title={edit ? "Edit Student" : "Add New Student"}
          onClose={() => {
            setOpen(false);
            setEdit(null);
          }}
          wide
        >
          <div
            style={{
              background: "#eff6ff",
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              color: "#1e40af",
            }}
          >
            Adding a student automatically creates the student login and a parent login linked only
            to this student.
          </div>
          <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field
              label="Full Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Field
              label="Roll Number / SID"
              value={form.sid}
              onChange={(v) => setForm({ ...form, sid: v })}
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
              label="Enrollment Date"
              value={form.enroll}
              onChange={(v) => setForm({ ...form, enroll: v })}
              type="date"
            />
            <Field
              label="Status"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={["active", "inactive"]}
            />
            <Field
              label="Student Password"
              value={form.pass}
              onChange={(v) => setForm({ ...form, pass: v })}
              placeholder="Default: 1234"
            />
            <Field
              label="Parent / Guardian Name"
              value={form.parentName}
              onChange={(v) => setForm({ ...form, parentName: v })}
              required
            />
            <Field
              label="Parent Phone / Login"
              value={form.parentPhone}
              onChange={(v) => setForm({ ...form, parentPhone: v })}
              required
            />
            <div
              style={{
                background: "#fff7ed",
                padding: 12,
                borderRadius: 12,
                fontSize: 12,
                color: "#92400e",
              }}
            >
              Parent default password: <b>parent@1234</b>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn
              onClick={() => {
                setOpen(false);
                setEdit(null);
              }}
              outline
              color={A.sub}
            >
              Cancel
            </Btn>
            <Btn onClick={save} disabled={busy}>
              {busy ? "Saving…" : edit ? "Save Changes" : "Add Student + Create Accounts"}
            </Btn>
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          text="This permanently deletes the student and their linked parent/student authentication accounts."
          onNo={() => setDel(null)}
          onYes={remove}
        />
      )}
    </div>
  );
}