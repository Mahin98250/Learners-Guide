import { useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { A, subjects, gradeOptions, type Row, type TeacherRow, type UserRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

type TeacherForm = {\n  name: string;\n  tid: string;\n  subject: string;\n  phone: string;\n  status: string;\n  pass: string;\n};\n\nexport function Teachers({ data, reload }: { data: TeacherRow[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Row | null>(null),
    [del, setDel] = useState<Row | null>(null),
    [form, setForm] = useState<any>({
      name: "",
      tid: "",
      subject: "Mathematics",
      phone: "",
      status: "active",
      pass: "1234",
    }),
    [busy, setBusy] = useState(false);
  const next = () => `LGT${String(data.length + 1).padStart(2, "0")}`;
  const save = async () => {
    if (!form.name || !form.phone || !form.subject) return alert("Fill all required fields.");
    setBusy(true);
    try {
      if (edit) {
        await updR("teachers", edit.id, form);
        const us: UserRow[] = await gdb("users"),
          u = us.find((x) => x.ref === edit.id && x.role === "teacher");
        if (u) {
          const a = await provision(
            "teacher",
            form.phone,
            form.pass,
            form.name,
            String(edit.id),
            u.auth_id,
          );
          await updR("users", u.id, {
            name: form.name,
            phone: form.phone,
            pass: form.pass,
            auth_id: a.authId,
          });
        }
      } else {
        const id = "t" + Date.now();
        await addR("teachers", { ...form, id });
        const a = await provision("teacher", form.phone, form.pass, form.name, id);
        await addR("users", {
          id: "u" + Date.now(),
          name: form.name,
          phone: form.phone,
          email: a.email,
          pass: form.pass,
          role: "teacher",
          ref: id,
          status: "active",
          auth_id: a.authId,
        });
      }
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to save teacher");
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
      await delR("teachers", del.id);
      setDel(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to delete teacher");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <Btn
          onClick={() => {
            setForm({
              name: "",
              tid: next(),
              subject: "Mathematics",
              phone: "",
              status: "active",
              pass: "1234",
            });
            setOpen(true);
          }}
        >
          ＋ Add Teacher
        </Btn>
      </div>
      <div className="card">
        <Table
          rows={data}
          columns={[
            ["tid", "Teacher ID", (r) => r.tid],
            ["name", "Name", (r) => r.name],
            ["subject", "Subject", (r) => r.subject],
            ["phone", "Phone / Login", (r) => r.phone],
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
          title={edit ? "Edit Teacher" : "Add New Teacher"}
          onClose={() => {
            setOpen(false);
            setEdit(null);
          }}
        >
          <Field
            label="Full Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <Field
            label="Teacher ID"
            value={form.tid}
            onChange={(v) => setForm({ ...form, tid: v })}
          />
          <Field
            label="Subject"
            value={form.subject}
            onChange={(v) => setForm({ ...form, subject: v })}
            options={subjects}
          />
          <Field
            label="Phone / Login ID"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            required
          />
          <Field
            label="Password"
            value={form.pass}
            onChange={(v) => setForm({ ...form, pass: v })}
          />
          <Field
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={["active", "inactive"]}
          />
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
              {busy ? "Saving…" : "Save"}
            </Btn>
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          text="Delete this teacher and their authentication account?"
          onNo={() => setDel(null)}
          onYes={remove}
        />
      )}
    </div>
  );
}
