# Phase 7 — Notification Delivery Pipeline

## Started

This increment adds the durable delivery layer underneath the Phase 7 Notifications & Integrations Center.

### What it adds

- `notification_delivery_jobs` stores one durable job per notification, recipient and external channel.
- Supported channels are:
  - `web_push`
  - `email`
  - `whatsapp`
  - `sms`
- Jobs have explicit lifecycle states:
  - pending
  - processing
  - sent
  - failed
  - blocked
  - cancelled
- Duplicate delivery jobs are prevented with a unique notification/recipient/channel constraint.
- Delivery jobs are tenant-scoped and readable only through the existing integration permission boundary.
- New notifications automatically enqueue jobs according to the recipient's institute role, event type, channel preference and enabled integration.
- If an integration is enabled in the database but its secure provider configuration is not present, the job is marked `blocked` instead of being repeatedly retried.

### Security boundary

The browser does not receive provider credentials. The enqueue function is server-side and the delivery-job table has no client write policy.

### Provider status

This increment intentionally does **not** claim that Email, WhatsApp or SMS delivery is live. The durable queue is now ready for the server-side provider adapters.

Browser push continues to use the existing `web-push` infrastructure; the next delivery increment can consume the queued `web_push` jobs without changing the existing subscription model.

## Verification

`test/phase7-notification-delivery-pipeline.test.mjs` verifies the queue schema, tenant/permission boundary, role/event routing, provider readiness behavior and automatic enqueue trigger.
