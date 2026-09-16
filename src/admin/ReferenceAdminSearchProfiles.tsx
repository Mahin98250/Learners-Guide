import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { A, subjects, days, slots, gradeOptions, sectionOptions, type Row, type UserRow, type StudentRow, type TeacherRow, type PageKey, type ResultRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

export function SearchProfiles({ students, teachers }: { students: Row[]; teachers: Row[] }) {
  const [q, setQ] = useState(""),
    [type, setType] = useState<"student" | "teacher">("student"),
    [sel, setSel] = useState<Row | null>(null);
  const arr = (type === "student" ? students : teachers).filter((x) =>
    `${x.name} ${type === "student" ? x.sid : x.tid}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="content" style={{ padding: 28 }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn
            onClick={() => {
              setType("student");
              setSel(null);
            }}
            outline={type !== "student"}
          >
            🎓 Students
          </Btn>
          <Btn
            onClick={() => {
              setType("teacher");
              setSel(null);
            }}
            outline={type !== "teacher"}
          >
            👨‍🏫 Teachers
          </Btn>
        </div>
        <Field label="Search by name or ID" value={q} onChange={setQ} placeholder="Start typing…" />
        {!sel ? (
          <div>
            {arr.map((x) => (
              <button
                key={x.id}
                onClick={() => setSel(x)}
                style={{
                  width: "100%",
                  border: 0,
                  borderBottom: `1px solid ${A.border}`,
                  background: "#fff",
                  padding: 14,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <b>{x.name}</b>
                <span style={{ display: "block", fontSize: 12, color: A.sub }}>
                  {type === "student"
                    ? `Roll ${x.sid} · Class ${x.cls}-${x.sec}`
                    : `${x.subject} · ${x.phone}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <Btn onClick={() => setSel(null)} outline>
              ← Back
            </Btn>
            <div
              style={{
                marginTop: 16,
                background: "linear-gradient(135deg,#4361ee,#7b6ff5)",
                color: "#fff",
                borderRadius: 18,
                padding: 24,
              }}
            >
              <h2 style={{ marginTop: 0 }}>{sel.name}</h2>
              <div>
                {type === "student"
                  ? `Roll ${sel.sid} · Class ${sel.cls}-${sel.sec}`
                  : `${sel.subject} · ${sel.tid}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}