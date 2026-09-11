# QA Bootstrap

This directory defines the executable starting point for the isolated E2E database.

## Source of truth

`supabase/schema-baseline/production-derived-schema-baseline.json` is a **current-production structural snapshot**. It is not a historical migration and does not replace the repository migration history.

## Generation

`node supabase/qa/bootstrap/generate-bootstrap.mjs`

This produces:

`supabase/qa/bootstrap/production-derived-bootstrap.sql`

The generator fails loudly when required structural information is missing. It does not invent migrations.

## Deliberate exclusions

- PostgreSQL-generated table composite row types (`kind=c`) are not emitted as `CREATE TYPE`.
- Supabase-managed `auth.users` is not recreated.
- Supabase-managed `storage.objects` is not recreated.
- Production data and historical data/backfill migrations are not replayed.
- Storage files and Auth credentials are not included.
- Production URLs must never be used by this bootstrap.

## Ordering

The generated SQL uses these dependency stages:

1. extensions
2. independent enum types (none currently)
3. application tables/columns
4. constraints
5. defaults
6. views that are safe to recreate
7. functions
8. triggers
9. indexes
10. RLS enablement
11. RLS policies
12. table/routine grants
13. storage bucket configuration and Storage policies

Function defaults are deliberately delayed until after function creation.

## Security rule

This bootstrap is for Local Supabase only. The later E2E startup guard must refuse any hosted production Supabase URL before the application or tests start.

## Historical migrations

The repository's 81 historical migrations remain untouched. They are not blindly replayed on top of this current-state baseline.

A migration should only be added to the QA bootstrap if later evidence proves it represents a required post-baseline structural change.
