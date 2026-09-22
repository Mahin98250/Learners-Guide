# Mahin — Supabase Restore Runbook

## What this adds

The repository now contains a manual GitHub Actions restore workflow at `.github/workflows/supabase-restore.yml` and a Storage restore helper at `scripts/restore-supabase-backup.py`.

The intended operator flow is:

1. Create a separate/new Supabase project for the recovery test or migration target.
2. Save the target project's HTTPS URL as the GitHub secret `LG_RESTORE_SUPABASE_URL`.
3. Save the target project's PostgreSQL connection string from its Connect panel as `LG_RESTORE_DB_URL`.
4. Save the target project's service-role/secret key as `LG_RESTORE_SERVICE_ROLE_KEY`.
5. In GitHub, open **Actions → Restore Supabase Backup → Run workflow**.
6. Enter the backup workflow **run ID** that produced the desired `supabase-complete-backup-RUN_ID` artifact.
7. Type `RESTORE_TO_NEW_PROJECT` exactly in the confirmation field.
8. Start the workflow and wait for the result.

## What the workflow does

The workflow:

- downloads the selected backup artifact using the GitHub Actions token;
- verifies the backup tarball with the stored SHA-256 checksum;
- extracts the archive;
- verifies the target is not the current Mahin production project;
- tests the target PostgreSQL connection;
- restores `roles.sql`, `schema.sql`, and `data.sql` in the documented logical restore order;
- recreates Storage buckets and uploads every backed-up Storage object through the supported Supabase Storage API;
- verifies that the destination has public tables and at least the backed-up number of Storage buckets;
- publishes a small restore report artifact.

Supabase documents the roles → schema → data logical restore order for CLI backups, and its current Storage documentation supports creating/updating buckets and uploading objects through the Storage API. See the official documentation before using the workflow for a production migration.

## Important Auth limitation

The current backup workflow stores `auth-users.json` as **Auth user metadata**. It does not export the complete managed Auth schema/credential state. Therefore this restore workflow does **not** recreate Auth accounts or password hashes from `auth-users.json`.

The restored database and Storage data may still reference Auth user IDs. A future full disaster-recovery design should explicitly handle the managed Auth schema and authentication configuration before claiming full account restoration.

## Safety

Do not put a production database connection string or production project URL into the restore secrets. The workflow contains a hard stop for the current Mahin production project reference and URL, but the safest procedure is still to use a dedicated test/recovery Supabase project first.

GitHub Actions automatically masks secrets used in workflow runs. Never echo the database connection string or service-role key into logs.
