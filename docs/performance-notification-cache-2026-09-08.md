# Notification feed performance pass — 2026-09-08

## Root cause
The lazy parent notification panel fetched the authenticated user and the notification list every time the panel mounted. Multiple opens close together therefore repeated the same user-scoped read.

## Change
Use a 5-second in-memory cache plus in-flight request deduplication keyed by authenticated user ID. The notification table query remains unchanged and RLS remains the authorization boundary. Cache entries are explicitly cleared after notification mutations.

## Expected effect
Rapid repeated panel opens or concurrent mounts reuse the completed feed or the same in-flight request instead of issuing another identical read. The short TTL limits staleness while avoiding a persistent client-side source of truth.
