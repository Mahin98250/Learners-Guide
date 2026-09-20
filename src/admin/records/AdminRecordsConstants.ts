import { C } from "@/lg/data";

export type Row = Record<string, unknown> & { id: string | number };
export type Kind = "students" | "teachers";
export type ProvisionRole = "student" | "parent" | "teacher";

export const CLASSES = ["9", "10", "11", "12"];
export const SECTIONS = ["A", "B", "C", "D"];
export const SUBJECTS = ["English", "Social Studies", "Mathematics", "Science", "Hindi", "Gujarati", "Computer Science", "Accountancy", "Business Studies", "Economics", "Applied Mathematics", "Informatics Practices", "Entrepreneurship", "Physical Education", "Legal Studies", "Psychology"];
export const card: React.CSSProperties = { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: "0 4px 20px rgba(15,27,61,.07)" };
export const DEFAULT_STUDENT_PASSWORD = "Student@1234";
export const DEFAULT_PARENT_PASSWORD = "Parent@1234";
export const DEFAULT_TEACHER_PASSWORD = "Teacher@1234";