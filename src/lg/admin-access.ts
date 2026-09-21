import { getCurrentUser, type AuthUser } from "@/lg/auth";
import { getCurrentInstituteContext, hasInstitutePermission, type InstituteMembershipContext, type InstituteTenant } from "@/lg/tenant";

export type VerifiedAdminAccess = {
  user: AuthUser;
  tenant: InstituteTenant | null;
  membership: InstituteMembershipContext;
  memberships: InstituteMembershipContext[];
  permission: string;
};

export async function getVerifiedAdminAccess(
  permission = "people.manage",
): Promise<VerifiedAdminAccess | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const context = await getCurrentInstituteContext();
  const membership = context.membership;
  if (!membership || membership.status !== "active") return null;

  const allowed = await hasInstitutePermission(membership.institute_id, permission);
  if (!allowed) return null;

  return {
    user,
    tenant: context.tenant,
    membership,
    memberships: context.memberships,
    permission,
  };
}
