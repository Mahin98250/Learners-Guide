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

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg";
const TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const validFile = (file) => Boolean(file && ((file.type && TYPES.has(file.type)) || /\.(pdf|pptx?|docx?|png|jpe?g)$/i.test(file.name)));
const fileLabel = (file) => {
  if (!file) return "No file selected";
  const mb = file.size / 1048576;
  return `${file.name} · ${mb < 1 ? `${(file.size / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`}`;
};

