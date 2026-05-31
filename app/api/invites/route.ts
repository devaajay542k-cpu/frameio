import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { organizationId, email, role, userId } = await request.json();

    if (!organizationId || !email || !role || !userId) {
      return NextResponse.json(
        { error: "Organization ID, email, role, and current user ID are required" },
        { status: 400 }
      );
    }

    // 1. Check invite permission at organization level
    const canInvite = await hasPermission(userId, organizationId, "INVITE_MEMBER", supabaseAdmin);
    if (!canInvite) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to invite members to this organization" },
        { status: 403 }
      );
    }

    // 2. Generate a secure invite token
    const token = crypto.randomBytes(24).toString("hex");

    // 3. Create organization invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase().trim(),
        role,
        token,
        invited_by: userId,
        accepted: false,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json(invite);
  } catch (error) {
    console.error("Unexpected error in invite creation:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const userId = searchParams.get("userId");

    if (!organizationId || !userId) {
      return NextResponse.json(
        { error: "Organization ID and user ID are required" },
        { status: 400 }
      );
    }

    // Only organization members can view invites
    const { data: isMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized: You are not a member of this organization" }, { status: 403 });
    }

    // Fetch invites
    const { data: invites, error } = await supabaseAdmin
      .from("organization_invites")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invites:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(invites);
  } catch (error) {
    console.error("Unexpected error fetching invites:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("inviteId");
    const userId = searchParams.get("userId");

    if (!inviteId || !userId) {
      return NextResponse.json(
        { error: "Invite ID and user ID are required" },
        { status: 400 }
      );
    }

    const { data: invite } = await supabaseAdmin
      .from("organization_invites")
      .select("organization_id")
      .eq("id", inviteId)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const canInvite = await hasPermission(userId, invite.organization_id, "INVITE_MEMBER", supabaseAdmin);
    if (!canInvite) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to manage invites for this organization" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("organization_invites")
      .delete()
      .eq("id", inviteId);

    if (deleteError) {
      console.error("Error deleting invite:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Invite canceled successfully" });
  } catch (error) {
    console.error("Unexpected error in invite cancelation:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
