import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { useInstituteWorkspace } from "@/lg/tenant-context";

type Integration = {
  institute_id: string;
  provider_code: string;
  enabled: boolean;
  secret_configured: boolean;
  display_name: string;
  config: Record<string, unknown>;
};

type Preference = {
  institute_id: string;
  role_key: string;
  event_type: string;
  in_app: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
};

const roles = [
  ["student", "Students"],
  ["parent", "Parents"],
  ["teacher", "Teachers"],
  ["admin", "Administrators"],
] as const;

const events = [
  ["announcement", "Announcements", "📢"],
  ["homework", "Homework", "✎"],
  ["material", "Study materials", "📚"],
  ["attendance", "Attendance", "✓"],
  ["timetable", "Timetable", "▦"],
  ["message", "Messages", "💬"],
] as const;

const providers = [
  ["in_app", "In-app notifications", "Always available inside the portal.", "🛎️"],
  ["web_push", "Browser push", "Works through the existing web-push service.", "🔔"],
  ["email", "Email", "Provider credentials are required before activation.", "✉️"],
  ["whatsapp", "WhatsApp", "Requires an approved WhatsApp provider.", "💬"],
  ["sms", "SMS", "Requires an SMS provider and sender configuration.", "📱"],
] as const;

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e7ebf2",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,.04)",
};

export function NotificationIntegrationsCenter() {
  const { membership } = useInstituteWorkspace();
  const instituteId = membership?.institute_id || "";
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    if (!instituteId) return;
    setLoading(true);
    setError("");
    try {
      const [integrationResult, preferenceResult, permissionResult] = await Promise.all([
        supabase.from("institute_notification_integrations").select("institute_id,provider_code,enabled,secret_configured,display_name,config").eq("institute_id", instituteId).order("provider_code"),
        supabase.from("institute_notification_preferences").select("institute_id,role_key,event_type,in_app,push,email,whatsapp,sms").eq("institute_id", instituteId).order("role_key").order("event_type"),
        supabase.rpc("user_has_institute_permission", { p_institute_id: instituteId, p_permission_code: "notifications.manage" }),
      ]);
      if (integrationResult.error) throw integrationResult.error;
      if (preferenceResult.error) throw preferenceResult.error;
      if (permissionResult.error) throw permissionResult.error;
      setIntegrations((integrationResult.data || []) as Integration[]);
      setPreferences((preferenceResult.data || []) as Preference[]);
      setCanManage(Boolean(permissionResult.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load notification settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [instituteId]);

  const integrationMap = useMemo(() => new Map(integrations.map((item) => [item.provider_code, item])), [integrations]);
  const prefMap = useMemo(() => new Map(preferences.map((item) => [`${item.role_key}:${item.event_type}`, item])), [preferences]);

  const toggleIntegration = async (provider: string, enabled: boolean) => {
    const current = integrationMap.get(provider);
    if (!current || !canManage || saving) return;
    if (provider === "in_app") return;
    if (enabled && !current.secret_configured) {
      setError(`${current.display_name} is not configured yet. Add the provider credentials through the secure server-side integration setup before enabling it.`);
      return;
    }
    setSaving(`integration:${provider}`);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase
        .from("institute_notification_integrations")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("institute_id", instituteId)
        .eq("provider_code", provider);
      if (updateError) throw updateError;
      setIntegrations((rows) => rows.map((row) => row.provider_code === provider ? { ...row, enabled } : row));
      setNotice(`${current.display_name} ${enabled ? "enabled" : "disabled"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update integration.");
    } finally {
      setSaving("");
    }
  };

  const togglePreference = async (role: string, event: string, channel: keyof Pick<Preference, "in_app" | "push" | "email" | "whatsapp" | "sms">) => {
    if (!canManage || saving) return;
    const key = `${role}:${event}`;
    const current = prefMap.get(key);
    if (!current) return;
    const next = !current[channel];
    if (next && channel !== "in_app") {
      const provider = integrationMap.get(channel === "push" ? "web_push" : channel);
      if (!provider?.enabled) {
        setError(`${channel === "push" ? "Browser push" : channel} is not enabled for this institute.`);
        return;
      }
    }
    const updated = { ...current, [channel]: next };
    setSaving(`preference:${key}:${channel}`);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase
        .from("institute_notification_preferences")
        .upsert({
          institute_id: instituteId,
          role_key: role,
          event_type: event,
          in_app: updated.in_app,
          push: updated.push,
          email: updated.email,
          whatsapp: updated.whatsapp,
          sms: updated.sms,
          updated_at: new Date().toISOString(),
        }, { onConflict: "institute_id,role_key,event_type" });
      if (updateError) throw updateError;
      setPreferences((rows) => rows.map((row) => row.role_key === role && row.event_type === event ? updated : row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update notification preference.");
    } finally {
      setSaving("");
    }
  };

  if (!instituteId) {
    return <div style={card}>Select an institute workspace to manage notifications and integrations.</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: "#4f46e5" }}>COMMUNICATION CENTER</div>
        <h2 style={{ margin: "5px 0 4px" }}>Notifications & Integrations</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Control which notification channels are available to this institute and set the default delivery preferences by role.
        </p>
      </div>

      {error && <div role="alert" style={{ ...card, marginBottom: 14, background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}>{error}</div>}
      {notice && <div role="status" style={{ ...card, marginBottom: 14, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>{notice}</div>}
      {!canManage && !loading && <div style={{ ...card, marginBottom: 14, background: "#f8fafc", color: "#475569" }}>You have read-only access to these settings.</div>}

      {loading ? (
        <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>Loading communication settings…</div>
      ) : (
        <>
          <section style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>Delivery channels</h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Provider secrets are intentionally not stored in this browser-facing table.</p>
              </div>
              <button type="button" onClick={() => void load()} style={{ border: 0, borderRadius: 10, padding: "8px 11px", background: "#eef2ff", color: "#4338ca", fontWeight: 800, cursor: "pointer" }}>Refresh</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
              {providers.map(([code, name, description, icon]) => {
                const item = integrationMap.get(code);
                const ready = Boolean(item?.secret_configured);
                const disabled = !canManage || code === "in_app" || !ready;
                return (
                  <div key={code} style={{ border: "1px solid #e7ebf2", borderRadius: 15, padding: 14, background: item?.enabled ? "#f8faff" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 22 }}>{icon}</div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void toggleIntegration(code, !item?.enabled)}
                        aria-label={`${name} ${item?.enabled ? "enabled" : "disabled"}`}
                        style={{ width: 42, height: 24, border: 0, borderRadius: 999, padding: 2, background: item?.enabled ? "#4f46e5" : "#cbd5e1", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !item?.enabled ? .65 : 1 }}
                      >
                        <span style={{ display: "block", width: 20, height: 20, borderRadius: "50%", background: "#fff", transform: item?.enabled ? "translateX(18px)" : "translateX(0)", transition: "transform .18s" }} />
                      </button>
                    </div>
                    <strong style={{ display: "block", marginTop: 9 }}>{name}</strong>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, marginTop: 4 }}>{description}</div>
                    <div style={{ marginTop: 9, fontSize: 10, fontWeight: 800, color: item?.enabled ? "#166534" : ready ? "#92400e" : "#64748b" }}>
                      {item?.enabled ? "ACTIVE" : ready ? "READY TO ENABLE" : "NOT CONFIGURED"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={card}>
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Default notification preferences</h3>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>These are institute-level defaults. Existing notification rows are not retroactively rewritten.</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e7ebf2" }}>Event</th>
                    {roles.map(([key, label]) => <th key={key} style={{ textAlign: "center", padding: "10px 8px", borderBottom: "1px solid #e7ebf2" }}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {events.map(([event, label, icon]) => (
                    <tr key={event}>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f1f5f9", fontWeight: 700 }}>{icon} {label}</td>
                      {roles.map(([role]) => {
                        const pref = prefMap.get(`${role}:${event}`);
                        return (
                          <td key={role} style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                              {(["in_app", "push", "email", "whatsapp", "sms"] as const).map((channel) => {
                                const active = Boolean(pref?.[channel]);
                                const provider = channel === "push" ? integrationMap.get("web_push") : integrationMap.get(channel);
                                const unavailable = channel !== "in_app" && !provider?.enabled;
                                const busy = saving === `preference:${role}:${event}:${channel}`;
                                return (
                                  <button
                                    key={channel}
                                    type="button"
                                    disabled={!canManage || unavailable || busy}
                                    title={unavailable ? "Enable this delivery channel first" : channel}
                                    onClick={() => void togglePreference(role, event, channel)}
                                    style={{ border: "1px solid " + (active ? "#c7d2fe" : "#e2e8f0"), borderRadius: 8, padding: "5px 6px", background: active ? "#eef2ff" : "#fff", color: active ? "#4338ca" : "#64748b", fontSize: 10, fontWeight: 800, cursor: (!canManage || unavailable) ? "not-allowed" : "pointer", opacity: unavailable ? .45 : 1 }}
                                  >
                                    {channel === "in_app" ? "App" : channel === "push" ? "Push" : channel[0].toUpperCase() + channel.slice(1)}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, color: "#64748b", fontSize: 11 }}>
              <b>Security:</b> provider credentials are kept out of client configuration. Email, WhatsApp and SMS remain unavailable until their server-side provider setup exists.
            </div>
          </section>
        </>
      )}
    </div>
  );
}
