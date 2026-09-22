# Phase 7 — Notifications & Integrations Center

## Goal

Give each institute administrator one tenant-scoped control center for notification delivery channels and default notification preferences.

## Implemented in this phase

- Added `institute_notification_integrations` for tenant-scoped channel state.
- Added `institute_notification_preferences` for role/event/channel defaults.
- Added explicit permissions:
  - `notifications.read`
  - `notifications.manage`
  - `integrations.read`
  - `integrations.manage`
- Added restrictive RLS policies using the existing institute permission helpers.
- Seeded existing and newly provisioned institutes with:
  - In-app notifications
  - Browser push
  - Email
  - WhatsApp
  - SMS
- Added the **Notifications & Integrations** page to the modern institute admin portal.
- Provider secrets are intentionally not stored in the client-facing configuration tables.
- Email, WhatsApp and SMS remain disabled until their secure server-side provider configuration exists.
- Existing notification delivery remains compatible with the current `notifications` table and web-push function.

## Notification events covered

- Announcements
- Homework
- Study materials
- Attendance
- Timetable
- Messages

## Security model

The center is institute-scoped. Read/write access is enforced by Supabase RLS and the existing `user_has_institute_permission` authorization helper. The UI is not the security boundary.

## Verification contract

`test/phase7-notifications-integrations.test.mjs` checks that the migration contains the tenant tables, permission guards, secret-storage boundary, and that the admin portal exposes the new center.

## Not claimed yet

This phase does **not** claim that external Email, WhatsApp or SMS delivery is live. Those providers require separate server-side credentials and delivery implementations. Browser push is already backed by the existing `web-push` function and subscription flow.

