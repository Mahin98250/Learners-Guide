# Production Safety

This bootstrap is intentionally designed as a QA-only mechanism.

The source snapshot came from production, but it contains structural metadata only. It must never be used as a production migration.

Any command that applies `production-derived-bootstrap.sql` MUST first verify that the target Supabase endpoint is local (for example, `http://127.0.0.1:54321`) and explicitly reject the hosted production ref `efnxjfzyqbdulpjhffsm`.

No production application rows, Auth users, passwords, tokens, or Storage files are used by this bootstrap.
