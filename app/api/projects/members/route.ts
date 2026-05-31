import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const { projectId, email, role, userId } = await request.json();

    if (!projectId || !email || !role || !userId) {
      return NextResponse.json(
        { error: "Project ID, email, role, and current user ID are required" },
        { status: 400 }
      );
    }

    // 1. Check if the current user has permission to invite members/manage projects
    const canManage = await hasPermission(userId, projectId, "INVITE_MEMBER", supabaseAdmin);
    if (!canManage) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to add members to this project" },
        { status: 403 }
      );
    }

    // 2. Find the user by email in auth.users
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // If not found in public.users, check auth.users (some Supabase instances sync or keep them separate)
    let targetUserId = targetUser?.id;
    if (!targetUserId) {
      // Let's query using admin auth API
      const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      if (!authUsersError && authUsers?.users) {
        const found = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          targetUserId = found.id;
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: `User with email ${email} not found. They must sign up first before being added to projects.` },
        { status: 404 }
      );
    }

    // 3. Add user to organization_members first (if they aren't already)
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("organization_id")
      .eq("id", projectId)
      .single();

    if (project) {
      const { data: existingOrgMember } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("organization_id", project.organization_id)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!existingOrgMember) {
        // Add them as a general member of the organization
        await supabaseAdmin
          .from("organization_members")
          .insert({
            organization_id: project.organization_id,
            user_id: targetUserId,
            role: "member"
          });
      }
    }

    // 4. Insert/Upsert into project_members
    const { data: member, error: insertError } = await supabaseAdmin
      .from("project_members")
      .upsert(
        { project_id: projectId, user_id: targetUserId, role },
        { onConflict: "project_id,user_id" }
      )
      .select()
      .single();

    if (insertError) {
      console.error("Error adding project member:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Unexpected error adding project member:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const targetUserId = searchParams.get("targetUserId");
    const userId = searchParams.get("userId");
    const orgLevel = searchParams.get("orgLevel") === "true";

    if (!projectId || !targetUserId || !userId) {
      return NextResponse.json(
        { error: "Project ID, target user ID, and current user ID are required" },
        { status: 400 }
      );
    }

    // 1. Permission check: user must have INVITE_MEMBER permission
    const canManage = await hasPermission(userId, projectId, "INVITE_MEMBER", supabaseAdmin);
    if (!canManage) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to remove members" },
        { status: 403 }
      );
    }

    // 2. Fetch the project to get the organization_id
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("organization_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 3. Fetch org roles for both the requester and the target
    const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, member: 1 };

    const { data: requesterOrg } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", project.organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: targetOrg } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", project.organization_id)
      .eq("user_id", targetUserId)
      .maybeSingle();

    const requesterRank = ROLE_RANK[requesterOrg?.role || ""] ?? 0;
    const targetOrgRole = targetOrg?.role || "member";
    const targetRank = ROLE_RANK[targetOrgRole] ?? 0;

    // 4. Nobody can remove an owner
    if (targetOrgRole === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the organization owner" },
        { status: 403 }
      );
    }

    // 5. Hierarchy check: requester must outrank the target
    if (requesterRank <= targetRank) {
      return NextResponse.json(
        { error: "You can only remove members with a lower role than yours" },
        { status: 403 }
      );
    }

    if (orgLevel) {
      // Org-level removal: remove the user from the organization entirely
      // This also revokes all their project access
      // First remove any project_members entries for this user in this org's projects
      const { data: orgProjects } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("organization_id", project.organization_id);

      if (orgProjects && orgProjects.length > 0) {
        const projectIds = orgProjects.map(p => p.id);
        await supabaseAdmin
          .from("project_members")
          .delete()
          .in("project_id", projectIds)
          .eq("user_id", targetUserId);
      }

      // Remove from organization_members
      const { error: orgDeleteError } = await supabaseAdmin
        .from("organization_members")
        .delete()
        .eq("organization_id", project.organization_id)
        .eq("user_id", targetUserId);

      if (orgDeleteError) {
        console.error("Error removing organization member:", orgDeleteError);
        return NextResponse.json({ error: orgDeleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Member removed from organization" });
    } else {
      // Project-level removal: only remove from project_members
      // But admins/owners can't be removed at project level (they have inherent access)
      if (targetOrgRole === "admin") {
        return NextResponse.json(
          { error: "Admins have inherent project access. Use org-level removal instead." },
          { status: 403 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", targetUserId);

      if (deleteError) {
        console.error("Error removing project member:", deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Member removed from project" });
    }
  } catch (error) {
    console.error("Unexpected error removing project member:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
