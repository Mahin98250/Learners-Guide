import { supabase } from "@/lg/supabase";

const scopeCache = new Map();
const SCOPE_CACHE_TTL = 30_000;

export async function loadTeacherBatches(teacherId) {
  if (!teacherId) return [];
  const key = String(teacherId);
  const cached = scopeCache.get(key);
  if (cached && Date.now() - cached.time < SCOPE_CACHE_TTL) return cached.value;

  const { data: entries, error: entriesError } = await supabase
    .from("timetable_entries")
    .select("batch_id,subject_name")
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (entriesError) throw entriesError;

  const ids = [...new Set((entries || []).map((entry) => entry?.batch_id).filter(Boolean))];
  if (!ids.length) {
    scopeCache.set(key, { time: Date.now(), value: [] });
    return [];
  }

  const { data: batches, error: batchError } = await supabase
    .from("batches")
    .select("id,name,cls,sec,status")
    .in("id", ids);
  if (batchError) throw batchError;

  const subjects = new Map();
  for (const entry of entries || []) {
    const batchKey = String(entry.batch_id);
    if (!subjects.has(batchKey)) subjects.set(batchKey, new Set());
    if (entry.subject_name) subjects.get(batchKey).add(String(entry.subject_name));
  }

  const value = (batches || [])
    .filter((batch) => batch?.status == null || batch.status === "active")
    .map((batch) => ({
      ...batch,
      subjects: [...(subjects.get(String(batch.id)) || new Set())].sort(),
    }));

  scopeCache.set(key, { time: Date.now(), value });
  return value;
}

export function clearTeacherScopeCache(teacherId) {
  if (teacherId == null) scopeCache.clear();
  else scopeCache.delete(String(teacherId));
}
