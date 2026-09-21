import { FormEvent, useEffect, useState } from "react";
import { useInstituteWorkspace } from "@/lg/tenant-context";
import { supabase } from "@/lg/supabase";
import "@/admin/admin-account.css";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type AdminAccount = { id: string; email: string; name: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; current: boolean };
type Props = { user: AdminUser; mode: "profile" | "security" | "create"; onLogout: () => void };

const prettyDate = (value: string | null) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";
const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

function EyeIcon({ open }: { open: boolean }) {
  return open ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a17.4 17.4 0 0 1-3.3 3.8M6.2 6.9C3.5 8.8 2 12 2 12s3.5 6 10 6a10.6 10.6 0 0 0 3.4-.6M10 10a2.8 2.8 0 0 0 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function AccountHeader({ title, description }: { title: string; description: string }) {
  return <div className="aap-header"><div><span>ACCOUNT & SECURITY</span><h1>{title}</h1><p>{description}</p></div><div className="aap-lock">🔒 <span>Protected</span></div></div>;
}

function ProfilePage({ user }: { user: AdminUser }) {
  const initial = (user.name || "A").trim().charAt(0).toUpperCase();
  return <><AccountHeader title="Admin Profile" description="Your administrator identity and account details." /><div className="aap-grid"><section className="aap-card aap-profile-card"><div className="aap-large-avatar">{initial}</div><div><h2>{user.name || "Admin"}</h2><p>Administrator</p><span className="aap-status">● Signed in</span></div></section><section className="aap-card"><h2>Account information</h2><div className="aap-detail"><span>Name</span><strong>{user.name || "Admin"}</strong></div><div className="aap-detail"><span>Role</span><strong>Administrator</strong></div><div className="aap-detail"><span>Login phone / ID</span><strong>{user.phone || "Not provided"}</strong></div><div className="aap-detail"><span>Account reference</span><strong>Administrator account</strong></div></section></div></>;
}

function SecurityPage({ user }: { user: AdminUser }) {
  const { instituteId } = useInstituteWorkspace();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) { setError(sessionError.message); setLoading(false); return; }
      setEmail(data.session?.user?.email || "");
      const result = await supabase.functions.invoke("admin-provision-user", { body: { action: "list-admins", instituteId } });
      if (result.error) setError(result.error.message || "Unable to load administrators.");
      else setAdmins(result.data?.admins || []);
      setLoading(false);
    };
    void load();
  }, [instituteId]);

  const sendRecovery = async () => {
    setNotice("");
    setError("");
    if (!validEmail(email)) { setError("A verified recovery email is not available for this account."); return; }
    setRecoveryLoading(true);
    try {
      const { data, error: recoveryError } = await supabase.functions.invoke("password-recovery-request", { body: { role: "admin", identifier: email.trim() } });
      if (recoveryError) {
        let detail = "";
        try { const body = await recoveryError.context?.json?.(); detail = body?.error || ""; } catch { /* ignore */ }
        throw new Error(detail || recoveryError.message || "Unable to start password recovery.");
      }
      setNotice(data?.message || "If password recovery is configured for this account, a recovery message has been requested.");
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : "Unable to start password recovery. Please try again.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  return <><AccountHeader title="Security & Access" description="Review administrator access and password security." /><div className="aap-grid"><section className="aap-card"><div className="aap-card-title"><div><h2>Signed-in account</h2><p>Private account details.</p></div><span className="aap-pill">Administrator</span></div><div className="aap-detail"><span>Administrator</span><strong>{user.name || "Admin"}</strong></div><div className="aap-detail"><span>Access level</span><strong>Full administrator</strong></div><div className="aap-detail"><span>Session</span><strong>Active</strong></div><button type="button" className="aap-secondary" onClick={sendRecovery} disabled={recoveryLoading}>{recoveryLoading ? "Sending secure recovery link…" : "Request password recovery"}</button>{notice && <div className="aap-success">{notice}</div>}{error && <div className="aap-error">{error}</div>}<p className="aap-privacy-note">Your login email is kept private and is never displayed here.</p></section><section className="aap-card"><div className="aap-card-title"><div><h2>Administrator access</h2><p>Accounts with administrator privileges.</p></div><span className="aap-count">{loading ? "…" : admins.length}</span></div>{loading ? <div className="aap-muted">Loading administrators…</div> : <div className="aap-admin-list">{admins.map((admin) => { const initial = (admin.name || "A").trim().charAt(0).toUpperCase(); return <div className="aap-admin-row" key={admin.id}><div className="aap-mini-avatar">{initial}</div><div><strong>{admin.name || "Admin"}</strong><span>Administrator</span></div><div className="aap-admin-meta"><small>{admin.current ? "Current" : "Admin"}</small><span>Last sign-in: {prettyDate(admin.last_sign_in_at)}</span></div></div>; })}{!admins.length && <div className="aap-muted">No administrator accounts found.</div>}</div>}</section></div></>;
}

function CreateAdminPage() {
  const { instituteId } = useInstituteWorkspace();
  const [name, setName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim() || !loginEmail.trim()) { setError("Name and login email are required."); return; }
    if (!validEmail(loginEmail)) { setError("Enter a valid administrator email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!instituteId) { setError("An active institute workspace must be selected."); return; }
    setLoading(true);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-provision-user", { body: { action: "create", role: "admin", loginId: loginEmail.trim(), password, name: name.trim(), instituteId } });
    if (invokeError) setError(invokeError.message || "Unable to create administrator account.");
    else if (data?.error) setError(data.error);
    else if (!data?.authId) setError("Administrator authentication account was created, but no account ID was returned for institute linking.");
    else {
      const { error: membershipError } = await supabase.rpc("sync_institute_account_membership", {
        p_institute_id: instituteId,
        p_auth_id: data.authId,
        p_role_key: "admin",
        p_name: name.trim(),
        p_email: String(data.email || loginEmail.trim()),
        p_phone: loginEmail.trim(),
        p_ref: null,
      });
      if (membershipError) {
        setError(`Administrator account was created but institute access could not be linked: ${membershipError.message}`);
      } else {
        setSuccess(`Administrator account created successfully. Login: ${data?.email || loginEmail.trim()}`);
        setName(""); setLoginEmail(""); setPassword(""); setConfirm("");
      }
    }
    setLoading(false);
  };

  return <><AccountHeader title="Create Admin Account" description="Create another secure administrator account without exposing service credentials to the browser." /><div className="aap-create-layout"><section className="aap-card"><div className="aap-card-title"><div><h2>New administrator</h2><p>Use a unique email address and a strong password.</p></div><span className="aap-pill">Admin only</span></div><form onSubmit={submit} className="aap-form"><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Institute Administrator" autoComplete="name" /></label><label>Login email<input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@institute.com" autoComplete="username" /></label><label>Password<div className="aap-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" /><button type="button" className="aap-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}><EyeIcon open={showPassword} /></button></div></label><label>Confirm password<div className="aap-password"><input type={showConfirm ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" /><button type="button" className="aap-password-toggle" aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"} title={showConfirm ? "Hide password" : "Show password"} onClick={() => setShowConfirm((value) => !value)}><EyeIcon open={showConfirm} /></button></div></label>{error && <div className="aap-error">{error}</div>}{success && <div className="aap-success">{success}</div>}<button className="aap-primary" disabled={loading}>{loading ? "Creating account…" : "Create Admin Account"}</button></form></section><aside className="aap-card aap-note"><h2>Security checklist</h2><div>✓ Only an authenticated administrator can create accounts.</div><div>✓ Service-role credentials never reach the browser.</div><div>✓ Passwords are sent only to the secure server-side function.</div><div>✓ Password fields stay hidden until the eye button is tapped.</div><div>✓ The new account is assigned the <strong>admin</strong> role.</div></aside></div></>;
}

export default function AdminAccountPage({ user, mode }: Props) {
  if (mode === "profile") return <ProfilePage user={user} />;
  if (mode === "security") return <SecurityPage user={user} />;
  return <CreateAdminPage />;
}
