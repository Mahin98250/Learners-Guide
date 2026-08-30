import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { signIn } from "@/lg/auth";
import { supabase } from "@/lg/supabase";
import { LGLogo } from "@/lg/ui";

const A = {
  bg: "#F0F4FF",
  sidebar: "#0F1B3D",
  accent: "#4361EE",
  gold: "#F5A623",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  text: "#0F1B3D",
  sub: "#64748B",
  border: "#E2E8F0",
  light: "#F8FAFF",
};
type PageKey =
  | "dashboard"
  | "students"
  | "teachers"
  | "batches"
  | "attendance"
  | "homework"
  | "examschedule"
  | "results"
  | "materials"
  | "fees"
  | "announcements"
  | "accounts"
  | "marks"
  | "search"
  | "adminmsgs";
type Row = Record<string, any> & { id?: string | number };
type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Props = { user: AdminUser; onLogout: () => void };
const NAV: Array<[PageKey, string, string]> = [
  ["dashboard", "🏠", "Dashboard"],
  ["students", "🎓", "Students"],
  ["teachers", "👨‍🏫", "Teachers"],
  ["batches", "👥", "Batches & Timetable"],
  ["attendance", "✅", "Attendance"],
  ["homework", "📝", "Homework"],
  ["examschedule", "📋", "Exam Schedule"],
  ["results", "🏆", "Student Results"],
  ["materials", "📚", "Study Materials"],
  ["fees", "💰", "Fees"],
  ["announcements", "📢", "Announcements"],
  ["accounts", "🔐", "User Accounts"],
  ["marks", "📊", "Marks Overview"],
  ["search", "🔍", "Search Profiles"],
  ["adminmsgs", "✉️", "Messages"],
];
const META: Record<PageKey, { title: string; subtitle: string; table?: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Full overview of your institute" },
  students: { title: "Students", subtitle: "Add, edit, delete students — auto creates login accounts", table: "students" },
  teachers: { title: "Teachers", subtitle: "Manage teacher accounts and subjects", table: "teachers" },
  batches: { title: "Batches & Timetable", subtitle: "Create batches, assign timetable slots and teachers", table: "batches" },
  attendance: { title: "Attendance", subtitle: "View all attendance records", table: "attendance" },
  homework: { title: "Homework", subtitle: "Monitor homework assigned by teachers", table: "homework" },
  examschedule: { title: "Exam Schedule", subtitle: "Schedule upcoming exams for classes", table: "examschedule" },
  results: { title: "Student Results", subtitle: "Enter and manage student exam results", table: "marks" },
  materials: { title: "Study Materials", subtitle: "Upload study materials — maximum 50 MB per file", table: "materials" },
  fees: { title: "Fees", subtitle: "Track and manage fee payments", table: "fees" },
  announcements: { title: "Announcements", subtitle: "Post announcements to all roles", table: "announcements" },
  accounts: { title: "User Accounts", subtitle: "View authorized login accounts", table: "users" },
  marks: { title: "Marks Overview", subtitle: "Analytics of all exam marks", table: "marks" },
  search: { title: "Search Profiles", subtitle: "Search student or teacher — full profile view" },
  adminmsgs: { title: "Messages", subtitle: "Send direct messages to teachers or students", table: "messages" },
};
const subjects = ["Mathematics", "Science", "English", "Hindi", "Computer", "Physics", "Chemistry", "Biology", "History", "Geography", "Sanskrit", "Physical Education"];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const slots = ["7:00–8:00 AM", "8:00–9:00 AM", "9:00–10:00 AM", "10:00–11:00 AM", "11:00 AM–12:00 PM", "12:00–1:00 PM", "1:00–2:00 PM", "2:00–3:00 PM", "3:00–4:00 PM", "4:00–5:00 PM"];
const gradeOptions = ["9", "10", "11", "12"];
const sectionOptions = ["A", "B", "C", "D", "All"];
