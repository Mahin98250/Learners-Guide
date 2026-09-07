import { useEffect, useRef } from "react";
import { gdb } from "@/lg/data";

const clean = (value) => String(value ?? "").trim();

const buildMaps = (students, teachers, batches) => {
  const student = new Map();
  const teacher = new Map();
  const batch = new Map();

  for (const row of students || []) {
    const id = clean(row.id);
    const name = clean(row.name);
    if (id && name) student.set(id, name);
  }
  for (const row of teachers || []) {
    const id = clean(row.id);
    const name = clean(row.name);
    if (id && name) teacher.set(id, name);
  }
  for (const row of batches || []) {
    const id = clean(row.id);
    if (!id) continue;
    const classLabel = [clean(row.cls), clean(row.sec)].filter(Boolean).join("-");
    const label = clean(row.name) || (classLabel ? `Class ${classLabel}` : "Batch");
    batch.set(id, label);
  }

  return { student, teacher, batch };
};

const replaceInternalIds = (root, maps) => {
  const skip = new Set(["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "SELECT", "OPTION"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);

  for (const textNode of nodes) {
    const parent = textNode.parentElement;
    if (!parent || skip.has(parent.tagName)) continue;
    const raw = textNode.nodeValue || "";
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let next = raw;
    const studentName = maps.student.get(trimmed);
    const teacherName = maps.teacher.get(trimmed);
    const batchName = maps.batch.get(trimmed);
    if (studentName) next = raw.replace(trimmed, studentName);
    else if (teacherName) next = raw.replace(trimmed, teacherName);
    else if (batchName) next = raw.replace(trimmed, batchName);

    for (const [id, name] of maps.student) {
      next = next.replaceAll(`Student ID: ${id}`, `Student: ${name}`);
      next = next.replaceAll(`Roll ${id}`, `Student: ${name}`);
      next = next.replaceAll(`student_id: ${id}`, `Student: ${name}`);
    }
    for (const [id, name] of maps.teacher) {
      next = next.replaceAll(`Teacher ID: ${id}`, `Teacher: ${name}`);
      next = next.replaceAll(`Teacher ${id}`, `Teacher: ${name}`);
      next = next.replaceAll(`teacher_id: ${id}`, `Teacher: ${name}`);
    }
    for (const [id, name] of maps.batch) {
      next = next.replaceAll(`Batch ${id}`, name);
      next = next.replaceAll(`batch_id: ${id}`, `Batch: ${name}`);
    }

    if (next !== raw) textNode.nodeValue = next;
  }
};

export function IdentityLabels({ rootSelector = ".lg-app-shell" }) {
  const mapsRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let observer = null;
    let timer = 0;

    const load = async () => {
      try {
        const [students, teachers, batches] = await Promise.all([
          gdb("students"),
          gdb("teachers"),
          gdb("batches"),
        ]);
        if (!alive) return;
        mapsRef.current = buildMaps(students, teachers, batches);

        const apply = () => {
          const root = document.querySelector(rootSelector);
          if (root && mapsRef.current) replaceInternalIds(root, mapsRef.current);
        };

        apply();
        observer = new MutationObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(apply, 0);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      } catch {
        // Presentation-only identity mapping must never break a portal.
      }
    };

    void load();
    return () => {
      alive = false;
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [rootSelector]);

  return null;
}
