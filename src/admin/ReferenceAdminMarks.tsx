import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { A, subjects, days, slots, gradeOptions, sectionOptions, type Row, type UserRow, type StudentRow, type TeacherRow, type PageKey, type ResultRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

export function Marks({ rows }: { rows: Row[] }) {
  const pct = (r: Row) =>
    Math.round((Number(r.marks || 0) / Math.max(1, Number(r.total || 100))) * 100);
  return (
    <div className="content" style={{ padding: 28 }}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 18 }}
      >
        {[
          ["📊", "Entries", rows.length],
          ["✅", "Above 80%", rows.filter((r) => pct(r) >= 80).length],
          ["⚠️", "Below 60%", rows.filter((r) => pct(r) < 60).length],
        ].map((x) => (
          <div className="card" style={{ padding: 20 }} key={String(x[1] ?? "")}>
            <div>{x[0] ?? ""}</div>
            <b style={{ fontSize: 28 }}>{x[2] ?? ""}</b>
            <div style={{ color: A.sub, fontSize: 12 }}>{x[1] ?? ""}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <Table
          rows={rows}
          columns={[
            ["sid", "Student", (r) => r.sid],
            ["subject", "Subject", (r) => r.subject],
            ["exam", "Exam", (r) => r.exam],
            ["marks", "Marks", (r) => `${r.marks}/${r.total}`],
            [
              "score",
              "Score",
              (r) => (
                <b style={{ color: pct(r) >= 80 ? A.green : pct(r) >= 60 ? A.amber : A.red }}>
                  {pct(r)}%
                </b>
              ),
            ],
            ["date", "Date", (r) => r.date],
          ]}
        />
      </div>
    </div>
  );
}