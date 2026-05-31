import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organization_id, name, description, user_id } = body;

    if (!organization_id || !name || !user_id) {
      return NextResponse.json(
        { error: "Organization ID, name, and user ID are required" },
        { status: 400 }
      );
    }

    // Check permission at organization level
    const canCreate = await hasPermission(user_id, organization_id, "CREATE_PROJECT", supabaseAdmin);
    if (!canCreate) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to create projects in this organization" },
        { status: 403 }
      );
    }

    // Insert project
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .insert({
        organization_id,
        name,
        description: description || "",
        created_by: user_id,
      })
      .select()
      .single();

    if (projectError) {
      console.error("Error creating project:", projectError);
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // Add the creator as editor in project_members
    const { error: memberError } = await supabaseAdmin
      .from("project_members")
      .insert({
        project_id: project.id,
        user_id: user_id,
        role: "editor",
      });

    if (memberError) {
      console.error("Error adding project creator to members:", memberError);
      // We don't fail the request since project was created, but log it
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Unexpected error in project creation:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: "Project ID and user ID are required" },
        { status: 400 }
      );
    }

    const canDelete = await hasPermission(userId, projectId, "DELETE_PROJECT", supabaseAdmin);
    if (!canDelete) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to delete this project" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      console.error("Error deleting project:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in project deletion:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
