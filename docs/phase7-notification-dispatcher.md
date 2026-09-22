# Phase 7 — Notification Dispatcher

## What this increment adds

Phase 7 now has a server-side worker boundary for the durable notification queue.

### 1. Atomic job claiming

The database function notification_claim_delivery_jobs(limit) claims pending/retryable jobs with PostgreSQL row locking:

- only one worker can claim a job at a time;
- stale processing jobs older than 10 minutes are returned to the retry queue;
- attempts are incremented when a job is claimed;
- the batch is capped at 100 jobs per invocation.

The function is restricted to service_role.

### 2. Notification dispatcher Edge Function

supabase/functions/notification-dispatcher/index.ts is the server-side dispatcher.

It:

1. authenticates with a server-only NOTIFICATION_DISPATCHER_SECRET;
2. claims a bounded batch;
3. selects an adapter by channel;
4. sends web_push through the existing web-push Edge Function;
5. records sent, blocked, or failed state;
6. retries transient failures with exponential backoff;
7. stops retrying after five failed attempts;
8. never exposes provider credentials to the browser.

### 3. Provider adapter boundary

The adapter contract is intentionally provider-neutral.

Current state:

- web_push: wired to the existing server-side web-push implementation;
- email: adapter boundary exists, provider not configured;
- whatsapp: adapter boundary exists, provider not configured;
- sms: adapter boundary exists, provider not configured.

This means Phase 7 does not falsely mark Email, WhatsApp, or SMS as live.

## Secrets

No provider secrets belong in Git.

The dispatcher expects:

- NOTIFICATION_DISPATCHER_SECRET — secret used by cron/worker callers;
- Supabase server credentials supplied by the Edge Function runtime;
- existing web-push internal configuration remains in the database/server boundary.

Supabase recommends storing Edge Function secrets in the project secret store rather than committing them to source control.

## Running the worker

The dispatcher is intentionally an HTTP worker rather than a browser task.

It can be invoked by:

- Supabase Cron / pg_cron;
- another trusted server-side worker;
- a controlled operational job.

A production deployment should schedule it at a short interval appropriate for the institute's notification volume. The schedule itself is not committed here because the project still needs its production secret and provider configuration.

## Retry behavior

Transient failures use exponential backoff:

- attempt 1 → about 1 minute;
- attempt 2 → about 2 minutes;
- attempt 3 → about 4 minutes;
- attempt 4 → about 8 minutes;
- attempt 5 → terminal failed state.

Provider configuration problems are marked blocked instead of being retried endlessly.

## Security boundary

The browser never receives:

- Email API keys;
- WhatsApp API tokens;
- SMS provider credentials;
- the dispatcher secret;
- the web-push internal secret.

The queue is durable, tenant-scoped, and already protected by RLS for administrator reads. The dispatcher operates with server-side privileges only.
