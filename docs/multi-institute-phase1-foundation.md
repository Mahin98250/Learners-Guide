# Multi-Institute Foundation — Phase 1

This is the first implementation phase of converting the current single-institute Mahin application into a multi-institute SaaS.

## Added now

- `institutes`: one customer/institute per tenant.
- `people`: one global identity linked to Supabase Auth.
- `institute_memberships`: the person's role inside an institute.
- `platform_memberships`: separate SaaS control-plane access.
- `institute_settings`: institute branding/settings.
- `institute_domains`: default subdomains and customer-owned custom domains.

## Existing data bridge

The current production data is treated as the original tenant:

```text
Institute name: Mahin
Slug: mahin
```

Existing authenticated users are copied into `people` and linked through `institute_memberships`.

Current mapping:

```text
admin   -> institute_admin
teacher -> teacher
student -> student
parent  -> parent
```

A platform owner is **not** guessed or created automatically.

## Legacy table staging

The following current institute-owned tables receive a nullable `institute_id`:

```text
academic_years, announcements, attendance, batch_students,
batch_teachers, batches, examschedule, fees, homework,
leave_requests, marks, material_folders, materials, messages,
notifications, parent_student_links, rooms, students, subjects,
teachers, test_results, tests, timetable, timetable_entries
```

Existing rows are backfilled to the Mahin tenant.

The column is intentionally nullable in Phase 1 because the current UI still writes the legacy schema. Making it required before converting all writes would break production.

## Custom domains

The registry can later hold entries such as:

```text
abc.your-platform.com
portal.abcacademy.com
```

The second example is a custom domain owned by the institute.

A custom domain is only a **different web address** for the same application. It does not create another codebase or database.

The public `resolve_institute_domain(hostname)` function returns only the verified institute and branding information needed to render a login portal.

## What is deliberately not enabled yet

- no second institute onboarding;
- no tenant-aware RLS replacement;
- no required `institute_id` constraint;
- no automatic DNS/TLS provisioning;
- no final SaaS company name/domain selection.

Those belong to later phases.

## Next phase

Phase 2 will convert the application to select a tenant from the request hostname + authenticated membership, introduce permission-based roles, and replace the current global-role RLS with institute-scoped authorization. Only after that will a second institute be enabled.
