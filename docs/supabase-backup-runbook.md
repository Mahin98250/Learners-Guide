# Learner's Guide — Supabase Database Backup Runbook

## What was implemented

The repository now contains `.github/workflows/supabase-backup.yml`.

The workflow:

- runs automatically once every 24 hours at 00:00 UTC;
- can also be started manually from GitHub Actions with **Run workflow**;
- uses the official `supabase/setup-cli` action and Supabase CLI `db dump` commands;
- exports roles, schema, and data as separate PostgreSQL dump files;
- validates that the dump files are non-empty PostgreSQL dumps;
- packages the dump into a timestamped `.tar.gz` archive and verifies the archive can be read;
- uploads the archive to a **private GitHub Actions artifact** instead of committing backup data to Git;
- keeps each successful backup as a separate artifact for **30 days**;
- fails the workflow when the database secret is missing or any dump/validation step fails;
- uses a concurrency guard so overlapping backup runs do not race each other;
- never writes to the production database.

GitHub Actions artifacts are separate from repository commits. The repository itself is private, and private repositories can retain Actions artifacts for configurable periods; this workflow sets a 30-day retention per backup. See GitHub's current artifact-retention documentation for account/repository limits.

## Secure backup destination

The selected destination is GitHub Actions artifact storage. It is appropriate for the current small Free-plan Learner's Guide database because it is private, versioned per workflow run, not part of the Git history, and supports automatic expiry.

This is still not a perfect disaster-recovery design because the backup remains tied to the GitHub account/repository. For stronger resilience against GitHub account loss, repository deletion, or organization-level compromise, add an **independent encrypted object-storage destination** later (for example, a private S3-compatible bucket with lifecycle retention). Do not use a public bucket.

## Required GitHub Secret

Create this repository secret:

- `SUPABASE_DB_URL` — the Supabase PostgreSQL connection string for the production database, including the database password.

Example shape only (never commit a real value):

`postgresql://postgres.<PROJECT-REF>:[PASSWORD]@<POOLER-HOST>:5432/postgres`

Recommended practice: use the Session Pooler connection string shown in the Supabase **Connect** panel unless the project/network specifically requires another connection method.

Never put a database password, access token, service-role key, publishable key, or any other credential into this repository or workflow source.

## Frequency and retention

- Automatic schedule: every 24 hours (`0 0 * * *`, UTC).
- Manual run: GitHub → Actions → **Supabase Database Backup** → **Run workflow**.
- Backup artifact retention: 30 days per artifact.
- Old artifacts are automatically removed by GitHub after their retention period.

## What is included

The workflow creates three logical database dumps:

1. `roles.sql` — custom database roles where supported by the CLI dump.
2. `schema.sql` — database schema objects handled by Supabase CLI.
3. `data.sql` — application database data.

Supabase's CLI `db dump` intentionally excludes Supabase-managed/internal schemas such as `auth` and `storage`. Therefore this backup is a backup of the application database managed by the CLI, **not a complete Supabase project clone**.

The repository's source code and migration files are also separate from the database artifact and remain in Git.

## What is not included

The following require separate handling:

- Supabase Storage file bytes/objects.
- Supabase-managed Auth contents such as `auth.users`.
- Edge Function deployment state and secrets.
- External provider configuration such as SMTP/OAuth settings.
- DNS/custom-domain configuration.
- Any credentials themselves.

Supabase documents that database backups do not automatically include Storage objects. Storage metadata may exist in the database, but the actual files are stored separately.

## Restore procedure

Restore into a **new/test Supabase project first**. Do not experiment directly against production.

1. Download the desired private backup artifact from the GitHub Actions run.
2. Extract the archive and verify the SHA-256 hash from `sha256.txt`.
3. Obtain a connection string for the target Supabase PostgreSQL database.
4. Restore with `psql` using the extracted files, following Supabase's documented restore order:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$TARGET_DB_URL"
```

5. Validate the restored tables and key row counts before using the project.
6. Reconfigure anything that is outside the database dump, especially Storage objects, Auth configuration, Edge Functions, SMTP/OAuth, and other platform settings.

If the target project uses a different PostgreSQL/Supabase version, test the restore in a disposable environment first.

## Backup validation

Every workflow run performs these checks before uploading the artifact:

- required secret exists and has a PostgreSQL URL shape;
- roles, schema, and data files exist and are non-empty;
- each file contains a PostgreSQL dump header;
- the final archive can be listed successfully;
- the SHA-256 checksum is generated.

A failed check causes the GitHub Actions job to fail, making the backup failure visible in Actions.

## Storage backup requirement

Learner's Guide actively uses Supabase Storage for application files. The production code contains reads/uploads/downloads against the `materials` Storage bucket, and the current Supabase project has Storage objects.

Therefore:

**Database backups do not back up the actual Storage files.**

A separate Storage backup should later copy the `materials` bucket (and any future buckets) to an independent private object-storage destination with encryption and lifecycle retention. That process should preserve object paths and metadata and should itself be verified with periodic restore tests.

## Current verification status

Repository-side verification completed:

- no pre-existing database-backup workflow was found in `.github/workflows` before this implementation;
- the workflow is stored in `.github/workflows/supabase-backup.yml`;
- the repository remains private;
- application code, database tables, RLS policies, authentication, and production data are not modified by the workflow;
- local backup output patterns are ignored by `.gitignore` to reduce accidental commits.

**Live backup test status:** the workflow requires the repository secret `SUPABASE_DB_URL`. The available repository tooling cannot read or create GitHub Secret values, so this environment cannot truthfully certify a live production backup until that secret exists in GitHub and the workflow is run.

Once `SUPABASE_DB_URL` is configured, the first manual run should be treated as the acceptance test. Success requires a green job and a downloadable `supabase-db-backup-<run-id>` artifact containing the archive and checksum.
