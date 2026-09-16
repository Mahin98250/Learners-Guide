import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { A, subjects, days, slots, gradeOptions, sectionOptions, type Row, type UserRow, type StudentRow, type TeacherRow, type PageKey, type ResultRow } from "./ReferenceAdminShared";
import { Badge, Btn, Confirm, Field, Modal, Table } from "./ReferenceAdminControls";
import { provision, removeAuth } from "./ReferenceAdminServices";

export function Dashboard({
  data,
  navigate,
}: {
  data: Record<string, Row[]>;
  navigate: (p: PageKey) => void;
}) {
  const st = data.students || [],
    tc = data.teachers || [],
    at = data.attendance || [],
    fe = data.fees || [],
    hw = data.homework || [],
    an = data.announcements || [];
  const present = at.filter((x) => x.status === "present").length;
  const rate = at.length ? Math.round((present / at.length) * 100) : 0;
  const pending = fe.filter((x) => x.status !== "paid");
  return (
    <div className="content" style={{ padding: 28 }}>
      <div className="stats grid" style={{ gridTemplateColumns: "repeat(6,minmax(0,1fr))" }}>
        {[
          ["🎓", "Total Students", st.length],
          ["👨‍🏫", "Teachers", tc.length],
          ["✅", "Attendance Rate", rate + "%"],
          ["💰", "Pending Fees", pending.length],
          ["📝", "Active Homework", hw.length],
          ["📢", "Announcements", an.length],
        ].map((x) => (
          <div className="card" style={{ padding: 20 }} key={String(x[1] ?? "")}>
            <div style={{ fontSize: 22 }}>{x[0] ?? ""}</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{x[2] ?? ""}</div>
            <div style={{ fontSize: 12, color: A.sub }}>{x[1] ?? ""}</div>
          </div>
        ))}
      </div>
      <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Weekly Attendance Trend 📊</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 150 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => {
              const v = Math.max(4, Math.min(100, rate + ([-5, 2, -2, 5, 0][i] ?? 0)));
              return (
                <div key={d} style={{ flex: 1, textAlign: "center" }}>
                  <b style={{ fontSize: 11, color: A.accent }}>{v}%</b>
                  <div style={{ height: 100, display: "flex", alignItems: "flex-end" }}>
                    <div
                      style={{
                        width: "100%",
                        height: v + "%",
                        background: A.accent,
                        borderRadius: "7px 7px 0 0",
                      }}
                    />
                  </div>
                  <small style={{ color: A.sub }}>{d}</small>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Fee Collection 💰</h3>
          {[
            ["Collected", "paid", A.green],
            ["Pending", "pending", A.amber],
            ["Overdue", "overdue", A.red],
          ].map(([l, s, c]) => (
            <div
              key={String(l)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "11px 0",
                borderBottom: `1px solid ${A.border}`,
              }}
            >
              <span>{l}</span>
              <b style={{ color: String(c) }}>
                ₹
                {fe
                  .filter((x) => x.status === s)
                  .reduce((n, x) => n + Number(x.amount || 0), 0)
                  .toLocaleString("en-IN")}
              </b>
            </div>
          ))}
        </div>
      </div>
      <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Recent Students 🎓</h3>
          {st.slice(0, 5).map((s) => (
            <div
              key={s.id}
              onClick={() => navigate("students")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 9,
                borderBottom: `1px solid ${A.border}`,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: A.accent + "18",
                  display: "grid",
                  placeItems: "center",
                  color: A.accent,
                  fontWeight: 800,
                }}
              >
                {String(s.name || "?").charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <b>{s.name}</b>
                <small style={{ display: "block", color: A.sub }}>
                  Class {s.cls}-{s.sec} · {s.sid}
                </small>
              </div>
              <Badge v={s.status || "active"} />
            </div>
          ))}
          {!st.length && <p style={{ color: A.sub }}>No students found.</p>}
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Latest Announcements 📢</h3>
          {an.slice(0, 5).map((a) => (
            <div key={a.id} style={{ padding: 10, borderBottom: `1px solid ${A.border}` }}>
              <b>{a.title}</b>
              <div>
                <Badge v={a.target || "all"} /> <small style={{ color: A.sub }}>{a.date}</small>
              </div>
            </div>
          ))}
          {!an.length && <p style={{ color: A.sub }}>No announcements yet.</p>}
        </div>
      </div>
    </div>
  );
}