import { useEffect, useRef } from "react";
import { gdb } from "@/lg/data";

type Row = Record<string, any>;

const clean = (value: unknown) => String(value ?? "").trim();

function buildMaps(students: Row[], teachers: Row[], users: Row[], batches: Row[]) {
  const student = new Map<string, string>();
  const teacher = new Map<string, string>();
  const batch = new Map<string, string>();

  for (const row of students) {
    const name = clean(row.name);
    if (!name) continue;
    const id = clean(row.id);
    if (id) student.set(id, name);
  }
  for (const row of teachers) {
    const name = clean(row.name);
    if (!name) continue;
    const id = clean(row.id);
    if (id) teacher.set(id, name);
  }
  for (const row of batches) {
    const id = clean(row.id);
    if (!id) continue;
    const classLabel = [clean(row.cls), clean(row.sec)].filter(Boolean).join("-");
    const name = clean(row.name) || (classLabel ? `Class ${classLabel}` : "");
    if (name) batch.set(id, name);
  }

  // `sid`, `tid`, phone numbers and login identifiers are real user-facing
  // values. Never replace them with names globally: doing that corrupts
  // columns such as Roll No and Parent Phone. Only internal database IDs are
  // translated, and only when they have an explicit ID-like form.
  void users;
  return { student, teacher, batch };
}

function replaceText(root: HTMLElement, maps: ReturnType<typeof buildMaps>) {
  const skip = new Set(["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "SELECT", "OPTION"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  const replaceExact = (value: string) => maps.student.get(value) || maps.teacher.get(value) || maps.batch.get(value);

  for (const textNode of nodes) {
    const parent = textNode.parentElement;
    if (!parent || skip.has(parent.tagName)) continue;
    const raw = textNode.nodeValue || "";
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let next = raw;
    const exact = replaceExact(trimmed);
    if (exact) {
      next = raw.replace(trimmed, exact);
    } else {
      for (const [key, name] of maps.student) {
        next = next.replaceAll(`Roll ${key}`, `Student: ${name}`);
        next = next.replaceAll(`Student ID: ${key}`, `Student: ${name}`);
      }
      for (const [key, name] of maps.teacher) {
        next = next.replaceAll(`Teacher ${key}`, `Teacher: ${name}`);
        next = next.replaceAll(`Teacher ID: ${key}`, `Teacher: ${name}`);
      }
      for (const [key, name] of maps.batch) {
        next = next.replaceAll(`Batch ${key}`, name);
      }
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
        const [students, teachers, users, batches] = await Promise.all([
          gdb("students"),
          gdb("teachers"),
          gdb("users"),
          gdb("batches"),
        ]);
        if (!alive) return;
        mapsRef.current = buildMaps(students || [], teachers || [], users || [], batches || []);

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
