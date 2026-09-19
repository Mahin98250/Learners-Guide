import { C } from "@/lg/data";

export type Row = Record<string, unknown> & { id?: string | number };
export type Option = { v: string; l: string };

export const CLASSES = ["9", "10", "11", "12"];
export const SECTIONS = ["A", "B", "C", "D"];
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SUBJECTS: Record<string, string[]> = {
  "9": ["English", "Science", "Maths", "Social Studies"],
  "10": ["English", "Science", "Maths", "Social Studies"],
  "11": ["Accountancy", "Business Studies", "Economics", "Applied Mathematics", "Informatics Practices", "Entrepreneurship", "Physical Education"],
  "12": ["Accountancy", "Business Studies", "Economics", "Applied Mathematics", "Informatics Practices", "Entrepreneurship", "Physical Education"],
};

export const css = `
.bt{padding:28px;background:#F7F9FF;min-height:100%;color:${C.text}}
.card{background:#fff;border:1px solid ${C.border};border-radius:18px;box-shadow:0 4px 20px rgba(15,27,61,.07)}
.btn{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}
.field{display:block}.field span{display:block;font-size:12px;font-weight:750;color:${C.sub};margin-bottom:6px}.field input,.field select,.field textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid ${C.border};border-radius:10px;background:#F8FAFF}.field textarea{min-height:80px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.days{display:flex;gap:8px;flex-wrap:wrap}.days label,.subjects label{border:1px solid ${C.border};border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer}.subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.subjects label.selected,.days label.selected{background:#EEF2FF;border-color:${C.accent}}
.table{width:100%;border-collapse:collapse}.table th{background:#F8FAFF;color:${C.sub};padding:12px;text-align:left;font-size:12px}.table td{padding:12px;border-top:1px solid ${C.border};font-size:13px;vertical-align:top}.modal{position:fixed;inset:0;background:rgba(15,27,61,.58);z-index:100;display:grid;place-items:center;padding:16px}.modalbox{width:min(900px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:24px}@media(max-width:700px){.bt{padding:16px}.grid,.subjects{grid-template-columns:1fr}}
`;

export const emptySchedule = { batchId: "", teacherId: "", subjects: [] as string[], days: [] as string[], start: "17:00", end: "18:00", room: "" };