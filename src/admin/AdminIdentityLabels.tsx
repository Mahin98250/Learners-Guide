import { useEffect, useRef } from "react";
import { gdb } from "@/lg/data";

type Row = Record<string, any>;

const clean = (value: unknown) => String(value ?? "").trim();

function buildMaps(students: Row[], teachers: Row[], users: Row[]) {
  const student = new Map<string, string>();
  const teacher = new Map<string, string>();
  const person = new Map<string, string>();

  for (const row of students) {
    const name = clean(row.name);
    if (!name) continue;
    for (const key of [row.id, row.sid]) {
      const value = clean(key);
      if (value) student.set(value, name);
    }
  }
  for (const row of teachers) {
    const name = clean(row.name);
    if (!name) continue;
    for (const key of [row.id, row.tid]) {
      const value = clean(key);
      if (value) teacher.set(value, name);
    }
  }
  for (const row of users) {
    const name = clean(row.name);
    const ref = clean(row.ref);
    const phone = clean(row.phone);
    if (!name) continue;
    // Student/teacher identifiers always have higher priority than the
    // generic user reference. A parent user commonly shares the same `ref`
    // as the linked student, so allowing `person` to overwrite that key would
    // incorrectly display the parent's name in student-facing admin columns.
    if (ref && !student.has(ref) && !teacher.has(ref)) person.set(ref, name);
    if (phone && !student.has(phone) && !teacher.has(phone)) person.set(phone, name);
  }
  return { student, teacher, person };
}

function replaceText(root: HTMLElement, maps: ReturnType<typeof buildMaps>) {
  const skip = new Set(["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "SELECT", "OPTION"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  for (const textNode of nodes) {
    const parent = textNode.parentElement;
    if (!parent || skip.has(parent.tagName)) continue;
    const raw = textNode.nodeValue || "";
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let next = raw;
    for (const [key, name] of maps.student) {
      if (trimmed === key) next = raw.replace(trimmed, name);
      next = next.replaceAll(`Roll ${key}`, `Student: ${name}`);
      next = next.replaceAll(` · ${key}`, ` · ${name}`);
    }
    for (const [key, name] of maps.teacher) {
      if (trimmed === key) next = raw.replace(trimmed, name);
      next = next.replaceAll(`Teacher ${key}`, `Teacher: ${name}`);
      next = next.replaceAll(` · ${key}`, ` · ${name}`);
    }
    for (const [key, name] of maps.person) {
      if (trimmed === key) next = raw.replace(trimmed, name);
    }
    if (next !== raw) textNode.nodeValue = next;
  }
}

export function AdminIdentityLabels() {
  const mapsRef = useRef<ReturnType<typeof buildMaps> | null>(null);

  useEffect(() => {
    let alive = true;
    let observer: MutationObserver | null = null;
    let timer = 0;

    const load = async () => {
      try {
        const [students, teachers, users] = await Promise.all([
          gdb("students"),
          gdb("teachers"),
          gdb("users"),
        ]);
        if (!alive) return;
        mapsRef.current = buildMaps(students || [], teachers || [], users || []);

        const apply = () => {
          const root = document.querySelector<HTMLElement>(".admin");
          if (!root || !mapsRef.current) return;
          replaceText(root, mapsRef.current);
        };

        apply();
        observer = new MutationObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(apply, 0);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      } catch {
        // Identity decoration must never block the admin portal itself.
      }
    };

    void load();
    return () => {
      alive = false;
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
