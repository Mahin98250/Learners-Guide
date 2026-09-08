# Parent portal performance pass — 2026-09-08

The parent portal now lazy-loads the heavier Homework, Analytics, and Notifications modules. The dashboard shell keeps its existing data-fetching behavior while deferring those UI modules until their sections are actually rendered.

Scope is code-only: no database/schema/plan/profile-photo changes.
