// Handle stale persisted sessions before they cascade into repeated 400
// refresh-token requests. Auth events can surface an error through the SDK's
// internal session manager, so callers can also invoke this helper when a
// request reports refresh_token_not_found.
export function clearInvalidAuthSession() {
  if (recoveryInProgress) return;
  recoveryInProgress = true;
  clearStoredAuth();
  void supabase.auth.signOut({ scope: "local" }).catch(() => {});
  window.setTimeout(() => {
    recoveryInProgress = false;
  }, 1000);
}

export function isInvalidRefreshTokenError(error: unknown) {
  const message = String((error as { message?: unknown })?.message || error || "").toLowerCase();
  return message.includes("invalid refresh token") ||
    message.includes("refresh_token_not_found") ||
    message.includes("refresh token not found");
}
