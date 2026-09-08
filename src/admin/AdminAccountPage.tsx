import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";
import "@/admin/admin-account.css";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type AdminAccount = { id: string; email: string; name: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; current: boolean };
type Props = { user: AdminUser; mode: "profile" | "security" | "create"; onLogout: () => void };

const prettyDate = (value: string | null) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";
const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

function AccountHeader({ title, description }: { title: string; description: string }) {
  return <div className="aap-header"><div><span>ACCOUNT & SECURITY</span><h1>{title}</h1><p>{description}</p></div><div className="aap-lock">🔒 <span>Protected</span></div></div>;
}

function ProfilePage({ user }: { user: AdminUser }) {
  const initial = (user.name || "A").trim().charAt(0).toUpperCase();
  return <><AccountHeader title="Admin Profile" description="Your administrator identity and account details." /><div className="aap-grid"><section className="aap-card aap-profile-card"><div className="aap-large-avatar">{initial}</div><div><h2>{user.name || "Admin"}</h2><p>Administrator</p><span className="aap-status">● Signed in</span></div></section><section className="aap-card"><h2>Account information</h2><div className="aap-detail"><span>Name</span><strong>{user.name || "Admin"}</strong></div><div className="aap-detail"><span>Role</span><strong>Administrator</strong></div><div className="aap-detail"><span>Login phone / ID</span><strong>{user.phone || "Not provided"}</strong></div><div className="aap-detail"><span>Account reference</span><strong>Administrator account</strong></div></section></div></>;
}

function SecurityPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) { setError(sessionError.message); setLoading(false); return; }
      setEmail(data.session?.user?.email || "Not available");
      const result = await supabase.functions.invoke("admin-provision-user", { body: { action: "list-admins" } });
      if (result.error) setError(result.error.message || "Unable to load administrators.");
      else setAdmins(result.data?.admins || []);
      setLoading(false);
    };
    void load();
  }, []);

  const sendRecovery = async () => {
    setNotice("");
    setError("");
    if (!validEmail(email)) { setError("No verified email address is available for this account."); return; }
    const { data, error: recoveryError } = await supabase.functions.invoke("password-recovery-request", { body: { role: "admin", identifier: email.trim() } });
    if (recoveryError) setError(recoveryError.message || "Unable to start password recovery.");
    else setNotice(data?.message || "If password recovery is configured for this account, a recovery message has been requested.");
  };

  return <><AccountHeader title="Security & Access" description="Review administrator access and password security." /><div className="aap-grid"><section className="aap-card"><div className="aap-card-title"><div><h2>Signed-in account</h2><p>Current authentication details.</p></div><span className="aap-pill">Administrator</span></div><div className="aap-detail"><span>Email</span><strong>{email}</strong></div><div className="aap-detail"><span>Access level</span><strong>Full administrator</strong></div><div className="aap-detail"><span>Session</span><strong>Active</strong></div><button type="button" className="aap-secondary" onClick={sendRecovery}>Request password recovery</button>{notice && <div className="aap-success">{notice}</div>}{error && <div className="aap-error">{error}</div>}</section><section className="aap-card"><div className="aap-card-title"><div><h2>Administrator access</h2><p>Accounts with administrator privileges.</p></div><span className="aap-count">{loading ? "…" : admins.length}</span></div>{loading ? <div className="aap-muted">Loading administrators…</div> : <div className="aap-admin-list">{admins.map((admin) => { const initial = (admin.name || "A").trim().charAt(0).toUpperCase(); return <div className="aap-admin-row" key={admin.id}><div className="aap-mini-avatar">{initial}</div><div><strong>{admin.name || "Admin"}</strong><span>{admin.email || "No email"}</span></div><div className="aap-admin-meta"><small>{admin.current ? "Current" : "Admin"}</small><span>Last sign-in: {prettyDate(admin.last_sign_in_at)}</span></div></div>; })}{!admins.length && <div className="aap-muted">No administrator accounts found.</div>}</div>}</section></div></>;
}

function CreateAdminPage() {
  const [name, setName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    setLoading(true);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-provision-user", { body: { action: "create", role: "admin", loginId: loginEmail.trim(), password, name: name.trim() } });
    if (invokeError) setError(invokeError.message || "Unable to create administrator account.");
    else if (data?.error) setError(data.error);
    else { setSuccess(`Administrator account created successfully. Login: ${data?.email || loginEmail.trim()}`); setName(""); setLoginEmail(""); setPassword(""); setConfirm(""); }
    setLoading(false);
  };

  return <><AccountHeader title="Create Admin Account" description="Create another secure administrator account without exposing service credentials to the browser." /><div className="aap-create-layout"><section className="aap-card"><div className="aap-card-title"><div><h2>New administrator</h2><p>Use a unique email address and a strong password.</p></div><span className="aap-pill">Admin only</span></div><form onSubmit={submit} className="aap-form"><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Institute Administrator" autoComplete="name" /></label><label>Login email<input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@institute.com" autoComplete="username" /></label><label>Password<div className="aap-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label><label>Confirm password<input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" /></label>{error && <div className="aap-error">{error}</div>}{success && <div className="aap-success">{success}</div>}<button className="aap-primary" disabled={loading}>{loading ? "Creating account…" : "Create Admin Account"}</button></form></section><aside className="aap-card aap-note"><h2>Security checklist</h2><div>✓ Only an authenticated administrator can create accounts.</div><div>✓ Service-role credentials never reach the browser.</div><div>✓ Passwords are sent only to the secure server-side function.</div><div>✓ The new account is assigned the <strong>admin</strong> role.</div></aside></div></>;
}

export default function AdminAccountPage({ user, mode }: Props) {
  if (mode === "profile") return <ProfilePage user={user} />;
  if (mode === "security") return <SecurityPage />;
  return <CreateAdminPage />;
}
