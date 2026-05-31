import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getEffectiveRole } from "@/lib/auth-utils";

export async function PATCH(request: Request) {
  try {
    const { versionId, userId, status, changeNotes, restore } = await request.json();

    if (!versionId || !userId) {
      return NextResponse.json(
        { error: "Version ID and User ID are required" },
        { status: 400 }
      );
    }

    // 1. Fetch version and join with video to get project context
    const { data: version, error: fetchError } = await supabaseAdmin
      .from("video_versions")
      .select("*, videos!video_versions_video_id_fkey(project_id, current_version_id)")
      .eq("id", versionId)
      .maybeSingle();

    if (fetchError || !version || !version.videos) {
      console.error("Error fetching version metadata:", fetchError);
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const projectId = Array.isArray(version.videos)
      ? (version.videos[0] as any)?.project_id
      : (version.videos as any)?.project_id;
    const videoId = version.video_id;

    // 2. Resolve requester's role
    const role = await getEffectiveRole(userId, projectId || videoId, supabaseAdmin);
    if (!role) {
      return NextResponse.json({ error: "Unauthorized: Access denied" }, { status: 403 });
    }

    // 3. Handle Restoring Version (making it the active current version)
    if (restore) {
      if (role !== "owner") {
        return NextResponse.json(
          { error: "Unauthorized: Only the project Owner can restore versions" },
          { status: 403 }
        );
      }

      const { error: restoreError } = await supabaseAdmin
        .from("videos")
        .update({
          current_version_id: versionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      if (restoreError) {
        console.error("Error restoring version:", restoreError);
        return NextResponse.json({ error: restoreError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Version restored successfully" });
    }

    // 4. Handle Status Updates
    if (status !== undefined) {
      // Role validation
      if (status === "Approved") {
        if (role !== "owner") {
          return NextResponse.json(
            { error: "Unauthorized: Only the project Owner can approve versions" },
            { status: 403 }
          );
        }
      } else {
        if (role !== "owner" && role !== "admin") {
          return NextResponse.json(
            { error: "Unauthorized: Only Owners and Admins can manage version status" },
            { status: 403 }
          );
        }
      }

      // Update status (the database trigger will automatically validate if it's the latest version if status is 'Final')
      const { error: statusError } = await supabaseAdmin
        .from("video_versions")
        .update({ status })
        .eq("id", versionId);

      if (statusError) {
        console.error("Error updating status:", statusError);
        // Handle trigger exception
        if (statusError.message.includes("Only the latest version may be marked Final")) {
          return NextResponse.json(
            { error: "Only the latest version may be marked Final." },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: statusError.message }, { status: 500 });
      }
    }

    // 5. Handle Change Notes Updates
    if (changeNotes !== undefined) {
      if (role !== "owner" && role !== "admin" && role !== "editor") {
        return NextResponse.json(
          { error: "Unauthorized: Only Owners, Admins, and Editors can edit revision notes" },
          { status: 403 }
        );
      }

      const { error: notesError } = await supabaseAdmin
        .from("video_versions")
        .update({ change_notes: changeNotes })
        .eq("id", versionId);

      if (notesError) {
        console.error("Error updating change notes:", notesError);
        return NextResponse.json({ error: notesError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Version updated successfully" });
  } catch (error) {
    console.error("Unexpected error in versions PATCH handler:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("versionId");
    const userId = searchParams.get("userId");

    if (!versionId || !userId) {
      return NextResponse.json(
        { error: "Version ID and User ID are required" },
        { status: 400 }
      );
    }

    // 1. Fetch version and join with video to check project context
    const { data: version, error: fetchError } = await supabaseAdmin
      .from("video_versions")
      .select("*, videos!video_versions_video_id_fkey(project_id, current_version_id)")
      .eq("id", versionId)
      .maybeSingle();

    if (fetchError || !version || !version.videos) {
      console.error("Error fetching version metadata:", fetchError);
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const projectId = Array.isArray(version.videos)
      ? (version.videos[0] as any)?.project_id
      : (version.videos as any)?.project_id;
    const videoId = version.video_id;

    // 2. Access control: Only project Owner can delete individual versions
    const role = await getEffectiveRole(userId, projectId || videoId, supabaseAdmin);
    if (role !== "owner") {
      return NextResponse.json(
        { error: "Unauthorized: Only the project Owner can delete version history records" },
        { status: 403 }
      );
    }

    // 3. Delete file from Cloudflare R2
    const key = version.storage_path;
    if (key) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME!;
        const command = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        await r2.send(command);
        console.log(`Successfully deleted R2 object with key: ${key}`);
      } catch (r2Error) {
        console.error("Failed to delete version file from Cloudflare R2:", r2Error);
      }
    }

    // 4. Delete the version record
    const { error: dbDeleteError } = await supabaseAdmin
      .from("video_versions")
      .delete()
      .eq("id", versionId);

    if (dbDeleteError) {
      console.error("Error deleting version from database:", dbDeleteError);
      return NextResponse.json({ error: "Failed to delete version from database" }, { status: 500 });
    }

    // 5. Update the video's current active version if we deleted the current active one
    const currentVersionId = Array.isArray(version.videos)
      ? (version.videos[0] as any)?.current_version_id
      : (version.videos as any)?.current_version_id;

    if (currentVersionId === versionId) {
      // Find the highest remaining version
      const { data: remainingVersions } = await supabaseAdmin
        .from("video_versions")
        .select("id")
        .eq("video_id", videoId)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextActiveVersionId = remainingVersions && remainingVersions.length > 0 ? remainingVersions[0].id : null;

      await supabaseAdmin
        .from("videos")
        .update({
          current_version_id: nextActiveVersionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);
    }

    return NextResponse.json({ success: true, message: "Version deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in version DELETE handler:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
