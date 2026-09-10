-- Do not silently discard duplicate parent mirror inserts.
-- Parent accounts are intentionally reusable across multiple children.
-- The application now detects an existing (role, phone) parent mirror and
-- updates/reuses it, while the database unique index remains the final
-- concurrency guard. Returning NULL from a BEFORE INSERT trigger made
-- Supabase report a successful insert with zero returned rows.
drop trigger if exists trg_ignore_duplicate_parent_user_mirror on public.users;
drop function if exists public.ignore_duplicate_parent_user_mirror();
