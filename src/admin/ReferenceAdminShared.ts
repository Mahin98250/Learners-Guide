export const A = {
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
export type PageKey =
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
export type Row = Record<string, any> & { id?: string | number };
export type UserRow = Row & {
  ref?: string | null;
  role?: string;
  auth_id?: string | null;
  name?: string;
  phone?: string;
  status?: string;
};
export type StudentRow = Row & {
  sid?: string;
  name?: string;
  cls?: string;
  sec?: string;
  parentName?: string;
  parentPhone?: string;
  status?: string;
};
export type TeacherRow = Row & {
  tid?: string;
  name?: string;
  subject?: string;
  phone?: string;
  status?: string;
};
export type ResultRow = Row & {
  sid?: string;
  subject?: string;
  exam?: string;
  marks?: number | string;
  total?: number | string;
  date?: string;
  tid?: string;
};
export type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
export type Props = { user: AdminUser; onLogout: () => void };
export const NAV: Array<[PageKey, string, string]> = [
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
export const META: Record<PageKey, { title: string; subtitle: string; table?: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Full overview of your institute" },
  students: {
    title: "Students",
    subtitle: "Add, edit, delete students — auto creates login accounts",
    table: "students",
  },
  teachers: {
    title: "Teachers",
    subtitle: "Manage teacher accounts and subjects",
    table: "teachers",
  },
  batches: {
    title: "Batches & Timetable",
    subtitle: "Create batches, assign timetable slots and teachers",
    table: "batches",
  },
  attendance: { title: "Attendance", subtitle: "View all attendance records", table: "attendance" },
  homework: {
    title: "Homework",
    subtitle: "Monitor homework assigned by teachers",
    table: "homework",
  },
  examschedule: {
    title: "Exam Schedule",
    subtitle: "Schedule upcoming exams for classes",
    table: "examschedule",
  },
  results: {
    title: "Student Results",
    subtitle: "Enter and manage student exam results",
    table: "marks",
  },
  materials: {
    title: "Study Materials",
    subtitle: "Upload study materials — maximum 50 MB per file",
    table: "materials",
  },
  fees: { title: "Fees", subtitle: "Track and manage fee payments", table: "fees" },
  announcements: {
    title: "Announcements",
    subtitle: "Post announcements to all roles",
    table: "announcements",
  },
  accounts: { title: "User Accounts", subtitle: "View authorized login accounts", table: "users" },
  marks: { title: "Marks Overview", subtitle: "Analytics of all exam marks", table: "marks" },
  search: { title: "Search Profiles", subtitle: "Search student or teacher — full profile view" },
  adminmsgs: {
    title: "Messages",
    subtitle: "Send direct messages to teachers or students",
    table: "messages",
  },
};
export const subjects = [
  "Mathematics",
  "Science",
  "English",
  "Hindi",
  "Computer",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Sanskrit",
  "Physical Education",
];
export const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const slots = [
  "7:00–8:00 AM",
  "8:00–9:00 AM",
  "9:00–10:00 AM",
  "10:00–11:00 AM",
  "11:00 AM–12:00 PM",
  "12:00–1:00 PM",
  "1:00–2:00 PM",
  "2:00–3:00 PM",
  "3:00–4:00 PM",
  "4:00–5:00 PM",
];
export const gradeOptions = ["9", "10", "11", "12"];
export const sectionOptions = ["A", "B", "C", "D", "All"];
export const css = `*{box-sizing:border-box}.admin{min-height:100vh;background:${A.bg};color:${A.text};font-family:Poppins,system-ui,sans-serif}.admin button,.admin input,.admin select,.admin textarea{font:inherit}.nav{border:0;background:transparent;color:#ffffff8c;width:100%;padding:11px 14px;margin:3px 0;border-radius:12px;text-align:left;display:flex;align-items:center;gap:12px;cursor:pointer}.nav:hover{background:#ffffff12}.nav.active{background:${A.accent};color:#fff;box-shadow:0 6px 20px #4361ee59}.btn{border:0;border-radius:12px;padding:10px 16px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;gap:7px}.btn:hover{filter:brightness(1.05);transform:translateY(-1px)}.card{background:#fff;border:1px solid #eef2ff;border-radius:20px;box-shadow:0 4px 20px #0f1b3d12}.modal{position:fixed;inset:0;background:#0f1b3d99;z-index:50;display:grid;place-items:center;padding:16px}.modalbox{background:#fff;border-radius:22px;width:min(720px,100%);max-height:92vh;overflow:auto;padding:26px;box-shadow:0 24px 72px #0f1b3d30}.field{margin-bottom:13px}.field label{display:block;font-size:12px;font-weight:750;color:${A.sub};margin-bottom:6px}.field input,.field select,.field textarea{width:100%;padding:11px 13px;border:1.5px solid ${A.border};border-radius:11px;background:${A.light};color:${A.text};outline:none}.field textarea{min-height:90px;resize:vertical}.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse;font-size:13px}.table th{background:${A.light};padding:12px 14px;text-align:left;color:${A.sub};white-space:nowrap}.table td{padding:12px 14px;border-top:1px solid ${A.border};white-space:nowrap}.table tr:hover td{background:#f8faff}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800}.grid{display:grid;gap:16px}@media(max-width:900px){.shell{display:block!important}.side{position:relative!important;width:100%!important;min-height:auto!important}.navrow{display:flex;overflow-x:auto;padding-bottom:6px}.nav{width:auto;white-space:nowrap}.sidebottom{display:none!important}.main{min-height:auto!important}.top{padding:16px!important}.content{padding:16px!important}.twocol{grid-template-columns:1fr!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:520px){.stats{grid-template-columns:1fr!important}.modalbox{padding:18px}.actions{flex-wrap:wrap}.actions>*{flex:1}.top h1{font-size:18px!important}}`;
