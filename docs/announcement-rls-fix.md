# Announcement RLS fix

The Admin Announcements page could read the table but could not create a row because the production `announcements` table had only its authenticated SELECT policy after RLS consolidation.

The migration restores INSERT, UPDATE, and DELETE policies restricted to `public.app_role() = 'admin'`. Audience visibility remains controlled by the existing SELECT policy.
