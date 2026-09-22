import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { useInstituteWorkspace } from "@/lg/tenant-context";

export const FEATURE_CODES = [
  "students","teachers","academics","guardians","attendance","homework",
  "materials","assessments","timetable","fees","announcements","reports",
  "notifications","parent_portal",
] as const;

export type FeatureCode = typeof FEATURE_CODES[number];

export function useInstituteFeatures() {
  const { instituteId } = useInstituteWorkspace();
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!instituteId) {
      setEnabled(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase
        .from("institute_feature_entitlements")
        .select("feature_code,enabled")
        .eq("institute_id", instituteId)
        .eq("enabled", true);
      if (rpcError) throw rpcError;
      setEnabled(new Set((data || []).map((row) => String(row.feature_code))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load institute features.");
      setEnabled(new Set());
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const isEnabled = useCallback((code: string) => enabled.has(code), [enabled]);
  const value = useMemo(() => ({ enabled, loading, error, isEnabled, refresh }), [enabled, loading, error, isEnabled, refresh]);
  return value;
}

export function FeatureDisabled({ featureName = "This feature" }: { featureName?: string }) {
  return (
    <section style={{ minHeight: 260, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ width: "min(520px,100%)", padding: 28, border: "1px solid #e5e7eb", borderRadius: 20, background: "#fff" }}>
        <div style={{ fontSize: 34 }}>◈</div>
        <h2 style={{ margin: "8px 0" }}>{featureName} is disabled</h2>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          This module is currently disabled for your institute. Contact your institute owner or platform administrator if you need access.
        </p>
      </div>
    </section>
  );
}
