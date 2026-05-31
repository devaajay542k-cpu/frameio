import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!organizationId || !userId) {
      return NextResponse.json(
        { error: "Organization ID and user ID are required" },
        { status: 400 }
      );
    }

    // 1. Verify that the requesting user is a member of the organization
    const { data: requester } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Fetch all members of the organization
    const { data: members, error: membersError } = await supabaseAdmin
      .from("organization_members")
      .select("*")
      .eq("organization_id", organizationId);

    if (membersError) {
      throw membersError;
    }

    // 3. Enrich members with data from auth.users using admin auth listUsers
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();

    const enrichedMembers = members.map(m => {
      const authUser = authUsers?.users?.find(u => u.id === m.user_id);

      // Default to email prefix if full name is missing
      const email = authUser?.email || "unknown@studio.com";
      const name = authUser?.user_metadata?.full_name || email.split("@")[0] || "Unknown User";
      const avatar = authUser?.user_metadata?.avatar_url || "";

      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        name,
        email,
        avatar,
      };
    });

    return NextResponse.json(enrichedMembers);
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
