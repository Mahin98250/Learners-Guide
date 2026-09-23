import React, { lazy, Suspense, useEffect, useState } from "react";
import { C } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { Card, Shell, AppBar } from "@/lg/ui";
import { STHome, STTimetable } from "@/lg/student";
import { getCurrentInstituteContext } from "@/lg/tenant";

const StudentHomework = lazy(() => import("@/lg/StudentSecondaryPages").then((module) => ({ default: module.Homework })) );
const StudentMaterials = lazy(() => import("@/lg/StudentSecondaryPages").then((module) => ({ default: module.STMaterials })) );
const STExams = lazy(() => import("@/lg/studentResults").then((module) => ({ default: module.STExams })) );
const STResults = lazy(() => import("@/lg/studentResults").then((module) => ({ default: module.STResults })) );
const STAttendanceFixed = lazy(() => import("@/lg/studentAttendance").then((module) => ({ default: module.STAttendanceFixed })) );
const NotifPanel = lazy(() => import("@/lg/panels").then((module) => ({ default: module.NotifPanel })) );

export function StudentAppFixed({ user, onLogout }) {
  const [tab, setTab] = useState("home");
  const [showNotif, setShowNotif] = useState(false);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const context = await getCurrentInstituteContext();
        const instituteId = context.membership?.institute_id;
        if (!instituteId) throw new Error("An active institute workspace must be selected.");
        const [profileResult, batchResult] = await Promise.all([
          supabase.from("students").select("id,name,sid,cls,sec,parentname,parentphone,parent,enroll,status").eq("institute_id", instituteId).eq("id", user.ref).maybeSingle(),
          supabase.from("batch_students").select("batch_id,status,left_at,joined_at").eq("institute_id", instituteId).eq("student_id", user.ref).eq("status", "active").is("left_at", null).order("joined_at", { ascending: false }),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (batchResult.error) throw batchResult.error;
        if (!profileResult.data) throw new Error("Student profile could not be loaded");
        const batchIds = [...new Set((batchResult.data || []).map((row) => row.batch_id).filter(Boolean).map(String))];
        if (live) setStudent({ ...profileResult.data, batchIds, batchId: batchIds[0] || "" });
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e?.message || "Unable to load student profile."));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [user.ref]);

  const tabs = [
    { key: "home", icon: "🏠", label: "Home" },
    { key: "timetable", icon: "📅", label: "Schedule" },
    { key: "materials", icon: "📚", label: "Materials" },
    { key: "homework", icon: "📝", label: "HW" },
    { key: "exams", icon: "📋", label: "Exams" },
    { key: "results", icon: "🏆", label: "Results" },
    { key: "attendance", icon: "✅", label: "Attend." },
  ];

  let content;
  if (loading) content = <Card style={{ textAlign: "center", padding: 30, color: C.sub }}>Loading your student profile…</Card>;
  else if (error) content = <Card style={{ color: C.red, marginTop: 20 }}>{error}</Card>;
  else if (tab === "home") content = <STHome student={student} />;
  else if (tab === "timetable") content = <STTimetable student={student} />;
  else if (tab === "materials") content = <StudentMaterials student={student} />;
  else if (tab === "homework") content = <StudentHomework student={student} />;
  else if (tab === "exams") content = <STExams student={student} />;
  else if (tab === "results") content = <STResults student={student} />;
  else content = <STAttendanceFixed student={student} />;

  return (
    <>
      <Shell
        header={<AppBar name={user.name} role="student" userId={user.id} onLogout={onLogout} onNotif={() => setShowNotif(true)} />}
        tabs={tabs}
        activeTab={tab}
        setTab={setTab}
      >
        <Suspense fallback={<Card style={{ textAlign: "center", padding: 24, color: C.sub }}>Loading section…</Card>}>
          {content}
        </Suspense>
      </Shell>
      {showNotif && (
        <Suspense fallback={null}>
          <NotifPanel userId={user.id} onClose={() => setShowNotif(false)} />
        </Suspense>
      )}
    </>
  );
}
