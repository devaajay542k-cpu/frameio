import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Role = "owner" | "admin" | "editor" | "viewer";

export type PermissionAction =
  | "VIEW_VIDEO"
  | "COMMENT"
  | "UPLOAD_VIDEO"
  | "DELETE_VIDEO"
  | "CREATE_PROJECT"
  | "DELETE_PROJECT"
  | "INVITE_MEMBER"
  | "MANAGE_ORGANIZATION";

export const PERMISSION_MATRIX: Record<Role, PermissionAction[]> = {
  owner: [
    "VIEW_VIDEO",
    "COMMENT",
    "UPLOAD_VIDEO",
    "DELETE_VIDEO",
    "CREATE_PROJECT",
    "DELETE_PROJECT",
    "INVITE_MEMBER",
    "MANAGE_ORGANIZATION",
  ],
  admin: [
    "CREATE_PROJECT",
    "DELETE_PROJECT",
    "INVITE_MEMBER",
    "UPLOAD_VIDEO",
    "DELETE_VIDEO",
    "COMMENT",
    "VIEW_VIDEO",
  ],
  editor: [
    "UPLOAD_VIDEO",
    "DELETE_VIDEO",
    "COMMENT",
    "VIEW_VIDEO",
  ],
  viewer: [
    "COMMENT",
    "VIEW_VIDEO",
  ],
};

/**
 * Resolves the user's effective role for a given project or organization ID.
 * Returns null if the user has no access.
 */
export async function getEffectiveRole(
  userId: string,
  projectIdOrOrgId: string,
  client: SupabaseClient = supabase
): Promise<Role | null> {
  if (!userId || !projectIdOrOrgId) return null;

  try {
    // 1. Check if the ID is a project
    const { data: project } = await client
      .from("projects")
      .select("organization_id")
      .eq("id", projectIdOrOrgId)
      .maybeSingle();

    let orgId = projectIdOrOrgId;
    let isProject = false;

    if (project) {
      orgId = project.organization_id;
      isProject = true;
    }

    // 2. Fetch the user's organization member role
    const { data: orgMember } = await client
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    // 3. Organization Owner and Admin roles override project roles
    if (orgMember) {
      if (orgMember.role === "owner") return "owner";
      if (orgMember.role === "admin") return "admin";
    }

    // 4. If we are checking project access, and organization role is "member", check project members
    if (isProject) {
      const { data: projMember } = await client
        .from("project_members")
        .select("role")
        .eq("project_id", projectIdOrOrgId)
        .eq("user_id", userId)
        .maybeSingle();

      if (projMember) {
        return projMember.role as Role;
      }
    }

    // 5. If it's a raw organization check and user is a plain "member" of the organization,
    // they get "viewer" permissions for non-project general things, or we can return member.
    if (!isProject && orgMember && orgMember.role === "member") {
      return "viewer"; // Least privilege org level
    }
  } catch (error) {
    console.error("Error resolving effective role:", error);
  }

  return null;
}

/**
 * Checks if the user has the required permission for the given project or organization context.
 */
export async function hasPermission(
  userId: string,
  projectIdOrOrgId: string,
  action: PermissionAction,
  client: SupabaseClient = supabase
): Promise<boolean> {
  const role = await getEffectiveRole(userId, projectIdOrOrgId, client);
  if (!role) return false;

  const allowedActions = PERMISSION_MATRIX[role];
  if (!allowedActions) return false;

  return allowedActions.includes(action);
}
