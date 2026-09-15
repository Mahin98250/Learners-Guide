# Local-only E2E runbook

This project can run the full QA browser stack without GitHub Actions and without touching production Supabase.

## Required local tools

- Node.js 22+
- npm
- Docker Desktop/Engine with Compose
- PostgreSQL client (`psql`)

Verify them with:

```bash
npm run test:e2e:local
```

The runner performs a preflight before changing the repository. If Docker or `psql` is missing, it stops immediately.

## What the runner does

1. Validates the deterministic fixture against the production-derived structural baseline.
2. Runs regression tests, ESLint, and TypeScript checks.
3. Temporarily quarantines historical production migrations so they are not replayed.
4. Generates the controlled QA bootstrap SQL.
5. Starts a fresh local Supabase stack.
6. Refuses any non-local Supabase target.
7. Applies only the production-derived structural baseline to the local database.
8. Verifies tables, columns, constraints, indexes, functions, triggers, RLS, policies, grants, extensions, views, and managed Storage configuration.
9. Seeds synthetic E2E identities and domain rows only into the local database.
10. Builds the app against the local Supabase instance.
11. Runs desktop security/RLS tests.
12. Runs the remaining browser flows on desktop and mobile Chromium.
13. Stops the local Supabase stack and restores the migration directory.

## Safety rules

- Never point `E2E_SUPABASE_URL` or `VITE_SUPABASE_URL` at production.
- Never provide production service-role credentials to the E2E runner.
- Never commit `playwright/.auth`, test results, local database data, or secrets.
- The service-role key is used only by local bootstrap/seed setup and is never used by browser tests.
- The production-derived baseline contains structure only; it is not an executable production migration.

## Current limitation

The repository can contain and orchestrate the entire local QA system, but the actual local Supabase stack requires Docker and the PostgreSQL client on the machine where the command is executed. GitHub Actions is intentionally not required.
