import React, { lazy, Suspense, useEffect, useState } from "react";
import { C } from "@/lg/data/constants";
import { supabase } from "@/lg/supabase";
import { Shell, AppBar } from "@/lg/ui";
import { THHome, THSchedule, THAttendance } from "@/lg/teacher";
import { getCurrentInstituteContext } from "@/lg/tenant";

const NotifPanel = lazy(() => import("@/lg/panels").then((module) => ({ default: module.NotifPanel })));
const T6Materials = lazy(() => import("@/lg/teacherWorkflows").then((module) => ({ default: module.T6Materials })));
const TTests = lazy(() => import("@/lg/teacherTests").then((module) => ({ default: module.TTests })));
const TTestResults = lazy(() => import("@/lg/teacherTests").then((module) => ({ default: module.TTestResults })));

const TeacherAnnouncements = lazy(() => import("@/lg/TeacherAnnouncements").then((module) => ({ default: module.TeacherAnnouncements })));
const TeacherHomeworkPage = lazy(() => import("@/lg/TeacherHomeworkPage").then((module) => ({ default: module.T5HomeworkWithFiles })));

async function loadTeacherProfile(teacherId) {
  const { data, error } = await supabase
    .from("teachers")
    .select("id,name,tid,subject,phone,classes,status")
    .eq("institute_id", (await getCurrentInstituteContext()).membership?.institute_id || "")
    .eq("id", teacherId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
          ? <TeacherHomeworkPage teacher={teacher} />
          : tab === "tests"
            ? <><TTests teacher={teacher} /><TTestResults teacher={teacher} /></>
            : tab === "materials"
              ? <T6Materials teacher={teacher} />
              : <TeacherAnnouncements teacher={teacher} />;

  return <Shell>
    <AppBar title={teacher.name || "Teacher"} onLogout={onLogout} onBell={() => setShowNotif((v) => !v)} />
    {showNotif && <Suspense fallback={null}><NotifPanel user={user} onClose={() => setShowNotif(false)} /></Suspense>}
    <div style={{ padding: "16px 16px 88px", maxWidth: 900, margin: "0 auto" }}><Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: "#747c94" }}>Loading section…</div>}>{content}</Suspense></div>
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000, background: "#fff", borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} style={{ border: 0, background: "transparent", padding: "9px 3px", color: tab === item.key ? C.accent : C.sub, fontSize: 10, fontWeight: 800, cursor: "pointer" }}><div style={{ fontSize: 18 }}>{item.icon}</div>{item.label}</button>)}
    </nav>
  </Shell>;
}
